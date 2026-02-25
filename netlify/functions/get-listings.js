// ============================================
// FILE: netlify/functions/get-listings.js
// Get all active listings or user's listings
// ============================================

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
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const url = new URL(req.url);
    
    // Check if requesting user's own listings
    const myListings = url.searchParams.get('my') === 'true';
    const cardGame = url.searchParams.get('game');
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    const psaGrade = url.searchParams.get('grade');

    let sellerId = null;

    // If requesting personal listings, verify token
    if (myListings) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');
      sellerId = decoded.userId;
    }

    // Simple query - just get active listings
    let listings;
    
    if (myListings && sellerId) {
      listings = await sql`
        SELECT 
          l.*,
          u.username as seller_username,
          u.seller_rating,
          u.total_sales,
          u.is_verified_seller
        FROM listings l
        JOIN users u ON l.seller_id = u.id
        WHERE l.seller_id = ${sellerId}
        ORDER BY l.created_at DESC
      `;
    } else {
      // Get all active listings
      listings = await sql`
        SELECT 
          l.*,
          u.username as seller_username,
          u.seller_rating,
          u.total_sales,
          u.is_verified_seller
        FROM listings l
        JOIN users u ON l.seller_id = u.id
        WHERE l.status = 'active'
        ORDER BY l.created_at DESC
      `;
    }

    console.log('Found listings:', listings.length);

    return new Response(JSON.stringify({
      listings: listings,
      count: listings.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get listings error:', error);

    if (error.name === 'JsonWebTokenError') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Server error fetching listings',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};