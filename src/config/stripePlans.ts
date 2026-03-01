import config from ".";

export const STRIPE_PRICES = {
  FREE: config.stripe.plans.free,
  SILVER: config.stripe.plans.silver,
  GOLD: config.stripe.plans.gold,
  DIAMOND: config.stripe.plans.diamond,
};