import { Router } from "express";
import { auditLogControllers } from "./auditlog.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import validateRequest from "../../middlewares/validateRequest";
import { auditLogQuerySchema } from "./auditlog.validation";

const auditLogRoute = Router();

auditLogRoute.use(authMiddleware, roleMiddleware("SUPER_ADMIN"));

auditLogRoute.get(
  "/",
  validateRequest(auditLogQuerySchema),
  auditLogControllers.getAllAuditLogs
);

export default auditLogRoute;
