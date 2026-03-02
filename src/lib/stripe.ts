// import Stripe from "stripe";

// export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: "2026-01-28.clover",
// });

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Match the Stripe TypeScript enum exactly
  apiVersion: "2026-02-25.clover", 
});