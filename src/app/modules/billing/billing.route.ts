import { Router } from "express";
import { billingControllers } from "./billing.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import validateRequest from "../../middlewares/validateRequest";
import { z } from "zod";
import { zodObjectId } from "../../../shared/zod/objectId";
import { Plan } from "../../enums";

const billingRoute = Router();

// Start a Stripe Checkout for a paid plan (or activate FREE immediately).
// Only the tenant OWNER may subscribe.
billingRoute.post(
  "/subscribe",
  authMiddleware,
  roleMiddleware("OWNER"),
  validateRequest(
    z.object({
      body: z.object({
        plan: z.enum(Object.values(Plan) as [string, ...string[]]),
      }),
    })
  ),
  billingControllers.create
);

// Tenant's own subscription status (used to sync the dashboard after payment)
billingRoute.get(
  "/subscription",
  authMiddleware,
  roleMiddleware("OWNER", "ADMIN", "MEMBER"),
  billingControllers.getSubscription
);

// Tenant's own billing ledger (OWNER/ADMIN/MEMBER)
billingRoute.get(
  "/history",
  authMiddleware,
  roleMiddleware("OWNER", "ADMIN", "MEMBER"),
  validateRequest(
    z.object({
      query: z.object({
        page: z.string().regex(/^\d+$/).optional(),
        limit: z.string().regex(/^\d+$/).optional(),
        status: z.string().optional(),
        type: z.string().optional(),
      }),
    })
  ),
  billingControllers.getHistory
);

// Tenant's own billing record detail (OWNER/ADMIN/MEMBER)
billingRoute.get(
  "/history/:id",
  authMiddleware,
  roleMiddleware("OWNER", "ADMIN", "MEMBER"),
  validateRequest(z.object({ params: z.object({ id: zodObjectId }) })),
  billingControllers.getBillingById
);

export default billingRoute;
