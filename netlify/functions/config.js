// ============================================
// FILE: netlify/functions/config.js
// Platform configuration
// ============================================

export const PLATFORM_CONFIG = {
  // COMMISSION SETTINGS
  PLATFORM_FEE_PERCENTAGE: 10, // 10% commission
  
  // STRIPE SETTINGS
  STRIPE_FEE_PERCENTAGE: 2.9,
  STRIPE_FIXED_FEE: 0.30,
  
  // PRICE LIMITS
  MIN_LISTING_PRICE: 10.00,
  MAX_LISTING_PRICE: 100000.00,
};

/**
 * Calculate transaction fees
 */
export function calculateTransactionFees(cardPrice) {
  // Convert to number if it's a string
  const price = parseFloat(cardPrice);
  
  if (isNaN(price)) {
    throw new Error('Invalid card price');
  }
  
  const platformFee = (price * PLATFORM_CONFIG.PLATFORM_FEE_PERCENTAGE) / 100;
  const stripeFee = (price * PLATFORM_CONFIG.STRIPE_FEE_PERCENTAGE) / 100 + PLATFORM_CONFIG.STRIPE_FIXED_FEE;
  const totalAmount = price;
  const sellerPayout = price - platformFee - stripeFee;
  
  return {
    cardPrice: parseFloat(price.toFixed(2)),
    platformFee: parseFloat(platformFee.toFixed(2)),
    stripeFee: parseFloat(stripeFee.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    sellerPayout: parseFloat(sellerPayout.toFixed(2))
  };
}

/**
 * Validate listing price
 */
export function validateListingPrice(price) {
  if (price < PLATFORM_CONFIG.MIN_LISTING_PRICE) {
    return {
      valid: false,
      error: `Price must be at least ${PLATFORM_CONFIG.MIN_LISTING_PRICE}€`
    };
  }
  
  if (price > PLATFORM_CONFIG.MAX_LISTING_PRICE) {
    return {
      valid: false,
      error: `Price cannot exceed ${PLATFORM_CONFIG.MAX_LISTING_PRICE}€`
    };
  }
  
  return { valid: true };
}