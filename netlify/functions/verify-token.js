// FILE: netlify/functions/verify-token.js
import jwt from 'jsonwebtoken';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');

    return new Response(JSON.stringify({
      valid: true,
      userId: decoded.userId,
      email: decoded.email
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      valid: false, 
      error: 'Invalid or expired token' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};