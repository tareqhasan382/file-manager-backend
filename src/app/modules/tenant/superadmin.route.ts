import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { superAdminControllers } from "./superadmin.controller";
import validateRequest from "../../middlewares/validateRequest";
import { changePlanSchema, tenantParamSchema, userSchema } from "./superadmin.validation";

const superAdminRoute = Router();

// Apply authMiddleware + SUPER_ADMIN role to all routes
superAdminRoute.use(authMiddleware, roleMiddleware("SUPER_ADMIN"));

// ─── Stats ────────────────────────────────────────────────────────────────────
superAdminRoute.get("/stats", superAdminControllers.getStats);

// ─── Tenants ──────────────────────────────────────────────────────────────────
superAdminRoute.get("/tenants", superAdminControllers.getAllTenants);

superAdminRoute.get(
  "/tenants/:id",
  validateRequest(tenantParamSchema),
  superAdminControllers.getTenantById
);

superAdminRoute.get(
  "/tenants/:id/billing",
  validateRequest(tenantParamSchema),
  superAdminControllers.getTenantBilling
);

superAdminRoute.put(
  "/tenants/:id/ban",
  validateRequest(tenantParamSchema),
  superAdminControllers.toggleBanTenant
);

superAdminRoute.put(
  "/tenants/:id/plan",
  validateRequest(changePlanSchema),
  superAdminControllers.changeTenantPlan
);

// ─── Users ────────────────────────────────────────────────────────────────────
superAdminRoute.get("/users", superAdminControllers.getAllUsers);

superAdminRoute.get(
  "/users/:id",
  validateRequest(userSchema),
  superAdminControllers.getUserDetail
);

// ─── Billing Ledger ───────────────────────────────────────────────────────────
superAdminRoute.get("/billing", superAdminControllers.getAllBilling);

// ─── Audit Log ────────────────────────────────────────────────────────────────
superAdminRoute.get("/audit-logs", superAdminControllers.getAuditLogs);

export default superAdminRoute;
