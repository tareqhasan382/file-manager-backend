import { Router } from "express";
import { stripeWebhook } from "../billing/stripe.webhook";


const router = Router();

router.post(
  "/stripe",
  stripeWebhook
);

export default router;