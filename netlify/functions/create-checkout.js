// ============================================
// FILE: netlify/functions/create-checkout.js
// Create Stripe checkout session for purchasing a card
// ============================================

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { calculateTransactionFees } from './config.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');
    const buyerId = decoded.userId;

    const { listingId } = await req.json();

    if (!listingId) {
      return new Response(JSON.stringify({ error: 'Listing ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Connect to database
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Get listing details
    const [listing] = await sql`
      SELECT l.*, u.username as seller_username, u.email as seller_email
      FROM listings l
      JOIN users u ON l.seller_id = u.id
      WHERE l.id = ${listingId} AND l.status = 'active'
    `;

    if (!listing) {
      return new Response(JSON.stringify({ error: 'Listing not found or no longer available' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Can't buy your own listing
    if (listing.seller_id === buyerId) {
      return new Response(JSON.stringify({ error: 'Cannot purchase your own listing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate fees
    const fees = calculateTransactionFees(listing.price);

    // Create pending transaction record
    const [transaction] = await sql`
      INSERT INTO transactions (
        listing_id,
        buyer_id,
        seller_id,
        card_price,
        platform_fee,
        stripe_fee,
        total_amount,
        seller_payout,
        payment_status,
        shipping_status,
        created_at
      ) VALUES (
        ${listing.id},
        ${buyerId},
        ${listing.seller_id},
        ${fees.cardPrice},
        ${fees.platformFee},
        ${fees.stripeFee},
        ${fees.totalAmount},
        ${fees.sellerPayout},
        'pending',
        'not_shipped',
        NOW()
      )
      RETURNING id
    `;

    // Update listing status to pending
    await sql`
      UPDATE listings 
      SET status = 'pending', updated_at = NOW()
      WHERE id = ${listing.id}
    `;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${listing.card_name} - PSA ${listing.psa_grade}`,
              description: `${listing.card_game} | Cert: ${listing.cert_number}`,
              images: listing.image_url ? [listing.image_url] : [],
            },
            unit_amount: Math.round(fees.totalAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_URL || 'http://localhost:8888'}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL || 'http://localhost:8888'}/marketplace?canceled=true`,
      metadata: {
        transactionId: transaction.id.toString(),
        listingId: listing.id.toString(),
        buyerId: buyerId.toString(),
        sellerId: listing.seller_id.toString(),
      },
    });

    // Store Stripe session ID
    await sql`
      UPDATE transactions 
      SET stripe_payment_intent_id = ${session.id}
      WHERE id = ${transaction.id}
    `;

    return new Response(JSON.stringify({
      sessionId: session.id,
      checkoutUrl: session.url,
      transactionId: transaction.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create checkout error:', error);

    if (error.name === 'JsonWebTokenError') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Server error creating checkout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};