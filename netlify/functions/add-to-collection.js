// netlify/functions/add-to-collection.js
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');
    const userId = decoded.userId;

    // Parse request body
    const {
      cardName,
      cardGame,
      cardSet,
      cardNumber,
      psaGrade,
      certNumber,
      imageUrl,
      notes,
      psaData
    } = await req.json();

    // Validate required fields
    if (!cardName || !cardGame || !psaGrade || !certNumber) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: cardName, cardGame, psaGrade, certNumber' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Connect to database
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Check if card already in collection
    const existing = await sql`
      SELECT id FROM collections 
      WHERE user_id = ${userId} AND cert_number = ${certNumber}
    `;

    if (existing.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Card already in your collection' 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert into collection (NO estimated_value column)
    const [result] = await sql`
      INSERT INTO collections (
        user_id, card_name, card_game, card_set, card_number,
        psa_grade, cert_number, image_url, notes,
        psa_year, psa_brand, psa_category, psa_variety,
        total_population, pop_higher_grade, added_date
      ) VALUES (
        ${userId}, ${cardName}, ${cardGame}, ${cardSet || null}, ${cardNumber || null},
        ${psaGrade}, ${certNumber}, ${imageUrl || null}, ${notes || null},
        ${psaData?.year || null}, ${psaData?.brand || null}, 
        ${psaData?.category || null}, ${psaData?.variety || null},
        ${psaData?.totalPopulation || 0}, ${psaData?.popHigherGrade || 0}, NOW()
      )
      RETURNING id
    `;

    return new Response(JSON.stringify({
      success: true,
      collectionId: result.id,
      message: 'Card added to collection'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error adding to collection:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Failed to add card to collection',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};