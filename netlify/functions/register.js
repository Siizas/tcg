// FILE: netlify/functions/register.js
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async (req, context) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { email, password, username } = await req.json();

    // Validate input
    if (!email || !password || !username) {
      return new Response(JSON.stringify({ error: 'All fields are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Connect to Neon database
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email} OR username = ${username}
    `;

    if (existingUser.length > 0) {
      return new Response(JSON.stringify({ error: 'Email or username already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [newUser] = await sql`
      INSERT INTO users (email, username, password, created_at)
      VALUES (${email}, ${username}, ${hashedPassword}, NOW())
      RETURNING id, email, username, created_at
    `;

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'your-secret-key-change-this',
      { expiresIn: '7d' }
    );

    return new Response(JSON.stringify({
      message: 'Account created successfully!',
      token: token,
      userId: newUser.id,
      username: newUser.username
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ error: 'Server error during registration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};