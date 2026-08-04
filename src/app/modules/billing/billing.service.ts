import { stripe } from "../../../lib/stripe";
import config from "../../../config";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { User } from "../../../models/User";
import { Tenant } from "../../../models/Tenant";
import { Billing, BillingStatus, BillingType } from "../../../models/Billing";
import { Plan, SubscriptionStatus } from "../../enums";
import { withTransaction } from "../../../utils/transaction";
import { AuditAction, logAudit, type AuditContext } from "../../middlewares/audit.middleware";
import {
  asId,
  mapSubscriptionStatus,
  priceToPlan,
  toObjectId,
} from "./webhook.service";

const createBilling = async ({
  userId,
  plan,
  auditCtx,
}: {
  userId: string;
  plan: string;
  auditCtx?: AuditContext;
}) => {
  // ─── Fetch user + tenant ───────────────────────────────
  const user = await User.findById(userId).select("email role tenantId").lean();
  if (!user) throw new AppError("User not found", httpStatus.NOT_FOUND);

  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) throw new AppError("Tenant not found", httpStatus.NOT_FOUND);

  const tenantId = tenant._id.toString();

  // ─── FREE plan ────────────────────────────────────────
  if (plan === Plan.FREE) {
    const result = await withTransaction(async (session) => {
      if (tenant.subscriptionId) {
        try {
          await stripe.subscriptions.cancel(tenant.subscriptionId);
        } catch (err) {
          console.error("Failed to cancel Stripe subscription:", err);
        }
      }

      await Tenant.updateOne(
        { _id: tenant._id },
        {
          $set: {
            plan: Plan.FREE,
            subscriptionStatus: SubscriptionStatus.CANCELED,
            subscriptionId: null,
            pendingPlan: null,
          },
        },
        { session }
      );

      await Billing.create(
        [
          {
            tenantId,
            plan: Plan.FREE,
            type: BillingType.SUBSCRIPTION,
            status: BillingStatus.ACTIVE,
            amount: 0,
            currency: "usd",
            description: "Free plan activated",
            stripeCustomerId: tenant.stripeCustomerId,
          },
        ],
        { session }
      );

      return { message: "Free plan activated" };
    });

    await logAudit({
      actorId: auditCtx?.actorId || userId,
      actorEmail: auditCtx?.actorEmail || user.email,
      actorRole: auditCtx?.actorRole || user.role,
      tenantId,
      ipAddress: auditCtx?.ipAddress || "api",
      userAgent: auditCtx?.userAgent || "",
      action: AuditAction.SUBSCRIPTION_CREATED,
      resource: "subscription",
      status: "SUCCESS",
      details: { plan: Plan.FREE },
    });

    return result;
  }

  // ─── Plan → Price mapping ─────────────────────────────
  const priceMap: Record<string, string> = {
    [Plan.SILVER]: config.stripe.plans.silver,
    [Plan.GOLD]: config.stripe.plans.gold,
    [Plan.DIAMOND]: config.stripe.plans.diamond,
  };
  const priceId = priceMap[plan];
  if (!priceId) throw new AppError("Invalid plan", httpStatus.BAD_REQUEST);

  // ─── Create Stripe customer if needed ────────────────
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: tenant.name,
    });
    customerId = customer.id;

    await Tenant.updateOne(
      { _id: tenant._id },
      { $set: { stripeCustomerId: customerId } }
    );
  }

  // ─── Create checkout session ─────────────────────────
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: tenantId,
    metadata: { tenantId, plan },
    subscription_data: { metadata: { tenantId, plan } },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.frontend_url || "http://localhost:5173"}/success`,
    cancel_url: `${config.frontend_url || "http://localhost:5173"}/cancel`,
  });

  // ─── Persist the pending checkout in the billing ledger ──
  // The tenant keeps its current plan/status until Stripe confirms the
  // payment via the checkout.session.completed webhook (which flips the
  // plan + sets ACTIVE). `pendingPlan` tracks what's being purchased.
  const previousPlan = tenant.plan;
  await withTransaction(async (session) => {
    await Tenant.updateOne(
      { _id: tenant._id },
      {
        $set: {
          pendingPlan: plan as Plan,
        },
      },
      { session }
    );

    await Billing.create(
      [
        {
          tenantId,
          plan,
          previousPlan,
          type: BillingType.CHECKOUT,
          status: BillingStatus.PENDING,
          amount: checkoutSession.amount_total ?? 0,
          currency: checkoutSession.currency ?? "usd",
          description: `Checkout initiated for the ${plan} plan`,
          stripeCustomerId: customerId,
          stripeCheckoutId: checkoutSession.id,
        },
      ],
      { session }
    );
  });

  await logAudit({
    actorId: auditCtx?.actorId || userId,
    actorEmail: auditCtx?.actorEmail || user.email,
    actorRole: auditCtx?.actorRole || user.role,
    tenantId,
    ipAddress: auditCtx?.ipAddress || "api",
    userAgent: auditCtx?.userAgent || "",
    action: AuditAction.SUBSCRIPTION_CREATED,
    resource: "subscription",
    resourceId: checkoutSession.id,
    status: "SUCCESS",
    details: { plan, amount: checkoutSession.amount_total, type: "checkout_initiated" },
  });

  return { url: checkoutSession.url };
};

// ─── Get Billing History (tenant's own ledger) ─────────────────────────────────
const getBillingHistory = async (
  tenantId: string,
  page = 1,
  limit = 20,
  filters: { status?: string; type?: string } = {}
) => {
  const skip = Math.max((Number(page) - 1) * Number(limit), 0);
  const lim = Math.max(Math.min(Number(limit), 100), 1);

  const query: Record<string, any> = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;

  const [records, total] = await Promise.all([
    Billing.find(query)
      .populate("tenantId", "name plan")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    Billing.countDocuments(query),
  ]);

  return {
    records,
    meta: {
      page: Number(page),
      limit: lim,
      total,
      pages: Math.ceil(total / lim),
    },
  };
};

const getBillingById = async (id: string, tenantId: string) => {
  const record = await Billing.findOne({ _id: id, tenantId }).lean();
  if (!record) {
    throw new AppError("Billing record not found", httpStatus.NOT_FOUND);
  }
  return record;
};

// ─── Live Subscription Status (used by the frontend to sync after payment) ─────
//
// Belt-and-suspenders with webhooks: if the tenant is still INCOMPLETE /
// has a pendingPlan but the Stripe side shows a completed subscription
// (webhook was missed, delayed, or never delivered), reconcile directly
// against the Stripe API so the DB self-heals.
const reconcileFromStripe = async (tenantId: string) => {
  const tenant = await Tenant.findById(tenantId)
    .select("plan subscriptionStatus pendingPlan stripeCustomerId subscriptionId")
    .lean();
  if (!tenant) return null;
  if (!tenant.stripeCustomerId) return tenant;

  try {
    const { data: subscriptions } = await stripe.subscriptions.list({
      customer: tenant.stripeCustomerId,
      status: "all",
      limit: 10,
    });

    const current =
      subscriptions.find(
        (s) => s.status === "active" || s.status === "trialing"
      ) ?? subscriptions[0];

    if (current) {
      const status = mapSubscriptionStatus(current.status);
      const plan =
        priceToPlan(current.items.data[0]?.price?.id) ??
        (tenant.pendingPlan as Plan | null) ??
        tenant.plan ??
        Plan.FREE;

      const subscriptionId = asId(current.id);
      const needsRepair =
        tenant.subscriptionId !== subscriptionId ||
        tenant.subscriptionStatus !== status ||
        tenant.plan !== plan ||
        tenant.pendingPlan !== null;

      if (needsRepair) {
        await withTransaction(async (s) => {
          await Tenant.updateOne(
            { _id: tenant._id },
            {
              $set: {
                subscriptionId,
                subscriptionStatus: status,
                plan,
                pendingPlan: null,
              },
            },
            { session: s }
          );

          // Flip any lingering PENDING checkout to its final state.
          await Billing.updateMany(
            { tenantId: tenant._id, type: BillingType.CHECKOUT, status: BillingStatus.PENDING },
            {
              $set: {
                status:
                  status === SubscriptionStatus.ACTIVE ||
                  status === SubscriptionStatus.TRIAL
                    ? BillingStatus.COMPLETED
                    : BillingStatus.CANCELED,
                stripeSubscriptionId: subscriptionId,
                paidAt:
                  status === SubscriptionStatus.ACTIVE ||
                  status === SubscriptionStatus.TRIAL
                    ? new Date()
                    : null,
              },
            },
            { session: s }
          );

          // Maintain the subscription ledger row for superadmin stats.
          if (
            status === SubscriptionStatus.ACTIVE ||
            status === SubscriptionStatus.TRIAL
          ) {
            await Billing.updateOne(
              {
                tenantId: tenant._id,
                stripeSubscriptionId: subscriptionId,
                type: BillingType.SUBSCRIPTION,
              },
              {
                $set: {
                  status: BillingStatus.ACTIVE,
                  plan,
                  stripeCustomerId: tenant.stripeCustomerId,
                  description: `Subscription active (${plan} plan)`,
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

        console.log(
          `[Billing] Reconciled tenant ${tenantId} from Stripe: ${status} (${plan}) — subscription ${subscriptionId}`
        );
      }

      return {
        plan,
        subscriptionStatus: status,
        pendingPlan: null,
        stripeCustomerId: tenant.stripeCustomerId,
        subscriptionId,
        latestRecords: [],
      };
    }
  } catch (err: any) {
    console.error(
      `[Billing] Stripe reconciliation failed for tenant ${tenantId}:`,
      err.message
    );
  }

  return null;
};

const getSubscriptionStatus = async (tenantId: string) => {
  const tenant = await Tenant.findById(tenantId)
    .select("plan subscriptionStatus pendingPlan stripeCustomerId subscriptionId")
    .lean();

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  // Reconcile against Stripe when the local state suggests an unresolved
  // checkout (missed webhook) so the subscription self-heals.
  const reconciled = await reconcileFromStripe(tenantId);

  const latest = await Billing.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const state = reconciled ?? tenant;

  return {
    plan: state.plan,
    subscriptionStatus: state.subscriptionStatus ?? null,
    pendingPlan: state.pendingPlan ?? null,
    stripeCustomerId: state.stripeCustomerId ?? null,
    subscriptionId: state.subscriptionId ?? null,
    latestRecords: latest,
  };
};

export const billingServices = {
  createBilling,
  getBillingHistory,
  getBillingById,
  getSubscriptionStatus,
};
