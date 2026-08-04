import { Request, Response } from "express";
import Stripe from "stripe";
import { Types } from "mongoose";
import { stripe } from "../../../lib/stripe";
import { Tenant } from "../../../models/Tenant";
import { Billing, BillingStatus, BillingType } from "../../../models/Billing";
import config from "../../../config";
import { Plan, SubscriptionStatus } from "../../enums";
import {
  subscriptionActivatedEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
  subscriptionRenewedEmail,
} from "../../../lib/emailtemplates";
import { sendEmail } from "../../../lib/email";

// ─── Helper: tenant + owner email in one aggregation (no N+1) ─────────────────
const getTenantWithOwner = async (subscriptionId: string) => {
  const [result] = await Tenant.aggregate([
    { $match: { subscriptionId, deletedAt: null } },
    {
      $lookup: {
        from: "users",
        let: { tid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$tenantId", "$$tid"] },
              role: "OWNER",
              deletedAt: null,
            },
          },
          { $limit: 1 },
          { $project: { _id: 0, email: 1 } },
        ],
        as: "owner",
      },
    },
    { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name: 1,
        plan: 1,
        ownerEmail: "$owner.email",
      },
    },
  ]);

  return result
    ? { id: result._id.toString(), name: result.name, plan: result.plan, ownerEmail: result.ownerEmail }
    : null;
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
          [config.stripe.plans.silver]: Plan.SILVER,
          [config.stripe.plans.gold]: Plan.GOLD,
          [config.stripe.plans.diamond]: Plan.DIAMOND,
        };
        const plan = priceMap[priceId] ?? session.metadata?.plan ?? Plan.FREE;

        const [tenantWithOwner] = await Tenant.aggregate([
          { $match: { _id: new Types.ObjectId(tenantId), deletedAt: null } },
          {
            $lookup: {
              from: "users",
              let: { tid: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$tenantId", "$$tid"] },
                    role: "OWNER",
                    deletedAt: null,
                  },
                },
                { $limit: 1 },
                { $project: { _id: 0, email: 1 } },
              ],
              as: "owner",
            },
          },
          { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, name: 1, ownerEmail: "$owner.email" } },
        ]);

        await Tenant.updateOne(
          { _id: tenantId },
          {
            $set: {
              plan,
              subscriptionId,
              subscriptionStatus: SubscriptionStatus.ACTIVE,
            },
          }
        );

        // Persist the completed checkout in the billing ledger
        await Billing.updateOne(
          { stripeCheckoutId: session.id },
          {
            $set: {
              status: BillingStatus.ACTIVE,
              plan,
              amount: session.amount_total ?? 0,
              currency: session.currency ?? "usd",
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: session.customer ?? null,
              description: `Subscription activated: ${plan} plan`,
            },
            $setOnInsert: {
              tenantId,
              type: BillingType.CHECKOUT,
            },
          },
          { upsert: true }
        );

        if (tenantWithOwner?.name && tenantWithOwner.ownerEmail) {
          const { subject, html } = subscriptionActivatedEmail({
            name: tenantWithOwner.name,
            plan,
          });
          await sendEmail({
            to: tenantWithOwner.ownerEmail,
            subject,
            html,
          }).catch((err) => console.error("Webhook email failed:", err));
        }

        console.log(`Tenant ${tenantId} → ACTIVE, plan: ${plan}`);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Find the pending checkout we recorded at initiation.
        const pending = await Billing.findOne({
          stripeCheckoutId: session.id,
          type: BillingType.CHECKOUT,
          status: BillingStatus.PENDING,
        }).lean();

        if (pending) {
          // Revert the tenant to the plan they were on before the upgrade.
          const fallbackPlan = pending.previousPlan ?? Plan.FREE;
          await Tenant.updateOne(
            { _id: pending.tenantId },
            {
              $set: {
                plan: fallbackPlan,
                subscriptionStatus: SubscriptionStatus.ACTIVE,
              },
            }
          );

          await Billing.updateOne(
            { _id: pending._id },
            { $set: { status: BillingStatus.CANCELED } }
          );

          console.log(
            `Checkout ${session.id} expired — tenant reverted to ${fallbackPlan}`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenant = await getTenantWithOwner(subscription.id);

        await Tenant.updateOne(
          { subscriptionId: subscription.id },
          {
            $set: {
              plan: Plan.FREE,
              subscriptionId: null,
              subscriptionStatus: SubscriptionStatus.CANCELED,
            },
          }
        );

        // Update every ledger row linked to this subscription
        await Billing.updateMany(
          { stripeSubscriptionId: subscription.id },
          { $set: { status: BillingStatus.CANCELED } }
        );

        if (tenant) {
          await Billing.create({
            tenantId: tenant.id,
            plan: Plan.FREE,
            type: BillingType.SUBSCRIPTION,
            status: BillingStatus.CANCELED,
            amount: 0,
            currency: "usd",
            description: `Subscription canceled — reverted to FREE`,
            stripeSubscriptionId: subscription.id,
          });
        }

        if (tenant && tenant.ownerEmail) {
          const { subject, html } = subscriptionCanceledEmail({
            name: tenant.name,
            plan: tenant.plan,
          });
          await sendEmail({ to: tenant.ownerEmail, subject, html });
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

          await Tenant.updateOne(
            { subscriptionId },
            { $set: { subscriptionStatus: SubscriptionStatus.PAST_DUE } }
          );

          await Billing.updateOne(
            { stripeInvoiceId: invoice.id },
            {
              $set: {
                status: BillingStatus.FAILED,
                amount: invoice.amount_due ?? 0,
                currency: invoice.currency ?? "usd",
                stripeSubscriptionId: subscriptionId,
              },
              $setOnInsert: {
                tenantId: tenant?.id,
                plan: tenant?.plan ?? Plan.FREE,
                type: BillingType.PAYMENT,
                stripeCustomerId: invoice.customer ?? null,
                description: `Payment failed (${tenant?.plan ?? "plan"} plan)`,
              },
            },
            { upsert: true }
          );

          if (tenant && tenant.ownerEmail) {
            const { subject, html } = paymentFailedEmail({
              name: tenant.name,
              plan: tenant.plan,
            });
            await sendEmail({ to: tenant.ownerEmail, subject, html });
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

          await Tenant.updateOne(
            { subscriptionId },
            { $set: { subscriptionStatus: SubscriptionStatus.ACTIVE } }
          );

          await Billing.updateOne(
            { stripeInvoiceId: invoice.id },
            {
              $set: {
                status: BillingStatus.PAID,
                amount: invoice.amount_paid ?? 0,
                currency: invoice.currency ?? "usd",
                stripeSubscriptionId: subscriptionId,
              },
              $setOnInsert: {
                tenantId: tenant?.id,
                plan: tenant?.plan ?? Plan.FREE,
                type: BillingType.PAYMENT,
                stripeCustomerId: invoice.customer ?? null,
                description: `Payment received (${tenant?.plan ?? "plan"} plan)`,
              },
            },
            { upsert: true }
          );

          if (tenant && tenant.ownerEmail) {
            const { subject, html } = subscriptionRenewedEmail({
              name: tenant.name,
              plan: tenant.plan,
            });
            await sendEmail({ to: tenant.ownerEmail, subject, html });
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
