// netlify/functions/get-collection.js
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export default async (req, context) => {
  if (req.method !== 'GET') {
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

    // Connect to database
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Get all cards from user's collection
    const cards = await sql`
      SELECT * FROM collections 
      WHERE user_id = ${userId}
      ORDER BY added_date DESC
    `;

    // Calculate stats
    const totalCards = cards.length;
    const psa10Count = cards.filter(card => card.psa_grade === 10).length;
    const avgGrade = totalCards > 0 
      ? (cards.reduce((sum, card) => sum + card.psa_grade, 0) / totalCards).toFixed(1)
      : 0;

    return new Response(JSON.stringify({
      success: true,
      cards,
      stats: {
        totalCards,
        psa10Count,
        avgGrade
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching collection:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Failed to fetch collection',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
