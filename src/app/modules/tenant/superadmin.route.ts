import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { superAdminControllers } from "./superadmin.controller";
import validateRequest from "../../middlewares/validateRequest";
import { changePlanSchema, tenantParamSchema } from "./superadmin.validation";

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

export default superAdminRoute;