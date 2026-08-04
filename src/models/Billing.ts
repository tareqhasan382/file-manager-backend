import { Schema, model, models, Types, Model } from "mongoose";
import { Plan } from "../app/enums";
import { applyDocSerializer } from "../shared/utils/docSerializer";

export const BillingType = {
  CHECKOUT: "CHECKOUT",
  PAYMENT: "PAYMENT",
  SUBSCRIPTION: "SUBSCRIPTION",
} as const;

export const BillingStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  COMPLETED: "COMPLETED",
  ACTIVE: "ACTIVE",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
} as const;

export interface BillingDoc {
  tenantId: Types.ObjectId;
  plan: (typeof Plan)[keyof typeof Plan];
  previousPlan: (typeof Plan)[keyof typeof Plan] | null;
  type: (typeof BillingType)[keyof typeof BillingType];
  status: (typeof BillingStatus)[keyof typeof BillingStatus];
  amount: number; // in cents
  currency: string;
  description: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCheckoutId: string | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  transactionId: string | null;
  invoiceUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const billingSchema = new Schema<BillingDoc>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: Object.values(Plan),
      required: true,
      index: true,
    },
    // The plan the tenant was on before this event (used to revert an
    // abandoned/expired checkout back to the previous plan).
    previousPlan: {
      type: String,
      enum: Object.values(Plan),
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(BillingType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(BillingStatus),
      required: true,
      index: true,
    },
    amount: { type: Number, default: 0, min: 0 }, // cents
    currency: { type: String, default: "usd" },
    description: { type: String, default: "" },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null, index: true },
    stripeCheckoutId: { type: String, default: null },
    stripeInvoiceId: { type: String, default: null, index: true },
    stripePaymentIntentId: { type: String, default: null, index: true },
    stripeChargeId: { type: String, default: null },
    transactionId: { type: String, default: null, index: true },
    invoiceUrl: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Tenant billing history (dashboard + owner history) newest-first
billingSchema.index({ tenantId: 1, createdAt: -1 });
// Global history for the superadmin dashboard
billingSchema.index({ createdAt: -1 });
// Idempotency: a Stripe checkout/invoice should only ever be recorded once
billingSchema.index(
  { stripeCheckoutId: 1 },
  { unique: true, partialFilterExpression: { stripeCheckoutId: { $type: "string" } } }
);
billingSchema.index(
  { stripeInvoiceId: 1 },
  { unique: true, partialFilterExpression: { stripeInvoiceId: { $type: "string" } } }
);
billingSchema.index(
  { transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: "string" } } }
);

applyDocSerializer(billingSchema);

export const Billing =
  (models.Billing as Model<BillingDoc>) ||
  model<BillingDoc>("Billing", billingSchema);
