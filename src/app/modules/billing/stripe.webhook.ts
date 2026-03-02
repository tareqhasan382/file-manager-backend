import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../../../lib/stripe";
import { prisma } from "../../../lib/prisma";
import config from "../../../config";
import { Plan } from "../../../generated/prisma/enums";

export const stripeWebhook = async (req: Request, res: Response) => {
  console.log("headers:------------->", req.headers);
  console.log("raw body type:------------>", Buffer.isBuffer(req.body));
  console.log("webhooks----------->");

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature");

  let event: Stripe.Event;

  try {
    // Express.raw middleware ensures req.body is a Buffer
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      config.stripe.webhookSecret
    );
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.client_reference_id!;
        const subscriptionId = session.subscription as string;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0].price.id;

        const planMap: Record<string, any> = {
          [config.stripe.plans.silver]: "SILVER",
          [config.stripe.plans.gold]: "GOLD",
          [config.stripe.plans.diamond]: "DIAMOND",
        };
        const plan = planMap[priceId] ?? "FREE";

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan,
            subscriptionId,
            subscriptionStatus: "ACTIVE",
          },
        });

        console.log(`Tenant ${tenantId} subscription ACTIVE, plan ${plan}`);
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
        // const subscriptionId = invoice.subscription as string;
        await prisma.tenant.updateMany({
          where: { subscriptionId: invoice.id },
          data: {
            subscriptionStatus: "PAST_DUE",
          },
        });
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("Error processing event:", err);
    res.status(500).send("Internal Server Error");
  }
};