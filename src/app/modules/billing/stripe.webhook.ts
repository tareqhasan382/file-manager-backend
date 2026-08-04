import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../../../lib/stripe";
import config from "../../../config";
import { WebhookEvent } from "../../../models/WebhookEvent";
import { webhookHandlers } from "./webhook.service";
import { AuditAction, logAudit } from "../../middlewares/audit.middleware";

const getIpAddress = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
};

/**
 * Stripe webhook entry point.
 *
 * 1. Verifies the signature against the raw request body.
 * 2. Deduplicates deliveries using the Stripe event id (idempotency).
 * 3. Dispatches to the transactional handlers in `webhook.service.ts`.
 *
 * Always returns 200 for successfully *verified* events (even unhandled
 * types) so Stripe stops retrying. Non-2xx responses make Stripe retry.
 */
export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).send("Missing stripe-signature");
  }

  if (typeof req.body !== "string" && !Buffer.isBuffer(req.body)) {
    return res.status(400).send("Request body must be a raw string/Buffer");
  }

  // ── 1. Signature verification ────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      config.stripe.webhookSecret
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    await logAudit({
      action: AuditAction.PAYMENT_FAILED,
      resource: "billing",
      details: {
        error: "Webhook signature verification failed",
        message: err.message,
      },
      status: "FAILURE",
      actorEmail: "system",
      actorRole: "SYSTEM",
      ipAddress: getIpAddress(req),
      userAgent: req.get("User-Agent") || "",
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── 2. Idempotency: skip deliveries we've already processed ──────────
  try {
    const processed = await WebhookEvent.findOne({
      eventId: event.id,
      status: "PROCESSED",
    }).lean();
    if (processed) {
      console.log(
        `[Stripe Webhook] Duplicate event ${event.id} (${event.type}) — already processed, skipping`
      );
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch (err: any) {
    console.error("[Stripe Webhook] Idempotency check failed:", err.message);
    return res.status(500).send("Internal Server Error");
  }

  // ── 3. Process event ─────────────────────────────────────────────────
  try {
    await webhookHandlers.handle(event);

    await WebhookEvent.updateOne(
      { eventId: event.id },
      {
        $set: {
          eventId: event.id,
          type: event.type,
          status: "PROCESSED",
          processedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`[Stripe Webhook] Processed ${event.type} (${event.id})`);
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(
      `[Stripe Webhook] Failed to process ${event.type} (${event.id}):`,
      err
    );

    // Record the failure so we can inspect it, but do NOT mark it processed —
    // Stripe's automatic retries will re-attempt the event.
    try {
      await WebhookEvent.updateOne(
        { eventId: event.id },
        {
          $set: {
            eventId: event.id,
            type: event.type,
            status: "FAILED",
            error: err?.message ?? String(err),
            processedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (err2: any) {
      console.error("[Stripe Webhook] Failed to record event failure:", err2);
    }

    await logAudit({
      action: AuditAction.PAYMENT_FAILED,
      resource: "billing",
      details: {
        error: "Webhook event processing error",
        eventType: event.type,
        eventId: event.id,
        message: err?.message ?? String(err),
      },
      status: "FAILURE",
      actorEmail: "system",
      actorRole: "SYSTEM",
      ipAddress: getIpAddress(req),
      userAgent: req.get("User-Agent") || "",
    });

    res.status(500).send("Internal Server Error");
  }
};
