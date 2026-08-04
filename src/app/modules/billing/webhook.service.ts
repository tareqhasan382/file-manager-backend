import Stripe from "stripe";
import { ClientSession, Types } from "mongoose";
import { stripe } from "../../../lib/stripe";
import { Tenant } from "../../../models/Tenant";
import { Billing, BillingStatus, BillingType } from "../../../models/Billing";
import { Plan, SubscriptionStatus } from "../../enums";
import config from "../../../config";
import {
  subscriptionActivatedEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
  subscriptionRenewedEmail,
} from "../../../lib/emailtemplates";
import { sendEmail } from "../../../lib/email";
import { AuditAction, logAudit } from "../../middlewares/audit.middleware";
import { withTransaction } from "../../../utils/transaction";

type SubscriptionStatusValue =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

type PlanValue = (typeof Plan)[keyof typeof Plan];

// Stripe's current TS types omit several runtime-only invoice fields that are
// still delivered on webhook objects, so we widen the type explicitly.
type StripeInvoice = Stripe.Invoice & {
  subscription?: string | null;
  payment_intent?: string | { id: string } | null;
  charge?: string | { id: string } | null;
  failure_reason?: string | null;
};

type StripeInvoiceLineItem = Stripe.InvoiceLineItem & {
  price?: string | Stripe.Price | null;
};

const isDuplicateKeyError = (err: any): boolean =>
  err?.code === 11000 || /duplicate key/i.test(err?.message ?? "");

export const toObjectId = (id: string | null | undefined): Types.ObjectId | null => {
  if (!id) return null;
  try {
    return new Types.ObjectId(id);
  } catch {
    return null;
  }
};

export const asId = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : v?.id ?? null;

export const priceToPlan = (priceId: string | undefined | null): PlanValue | null => {
  if (!priceId) return null;
  const priceMap: Record<string, PlanValue> = {
    [config.stripe.plans.silver]: Plan.SILVER,
    [config.stripe.plans.gold]: Plan.GOLD,
    [config.stripe.plans.diamond]: Plan.DIAMOND,
  };
  return priceMap[priceId] ?? null;
};

export const mapSubscriptionStatus = (
  stripeStatus: Stripe.Subscription.Status
): SubscriptionStatusValue => {
  switch (stripeStatus) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIAL;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return SubscriptionStatus.CANCELED;
    case "incomplete":
    case "paused":
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
};

interface TenantWithOwner {
  id: string;
  name: string;
  plan: PlanValue;
  pendingPlan: PlanValue | null;
  subscriptionId: string | null;
  ownerEmail: string | null;
}

const getTenantWithOwner = async (
  match: Record<string, unknown>
): Promise<TenantWithOwner | null> => {
  const [result] = await Tenant.aggregate([
    { $match: { deletedAt: null, ...match } },
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
        pendingPlan: 1,
        subscriptionId: 1,
        ownerEmail: "$owner.email",
      },
    },
  ]);

  if (!result) return null;
  return {
    id: result._id.toString(),
    name: result.name,
    plan: result.plan as PlanValue,
    pendingPlan: (result.pendingPlan as PlanValue) ?? null,
    subscriptionId: result.subscriptionId ?? null,
    ownerEmail: result.ownerEmail ?? null,
  };
};

const getTenantBySubscriptionId = (subscriptionId: string) =>
  getTenantWithOwner({ subscriptionId });

const getTenantByCustomerId = (customerId: string | null) =>
  customerId ? getTenantWithOwner({ stripeCustomerId: customerId }) : Promise.resolve(null);

const getTenantById = (tenantId: string | null | undefined) => {
  const oid = toObjectId(tenantId);
  if (!oid) return Promise.resolve(null);
  return getTenantWithOwner({ _id: oid });
};

const buildAudit = ({
  action,
  resource,
  resourceId,
  tenantId,
  ownerEmail,
  status,
  details,
}: {
  action: (typeof AuditAction)[keyof typeof AuditAction];
  resource: string;
  resourceId?: string | null;
  tenantId?: string | null;
  ownerEmail?: string | null;
  status: "SUCCESS" | "FAILURE";
  details?: Record<string, any> | null;
}) =>
  logAudit({
    action,
    resource,
    resourceId: resourceId ?? null,
    tenantId: tenantId ?? null,
    actorEmail: ownerEmail || "system",
    actorRole: "OWNER",
    status,
    ipAddress: "stripe-webhook",
    userAgent: "Stripe-Webhook",
    details,
  });

const safeSendEmail = (to: string, subject: string, html: string) =>
  sendEmail({ to, subject, html }).catch((err) =>
    console.error("[Stripe Webhook] Email failed:", err)
  );

/**
 * Records a paid invoice as a PAYMENT ledger entry (idempotent on the unique
 * stripeInvoiceId index). Safe to call both from `invoice.paid` and from the
 * checkout handler for the initial invoice.
 */
const applyPaidInvoice = async (
  invoice: StripeInvoice,
  tenantId: string,
  plan: PlanValue,
  session?: ClientSession
): Promise<void> => {
  const subscriptionId = asId(invoice.subscription);
  const customerId = asId(invoice.customer);
  const paymentIntentId = asId(invoice.payment_intent);
  const chargeId = asId(invoice.charge);
  const transactionId = chargeId ?? paymentIntentId;

  try {
    await Billing.updateOne(
      { stripeInvoiceId: invoice.id },
      {
        $set: {
          status: BillingStatus.PAID,
          amount: invoice.amount_paid ?? 0,
          currency: invoice.currency ?? "usd",
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: chargeId,
          transactionId,
          invoiceUrl: invoice.hosted_invoice_url ?? null,
          paidAt: new Date(),
          description: `Payment received (${plan} plan)`,
        },
        $setOnInsert: {
          tenantId: toObjectId(tenantId),
          plan,
          type: BillingType.PAYMENT,
        },
      },
      { upsert: true, ...(session ? { session } : {}) }
    );
  } catch (err: any) {
    // Concurrent webhook deliveries can race the unique-index upsert.
    if (isDuplicateKeyError(err)) return;
    throw err;
  }
};

/* ───────────────────────────────────────────────────────────────────────
 *  checkout.session.completed
 * ─────────────────────────────────────────────────────────────────────── */
const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session
) => {
  const tenantId = session.client_reference_id || session.metadata?.tenantId || null;
  if (!tenantId) {
    console.log(`[Stripe Webhook] checkout.session.completed without tenantId (${session.id}) — skipping`);
    return;
  }

  const subscriptionId = asId(session.subscription);
  const customerId = asId(session.customer);
  const invoiceId = asId(session.invoice);
  const paymentIntentId = asId(session.payment_intent);
  const isPaid = session.payment_status === "paid";

  // Resolve the purchased plan from the subscription price (authoritative),
  // falling back to the plan stored in the session metadata at creation time.
  let plan: PlanValue | null =
    (session.metadata?.plan as PlanValue | undefined) ?? null;
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const fromPrice = priceToPlan(subscription.items.data[0]?.price?.id);
      if (fromPrice) plan = fromPrice;
    } catch (err: any) {
      console.error(
        `[Stripe Webhook] Failed to retrieve subscription ${subscriptionId}: ${err.message}`
      );
    }
  }
  plan = plan ?? Plan.FREE;

  const previousTenant = await getTenantById(tenantId);

  await withTransaction(async (s) => {
    const tenantUpdate: Record<string, any> = {
      subscriptionStatus: isPaid
        ? SubscriptionStatus.ACTIVE
        : SubscriptionStatus.INCOMPLETE,
      pendingPlan: null,
    };
    if (plan && plan !== Plan.FREE) tenantUpdate.plan = plan;
    if (subscriptionId) tenantUpdate.subscriptionId = subscriptionId;
    if (customerId) tenantUpdate.stripeCustomerId = customerId;

    const tenantOid = toObjectId(tenantId);
    if (tenantOid) {
      await Tenant.updateOne({ _id: tenantOid }, { $set: tenantUpdate }, { session: s });
    }

    // Finalize the pending CHECKOUT ledger entry created at checkout time.
    const existingCheckout = await Billing.findOne({
      stripeCheckoutId: session.id,
    })
      .select("_id")
      .lean();
    const checkoutFields: Record<string, any> = {
      status: isPaid ? BillingStatus.COMPLETED : BillingStatus.FAILED,
      plan,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      stripeInvoiceId: invoiceId,
      stripePaymentIntentId: paymentIntentId,
      paidAt: isPaid ? new Date() : null,
      description: `Subscription activated: ${plan} plan`,
    };

    if (existingCheckout) {
      await Billing.updateOne(
        { _id: existingCheckout._id },
        { $set: checkoutFields },
        { session: s }
      );
    } else if (tenantOid) {
      await Billing.create(
        [
          {
            tenantId: tenantOid,
            plan,
            previousPlan: previousTenant?.plan ?? Plan.FREE,
            type: BillingType.CHECKOUT,
            ...checkoutFields,
            stripeCheckoutId: session.id,
          },
        ],
        { session: s }
      );
    }

    // Ensure a PAID payment-history row exists for the initial invoice even if
    // the `invoice.paid` webhook arrives out of order.
    if (isPaid && invoiceId && tenantOid) {
      const stub = {
        id: invoiceId,
        amount_paid: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        hosted_invoice_url: null,
        subscription: subscriptionId,
        customer: customerId,
        payment_intent: paymentIntentId,
        charge: null,
      } as unknown as StripeInvoice;
      await applyPaidInvoice(stub, tenantId, plan, s);
    }
  });

  // ── Post-commit, best-effort side effects ──────────────────────────
  if (
    previousTenant &&
    previousTenant.subscriptionId &&
    subscriptionId &&
    previousTenant.subscriptionId !== subscriptionId
  ) {
    try {
      await stripe.subscriptions.cancel(previousTenant.subscriptionId);
      console.log(
        `[Stripe Webhook] Canceled superseded subscription ${previousTenant.subscriptionId}`
      );
    } catch (err: any) {
      console.error(
        `[Stripe Webhook] Failed to cancel old subscription ${previousTenant.subscriptionId}: ${err.message}`
      );
    }
  }

  await buildAudit({
    action: isPaid ? AuditAction.SUBSCRIPTION_CREATED : AuditAction.PAYMENT_FAILED,
    resource: "subscription",
    resourceId: subscriptionId ?? session.id,
    tenantId,
    ownerEmail: previousTenant?.ownerEmail,
    status: isPaid ? "SUCCESS" : "FAILURE",
    details: {
      plan,
      amount: session.amount_total,
      currency: session.currency,
      checkoutId: session.id,
      paid: isPaid,
    },
  });

  if (isPaid && previousTenant?.name && previousTenant?.ownerEmail) {
    const { subject, html } = subscriptionActivatedEmail({
      name: previousTenant.name,
      plan,
    });
    await safeSendEmail(previousTenant.ownerEmail, subject, html);
  }

  console.log(
    `[Stripe Webhook] checkout.session.completed: tenant ${tenantId} → ${plan} (${isPaid ? "ACTIVE" : "INCOMPLETE"})`
  );
};

/* ───────────────────────────────────────────────────────────────────────
 *  checkout.session.expired
 * ─────────────────────────────────────────────────────────────────────── */
const handleCheckoutSessionExpired = async (session: Stripe.Checkout.Session) => {
  const checkoutRecord = await Billing.findOne({
    stripeCheckoutId: session.id,
    type: BillingType.CHECKOUT,
  }).lean();

  const tenantId =
    session.client_reference_id ||
    session.metadata?.tenantId ||
    (checkoutRecord ? checkoutRecord.tenantId.toString() : null);
  const tenantOid = toObjectId(tenantId);
  if (!tenantOid) {
    console.log(`[Stripe Webhook] checkout.session.expired without tenantId (${session.id}) — skipping`);
    return;
  }

  await withTransaction(async (s) => {
    if (checkoutRecord) {
      await Billing.updateOne(
        { _id: checkoutRecord._id },
        { $set: { status: BillingStatus.CANCELED } },
        { session: s }
      );
    }
    await Tenant.updateOne(
      { _id: tenantOid },
      { $set: { pendingPlan: null } },
      { session: s }
    );
  });

  await buildAudit({
    action: AuditAction.SUBSCRIPTION_CREATED,
    resource: "billing",
    resourceId: session.id,
    tenantId: tenantOid.toString(),
    status: "FAILURE",
    details: { reason: "checkout.session.expired" },
  });

  console.log(`[Stripe Webhook] checkout.session.expired: ${session.id} — pendingPlan cleared`);
};

/* ───────────────────────────────────────────────────────────────────────
 *  invoice.paid  /  invoice.payment_succeeded
 * ─────────────────────────────────────────────────────────────────────── */
const handleInvoicePaid = async (invoice: StripeInvoice) => {
  const subscriptionId = asId(invoice.subscription);
  if (!subscriptionId) {
    console.log(`[Stripe Webhook] invoice.paid without subscription (${invoice.id}) — skipping`);
    return;
  }

  const tenant = await getTenantBySubscriptionId(subscriptionId);
  if (!tenant) {
    console.log(
      `[Stripe Webhook] invoice.paid for unknown subscription ${subscriptionId} — checkout may not be processed yet`
    );
    return;
  }

  const firstLine = invoice.lines?.data?.[0] as
    | StripeInvoiceLineItem
    | undefined;
  const priceId =
    typeof firstLine?.price === "string"
      ? firstLine.price
      : firstLine?.price?.id;
  const plan =
    priceToPlan(priceId) ??
    tenant.pendingPlan ??
    tenant.plan ??
    Plan.FREE;

  await withTransaction(async (s) => {
    await Tenant.updateOne(
      { _id: toObjectId(tenant.id) },
      {
        $set: {
          subscriptionId,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          plan,
          pendingPlan: null,
        },
      },
      { session: s }
    );
    await applyPaidInvoice(invoice, tenant.id, plan, s);
  });

  await buildAudit({
    action: AuditAction.SUBSCRIPTION_RENEWED,
    resource: "billing",
    resourceId: invoice.id,
    tenantId: tenant.id,
    ownerEmail: tenant.ownerEmail,
    status: "SUCCESS",
    details: {
      amount: invoice.amount_paid,
      currency: invoice.currency,
      plan,
      subscriptionId,
    },
  });

  if (tenant.name && tenant.ownerEmail) {
    const { subject, html } = subscriptionRenewedEmail({
      name: tenant.name,
      plan,
    });
    await safeSendEmail(tenant.ownerEmail, subject, html);
  }

  console.log(`[Stripe Webhook] invoice.paid: ${invoice.id} → ACTIVE (${plan})`);
};

/* ───────────────────────────────────────────────────────────────────────
 *  invoice.payment_failed
 * ─────────────────────────────────────────────────────────────────────── */
const handleInvoicePaymentFailed = async (invoice: StripeInvoice) => {
  const subscriptionId = asId(invoice.subscription);
  if (!subscriptionId) {
    console.log(`[Stripe Webhook] invoice.payment_failed without subscription (${invoice.id}) — skipping`);
    return;
  }

  const tenant = await getTenantBySubscriptionId(subscriptionId);
  if (!tenant) {
    console.log(`[Stripe Webhook] invoice.payment_failed for unknown subscription ${subscriptionId} — skipping`);
    return;
  }

  const paymentIntentId = asId(invoice.payment_intent);
  const chargeId = asId(invoice.charge);

  await withTransaction(async (s) => {
    await Tenant.updateOne(
      { _id: toObjectId(tenant.id) },
      { $set: { subscriptionStatus: SubscriptionStatus.PAST_DUE } },
      { session: s }
    );

    try {
      await Billing.updateOne(
        { stripeInvoiceId: invoice.id },
        {
          $set: {
            status: BillingStatus.FAILED,
            amount: invoice.amount_due ?? 0,
            currency: invoice.currency ?? "usd",
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: asId(invoice.customer),
            stripePaymentIntentId: paymentIntentId,
            stripeChargeId: chargeId,
            transactionId: chargeId ?? paymentIntentId,
            description: `Payment failed (${tenant.plan} plan)`,
            paidAt: null,
          },
          $setOnInsert: {
            tenantId: toObjectId(tenant.id),
            plan: tenant.plan,
            type: BillingType.PAYMENT,
          },
        },
        { upsert: true, session: s }
      );
    } catch (err: any) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  });

  await buildAudit({
    action: AuditAction.PAYMENT_FAILED,
    resource: "billing",
    resourceId: invoice.id,
    tenantId: tenant.id,
    ownerEmail: tenant.ownerEmail,
    status: "FAILURE",
    details: {
      amount: invoice.amount_due,
      currency: invoice.currency,
      reason: invoice.failure_reason || "unspecified",
    },
  });

  if (tenant.name && tenant.ownerEmail) {
    const { subject, html } = paymentFailedEmail({
      name: tenant.name,
      plan: tenant.plan,
    });
    await safeSendEmail(tenant.ownerEmail, subject, html);
  }

  console.log(`[Stripe Webhook] invoice.payment_failed: ${invoice.id} → PAST_DUE`);
};

/* ───────────────────────────────────────────────────────────────────────
 *  customer.subscription.created / updated
 * ─────────────────────────────────────────────────────────────────────── */
const syncSubscriptionState = async (
  subscription: Stripe.Subscription,
  eventType: string
) => {
  const status = mapSubscriptionStatus(subscription.status);
  const plan = priceToPlan(subscription.items.data[0]?.price?.id);
  const customerId = asId(subscription.customer);

  // These events can arrive before checkout.session.completed, so the tenant
  // may not have `subscriptionId` stored yet — resolve via subscription OR
  // customer id.
  const tenant =
    (await getTenantBySubscriptionId(subscription.id)) ??
    (await getTenantByCustomerId(customerId));

  if (!tenant) {
    console.log(
      `[Stripe Webhook] ${eventType} for unknown tenant (subscription ${subscription.id}) — skipping`
    );
    return;
  }

  const tenantUpdate: Record<string, any> = {
    subscriptionId: subscription.id,
    subscriptionStatus: status,
  };
  if (status === SubscriptionStatus.CANCELED) {
    tenantUpdate.plan = Plan.FREE;
    tenantUpdate.pendingPlan = null;
  } else if (
    plan &&
    (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL)
  ) {
    tenantUpdate.plan = plan;
    tenantUpdate.pendingPlan = null;
  }

  await withTransaction(async (s) => {
    await Tenant.updateOne(
      { _id: toObjectId(tenant.id) },
      { $set: tenantUpdate },
      { session: s }
    );

    // Maintain the subscription lifecycle ledger row so the superadmin
    // "active subscriptions" metric stays accurate (distinct sub IDs).
    if (
      status === SubscriptionStatus.ACTIVE ||
      status === SubscriptionStatus.TRIAL
    ) {
      const activePlan = plan ?? tenant.plan;
      await Billing.updateOne(
        {
          tenantId: toObjectId(tenant.id),
          stripeSubscriptionId: subscription.id,
          type: BillingType.SUBSCRIPTION,
        },
        {
          $set: {
            status: BillingStatus.ACTIVE,
            plan: activePlan,
            stripeCustomerId: customerId,
            description: `Subscription active (${activePlan} plan)`,
          },
          $setOnInsert: {
            previousPlan: tenant.plan,
            amount: 0,
            currency: "usd",
          },
        },
        { upsert: true, session: s }
      );
    }
  });

  const action =
    status === SubscriptionStatus.CANCELED
      ? AuditAction.SUBSCRIPTION_CANCELED
      : status === SubscriptionStatus.PAST_DUE
        ? AuditAction.PAYMENT_FAILED
        : status === SubscriptionStatus.ACTIVE ||
            status === SubscriptionStatus.TRIAL
          ? AuditAction.SUBSCRIPTION_RENEWED
          : AuditAction.PLAN_CHANGE;

  await buildAudit({
    action,
    resource: "subscription",
    resourceId: subscription.id,
    tenantId: tenant.id,
    ownerEmail: tenant.ownerEmail,
    status: "SUCCESS",
    details: {
      stripeStatus: subscription.status,
      status,
      plan,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    },
  });

  console.log(`[Stripe Webhook] ${eventType}: ${subscription.id} → ${status} (tenant ${tenant.id})`);
};

const handleSubscriptionCreated = (subscription: Stripe.Subscription) =>
  syncSubscriptionState(subscription, "customer.subscription.created");

const handleSubscriptionUpdated = (subscription: Stripe.Subscription) =>
  syncSubscriptionState(subscription, "customer.subscription.updated");

/* ───────────────────────────────────────────────────────────────────────
 *  customer.subscription.deleted
 * ─────────────────────────────────────────────────────────────────────── */
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  const tenant = await getTenantBySubscriptionId(subscription.id);
  if (!tenant) {
    console.log(`[Stripe Webhook] customer.subscription.deleted for unknown tenant (${subscription.id}) — skipping`);
    return;
  }

  await withTransaction(async (s) => {
    await Tenant.updateOne(
      { _id: toObjectId(tenant.id) },
      {
        $set: {
          plan: Plan.FREE,
          subscriptionId: null,
          subscriptionStatus: SubscriptionStatus.CANCELED,
          pendingPlan: null,
        },
      },
      { session: s }
    );

    await Billing.updateMany(
      { tenantId: toObjectId(tenant.id), stripeSubscriptionId: subscription.id },
      { $set: { status: BillingStatus.CANCELED } },
      { session: s }
    );

    await Billing.create(
      [
        {
          tenantId: toObjectId(tenant.id),
          plan: Plan.FREE,
          previousPlan: tenant.plan,
          type: BillingType.SUBSCRIPTION,
          status: BillingStatus.CANCELED,
          amount: 0,
          currency: "usd",
          description: "Subscription canceled — reverted to FREE",
          stripeSubscriptionId: subscription.id,
        },
      ],
      { session: s }
    );
  });

  await buildAudit({
    action: AuditAction.SUBSCRIPTION_CANCELED,
    resource: "subscription",
    resourceId: subscription.id,
    tenantId: tenant.id,
    ownerEmail: tenant.ownerEmail,
    status: "SUCCESS",
    details: { previousPlan: tenant.plan },
  });

  if (tenant.name && tenant.ownerEmail) {
    const { subject, html } = subscriptionCanceledEmail({
      name: tenant.name,
      plan: tenant.plan,
    });
    await safeSendEmail(tenant.ownerEmail, subject, html);
  }

  console.log(`[Stripe Webhook] customer.subscription.deleted: ${subscription.id} → CANCELED`);
};

/* ───────────────────────────────────────────────────────────────────────
 *  Public dispatcher
 * ─────────────────────────────────────────────────────────────────────── */
export const webhookHandlers = {
  async handle(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "checkout.session.expired":
        await handleCheckoutSessionExpired(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as StripeInvoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as StripeInvoice);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  },
};
