import { Router } from "express";
import { memberControllers } from "./member.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validateRequest";
import { createMemberSchema, memberParamSchema } from "./member.validation";
import { roleMiddleware } from "../../middlewares/role.middleware";

const memberRoute = Router();

// GET /api/v1/tenant/members — OWNER only
memberRoute.get(
  "/",
  authMiddleware,
  roleMiddleware("OWNER"),
  memberControllers.getMembers
);

// POST /api/v1/tenant/members — OWNER only
memberRoute.post(
  "/",
  authMiddleware,
  roleMiddleware("OWNER"),
  validateRequest(createMemberSchema),
  memberControllers.createMember
);

// DELETE /api/v1/tenant/members/:id — OWNER only
memberRoute.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("OWNER"),
  validateRequest(memberParamSchema),
  memberControllers.deleteMember
);

export default memberRoute;