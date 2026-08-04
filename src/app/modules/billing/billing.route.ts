import { Router } from "express";
import { billingControllers } from "./billing.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";

const billingRoute = Router();

billingRoute.post("/subscribe", authMiddleware, billingControllers.create);

// Tenant's own billing ledger (OWNER/ADMIN/MEMBER)
billingRoute.get(
  "/history",
  authMiddleware,
  roleMiddleware("OWNER", "ADMIN", "MEMBER"),
  billingControllers.getHistory
);

export default billingRoute;