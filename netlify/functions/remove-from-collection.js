// netlify/functions/remove-from-collection.js
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export default async (req, context) => {
  if (req.method !== 'DELETE') {
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

    // Get collection ID from query params
    const url = new URL(req.url);
    const collectionId = url.searchParams.get('id');
    
    if (!collectionId) {
      return new Response(JSON.stringify({ 
        error: 'Collection ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Connect to database
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Delete card (only if it belongs to the user)
    const result = await sql`
      DELETE FROM collections 
      WHERE id = ${collectionId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Card not found in your collection' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Card removed from collection'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error removing from collection:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Failed to remove card from collection',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
