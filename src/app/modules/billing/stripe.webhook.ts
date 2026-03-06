import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../../../lib/stripe";
import { prisma } from "../../../lib/prisma";
import config from "../../../config";
import { Plan, SubscriptionStatus } from "../../../generated/prisma/enums";
import {
  subscriptionActivatedEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
  subscriptionRenewedEmail,
} from "../../../lib/emailtemplates";
import { sendEmail } from "../../../lib/email";

// ─── Helper: get tenant with owner email ─────────────
const getTenantWithOwner = async (subscriptionId: string) => {
  return prisma.tenant.findFirst({
    where: { subscriptionId },
    include: { users: { where: { role: "OWNER" } } },
  });
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature");

  let event: Stripe.Event;

  try {
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

        const priceMap: Record<string, string> = {
          [config.stripe.plans.silver]: "SILVER",
          [config.stripe.plans.gold]: "GOLD",
          [config.stripe.plans.diamond]: "DIAMOND",
        };
        const plan = priceMap[priceId] ?? session.metadata?.plan ?? "FREE";

        // ─── Prisma transaction ───────────────────────────
        const tenant = await prisma.$transaction(async (tx) => {
          return tx.tenant.update({
            where: { id: tenantId },
            data: {
              plan: plan as Plan,
              subscriptionId,
              subscriptionStatus: "ACTIVE" as SubscriptionStatus,
            },
            include: { users: { where: { role: "OWNER" } } },
          });
        });

        const ownerEmail = tenant.users[0]?.email;
        if (ownerEmail) {
          const { subject, html } = subscriptionActivatedEmail({
            name: tenant.name,
            plan,
          });
          await sendEmail({ to: ownerEmail, subject, html });
        }

        console.log(`Tenant ${tenantId} → ACTIVE, plan: ${plan}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenant = await getTenantWithOwner(subscription.id);

        await prisma.$transaction(async (tx) => {
          await tx.tenant.updateMany({
            where: { subscriptionId: subscription.id },
            data: {
              plan: "FREE" as Plan,
              subscriptionId: null,
              subscriptionStatus: "CANCELED" as SubscriptionStatus,
            },
          });
        });

        const ownerEmail = tenant?.users[0]?.email;
        if (tenant && ownerEmail) {
          const { subject, html } = subscriptionCanceledEmail({
            name: tenant.name,
            plan: tenant.plan,
          });
          await sendEmail({ to: ownerEmail, subject, html });
        }

        console.log(`Subscription ${subscription.id} → CANCELED`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription: string | null;
        };
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const tenant = await getTenantWithOwner(subscriptionId);

          await prisma.$transaction(async (tx) => {
            await tx.tenant.updateMany({
              where: { subscriptionId },
              data: { subscriptionStatus: "PAST_DUE" as SubscriptionStatus },
            });
          });

          const ownerEmail = tenant?.users[0]?.email;
          if (tenant && ownerEmail) {
            const { subject, html } = paymentFailedEmail({
              name: tenant.name,
              plan: tenant.plan,
            });
            await sendEmail({ to: ownerEmail, subject, html });
          }

          console.log(`Subscription ${subscriptionId} → PAST_DUE`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription: string | null;
        };
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const tenant = await getTenantWithOwner(subscriptionId);

          await prisma.$transaction(async (tx) => {
            await tx.tenant.updateMany({
              where: { subscriptionId },
              data: { subscriptionStatus: "ACTIVE" as SubscriptionStatus },
            });
          });

          const ownerEmail = tenant?.users[0]?.email;
          if (tenant && ownerEmail) {
            const { subject, html } = subscriptionRenewedEmail({
              name: tenant.name,
              plan: tenant.plan,
            });
            await sendEmail({ to: ownerEmail, subject, html });
          }

          console.log(`Subscription ${subscriptionId} → ACTIVE (renewed)`);
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("Error processing webhook event:", err);
    res.status(500).send("Internal Server Error");
  }
};