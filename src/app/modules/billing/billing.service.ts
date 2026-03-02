import { prisma } from "../../../lib/prisma";
import { stripe } from "../../../lib/stripe";
import config from "../../../config";

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

  if (!user) throw new Error("User not found");

  const tenant = user.tenant;

  //  FREE plan
  if (plan === "FREE") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
        subscriptionId: null,
      },
    });

    return { message: "Free plan activated" };
  }

  //  Plan → Price mapping
  const priceMap: Record<string, string> = {
    SILVER: config.stripe.plans.silver,
    GOLD: config.stripe.plans.gold,
    DIAMOND: config.stripe.plans.diamond,
  };

  const priceId = priceMap[plan];
  if (!priceId) throw new Error("Invalid plan");

  //  Create customer if needed
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

  //  Mark as INCOMPLETE before payment
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: "INCOMPLETE",
    },
  });

  //  Checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: tenant.id, // IMPORTANT
    metadata: {
      tenantId: tenant.id,
      plan,
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}`,
    cancel_url: `${process.env.FRONTEND_URL}`,
  });

  return {
    url: session.url,
  };
};

export const billingServices = { createBilling };