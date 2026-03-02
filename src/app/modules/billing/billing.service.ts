import { prisma } from "../../../lib/prisma";
import { stripe } from "../../../lib/stripe";
import config from "../../../config";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";

const createBilling = async ({
  userId,
  plan,
}: {
  userId: string;
  plan: string;
}) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user) throw new AppError("User not found", httpStatus.NOT_FOUND);

  const tenant = user.tenant;

  // ─── FREE plan ────────────────────────────────────────────────────────────────
  if (plan === "FREE") {
    // Cancel active Stripe subscription if exists
    if (tenant.subscriptionId) {
      try {
        await stripe.subscriptions.cancel(tenant.subscriptionId);
      } catch (err) {
        console.error("Failed to cancel Stripe subscription:", err);
      }
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: "FREE",
        subscriptionStatus: "CANCELED",
        subscriptionId: null,
      },
    });

    return { message: "Free plan activated" };
  }

  // ─── Plan → Price mapping ─────────────────────────────────────────────────────
  const priceMap: Record<string, string> = {
    SILVER: config.stripe.plans.silver,
    GOLD: config.stripe.plans.gold,
    DIAMOND: config.stripe.plans.diamond,
  };

  const priceId = priceMap[plan];
  if (!priceId) throw new AppError("Invalid plan", httpStatus.BAD_REQUEST);

  // ─── Create Stripe customer if needed ────────────────────────────────────────
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: tenant.name,
    });

    customerId = customer.id;

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // ─── Checkout session ─────────────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: tenant.id,
    metadata: {
      tenantId: tenant.id,
      plan,
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}`,
    cancel_url: `${process.env.FRONTEND_URL}`,
  });

  return { url: session.url };
};

export const billingServices = { createBilling };