import { Schema, model, models, Model } from "mongoose";
import { applyDocSerializer } from "../shared/utils/docSerializer";

export interface WebhookEventDoc {
  // Stripe's unique event id (evt_xxx) — dedupes Stripe retries.
  eventId: string;
  type: string;
  status: "PROCESSED" | "FAILED";
  error?: string;
  receivedAt: Date;
  processedAt: Date;
}

const webhookEventSchema = new Schema<WebhookEventDoc>(
  {
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["PROCESSED", "FAILED"],
      default: "PROCESSED",
      index: true,
    },
    error: { type: String, default: null },
    receivedAt: { type: Date, default: () => new Date() },
    processedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

webhookEventSchema.index({ type: 1, processedAt: -1 });

applyDocSerializer(webhookEventSchema);

export const WebhookEvent =
  (models.WebhookEvent as Model<WebhookEventDoc>) ||
  model<WebhookEventDoc>("WebhookEvent", webhookEventSchema);
