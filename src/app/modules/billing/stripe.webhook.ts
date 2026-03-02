import { Request, Response } from "express";
import Stripe from "stripe";
import config from "../../../config";
import { stripe } from "../../../lib/stripe";
import { prisma } from "../../../lib/prisma";

export const stripeWebhook = async (req: Request, res: Response) => {
  console.log("headers:------------->", req.headers);
  console.log("raw body type:------------>", Buffer.isBuffer(req.body));
  console.log("webhooks----------->")
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      config.stripe.webhookSecret
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("session--------->", session)
      const tenantId = session.client_reference_id!;
      const subscriptionId = session.subscription as string;

      const subscription = await stripe.subscriptions.retrieve(
        subscriptionId
      );
      console.log("subscription--------->", subscription)
      const priceId =
        subscription.items.data[0].price.id;

      const planMap: Record<string, any> = {
        [config.stripe.plans.silver]: "SILVER",
        [config.stripe.plans.gold]: "GOLD",
        [config.stripe.plans.diamond]: "DIAMOND",
      };

      const plan = planMap[priceId] ?? "FREE";
      console.log("plan--------->", plan)
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          plan,
          subscriptionId,
          subscriptionStatus: "ACTIVE",
        },
      });

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;

      await prisma.tenant.updateMany({
        where: { subscriptionId: subscription.id },
        data: {
          plan: "FREE",
          subscriptionId: null,
          subscriptionStatus: "CANCELED",
        },
      });

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("invoice--------------->", invoice)
      //const subscriptionId = invoice.subscription as string;

      await prisma.tenant.updateMany({
        where: { subscriptionId: invoice.id },
        data: {
          subscriptionStatus: "PAST_DUE",
        },
      });

      break;
    }

    default:
      console.log("Unhandled event:", event.type);
  }

  res.json({ received: true });
};