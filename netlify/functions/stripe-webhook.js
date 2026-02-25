// ============================================
// FILE: netlify/functions/stripe-webhook.js
// Handle Stripe webhook events (payment confirmations)
// ============================================

import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const transactionId = parseInt(session.metadata.transactionId);
        const listingId = parseInt(session.metadata.listingId);

        console.log('Payment successful for transaction:', transactionId);

        // Update transaction status to paid
        await sql`
          UPDATE transactions 
          SET 
            payment_status = 'paid',
            stripe_charge_id = ${session.payment_intent},
            updated_at = NOW()
          WHERE id = ${transactionId}
        `;

        // Update listing status to sold
        await sql`
          UPDATE listings 
          SET 
            status = 'sold',
            sold_at = NOW(),
            updated_at = NOW()
          WHERE id = ${listingId}
        `;

        console.log('Transaction and listing updated successfully');
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const transactionId = parseInt(session.metadata.transactionId);
        const listingId = parseInt(session.metadata.listingId);

        console.log('Checkout session expired for transaction:', transactionId);

        // Mark transaction as failed
        await sql`
          UPDATE transactions 
          SET 
            payment_status = 'failed',
            updated_at = NOW()
          WHERE id = ${transactionId}
        `;

        // Return listing to active status
        await sql`
          UPDATE listings 
          SET 
            status = 'active',
            updated_at = NOW()
          WHERE id = ${listingId}
        `;

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        
        // Find transaction by charge ID
        const [transaction] = await sql`
          SELECT id FROM transactions
          WHERE stripe_charge_id = ${charge.id}
        `;

        if (transaction) {
          await sql`
            UPDATE transactions 
            SET 
              payment_status = 'refunded',
              updated_at = NOW()
            WHERE id = ${transaction.id}
          `;
          
          console.log('Transaction refunded:', transaction.id);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(JSON.stringify({ error: 'Webhook handler failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};