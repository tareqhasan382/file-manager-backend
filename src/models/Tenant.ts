import { Schema, model, models, Types, Model } from "mongoose";
import { Plan, SubscriptionStatus } from "../app/enums";
import { softDeletePlugin, SoftDeleteDocument } from "../shared/plugins/softDelete";
import { applyDocSerializer } from "../shared/utils/docSerializer";

export interface TenantDoc extends SoftDeleteDocument {
  name: string;
  plan: (typeof Plan)[keyof typeof Plan];
  isBanned: boolean;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus] | null;
  // Plan the tenant is trying to buy but has not paid for yet. Set when a
  // Stripe Checkout session is created and cleared once the payment succeeds
  // or the checkout expires/cancels.
  pendingPlan: (typeof Plan)[keyof typeof Plan] | null;
  storageUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantDoc>(
  {
    name: { type: String, required: true, trim: true },
    plan: {
      type: String,
      enum: Object.values(Plan),
      default: Plan.FREE,
      index: true,
    },
    isBanned: { type: Boolean, default: false, index: true },
    stripeCustomerId: { type: String, default: null },
    subscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: null,
    },
    pendingPlan: {
      type: String,
      enum: Object.values(Plan),
      default: null,
    },
    storageUsed: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

tenantSchema.plugin(softDeletePlugin);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Lookups by ban status + plan (superadmin dashboard / filtering)
tenantSchema.index({ isBanned: 1, plan: 1 });
// Stripe linkage must be unique, but a tenant may not have one yet.
// A partial (not sparse) index is required: sparse unique indexes still
// reject explicit `null` values, and the schema defaults these to null.
tenantSchema.index(
  { stripeCustomerId: 1 },
  { unique: true, partialFilterExpression: { stripeCustomerId: { $type: "string" } } }
);
tenantSchema.index(
  { subscriptionId: 1 },
  { unique: true, partialFilterExpression: { subscriptionId: { $type: "string" } } }
);

applyDocSerializer(tenantSchema);

export const Tenant =
  (models.Tenant as Model<TenantDoc>) ||
  model<TenantDoc>("Tenant", tenantSchema);
