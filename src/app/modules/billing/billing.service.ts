import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { stripe } from "../../../lib/stripe";
// import { STRIPE_PRICES } from "../../../config/stripe";
import config from "../../../config";
import { STRIPE_PRICES } from "../../../config/stripePlans";

export const create = async (req: any) => {
  const { plan } = req.body;
  const { userId, tenantId } = req.user; // auth middleware থেকে

  if (!plan) {
    throw new AppError("Plan is required", httpStatus.BAD_REQUEST);
  }

  if (!["SILVER", "GOLD", "DIAMOND"].includes(plan)) {
    throw new AppError("Invalid plan selected", httpStatus.BAD_REQUEST);
  }

  // 1️ Tenant fetch
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  // 2️ Stripe customer create (only once)
  let stripeCustomerId = tenant.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: tenant.name,
      metadata: {
        tenantId: tenant.id,
        userId,
      },
    });

    stripeCustomerId = customer.id;

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId },
    });
  }

  // 3️ Plan → Stripe Price ID
  const priceId = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES];

  if (!priceId) {
    throw new AppError("Stripe price not configured", httpStatus.BAD_REQUEST);
  }

  //4️ Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${config.frontend_url}/billing/success`,
    cancel_url: `${config.frontend_url}/billing/cancel`,
  });

  // 5️ শুধু URL return
  return {
    checkoutUrl: session.url,
  };
};

export const billingServices = {
  create,
};