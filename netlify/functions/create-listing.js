// ============================================
// FILE: netlify/functions/create-listing.js
// Create a new card listing for sale
// ============================================

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { validateListingPrice } from './config.js';

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
    const sellerId = decoded.userId;

    // Parse request body
    const {
      cardName,
      cardGame,
      cardSet,
      cardNumber,
      psaGrade,
      certNumber,
      price,
      conditionNotes,
      imageUrl
    } = await req.json();

    // Validate required fields
    if (!cardName || !cardGame || !psaGrade || !certNumber || !price) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: cardName, cardGame, psaGrade, certNumber, price' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate PSA grade (1-10)
    if (psaGrade < 1 || psaGrade > 10) {
      return new Response(JSON.stringify({ 
        error: 'PSA grade must be between 1 and 10' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate price
    const priceValidation = validateListingPrice(price);
    if (!priceValidation.valid) {
      return new Response(JSON.stringify({ error: priceValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Connect to database
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Check if cert number already listed by this user
    const existingListing = await sql`
      SELECT id FROM listings 
      WHERE cert_number = ${certNumber} 
      AND seller_id = ${sellerId}
      AND status = 'active'
    `;

    if (existingListing.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'You already have an active listing for this card' 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create listing
    const [newListing] = await sql`
      INSERT INTO listings (
        seller_id,
        card_name,
        card_game,
        card_set,
        card_number,
        psa_grade,
        cert_number,
        price,
        condition_notes,
        image_url,
        status,
        created_at
      ) VALUES (
        ${sellerId},
        ${cardName},
        ${cardGame},
        ${cardSet || null},
        ${cardNumber || null},
        ${psaGrade},
        ${certNumber},
        ${price},
        ${conditionNotes || null},
        ${imageUrl || null},
        'active',
        NOW()
      )
      RETURNING *
    `;

    return new Response(JSON.stringify({
      message: 'Listing created successfully!',
      listing: newListing
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create listing error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Server error creating listing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};