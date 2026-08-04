import { stripe } from "../../../lib/stripe";
import config from "../../../config";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { User } from "../../../models/User";
import { Tenant } from "../../../models/Tenant";
import { Billing, BillingStatus, BillingType } from "../../../models/Billing";
import { Plan, SubscriptionStatus } from "../../enums";
import { withTransaction } from "../../../utils/transaction";

const createBilling = async ({
  userId,
  plan,
}: {
  userId: string;
  plan: string;
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
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/success`,
    cancel_url: `${process.env.FRONTEND_URL}/cancel`,
  });

  // ─── Persist the pending checkout in the billing ledger ──
  // The tenant plan is optimistically set to the new plan (INCOMPLETE) so the
  // account reflects the upgrade immediately. If the user abandons checkout,
  // the `checkout.session.expired` webhook reverts the tenant to its previous
  // plan; if they pay, `checkout.session.completed` flips it to ACTIVE.
  const previousPlan = tenant.plan;
  await withTransaction(async (session) => {
    await Tenant.updateOne(
      { _id: tenant._id },
      {
        $set: {
          plan: plan as Plan,
          subscriptionStatus: SubscriptionStatus.INCOMPLETE,
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

  return { url: checkoutSession.url };
};

// ─── Get Billing History (tenant's own ledger) ─────────────────────────────────
const getBillingHistory = async (tenantId: string) => {
  return Billing.find({ tenantId }).sort({ createdAt: -1 });
};

export const billingServices = { createBilling, getBillingHistory };
