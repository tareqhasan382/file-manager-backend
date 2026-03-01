import { Request, Response } from "express";
import Stripe from "stripe";
import config from "../../../config";
import { stripe } from "../../../lib/stripe";
import { prisma } from "../../../lib/prisma";

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      config.stripe.key.webhookSecret
    );
  } catch (err: any) {
    console.error("Webhook signature failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  //  Handle events
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      const subscriptionId = session.subscription as string;
      const customerId = session.customer as string;

      // subscription fetch
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const priceId =
        subscription.items.data[0].price.id;

      // Price → Plan mapping
      let plan: "FREE"| "SILVER" | "GOLD" | "DIAMOND";

      switch (priceId) {
        case config.stripe.plans.silver:
          plan = "SILVER";
          break;
        case config.stripe.plans.gold:
          plan = "GOLD";
          break;
        case config.stripe.plans.diamond:
          plan = "DIAMOND";
          break;
        default:
          plan = "FREE";
      }

      //  Update tenant
      await prisma.tenant.update({
        where: { stripeCustomerId: customerId },
        data: {
          plan,
          subscriptionId,
        },
      });

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;

      await prisma.tenant.update({
        where: { subscriptionId: subscription.id },
        data: {
          plan: "FREE",
          subscriptionId: null,
        },
      });

      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};