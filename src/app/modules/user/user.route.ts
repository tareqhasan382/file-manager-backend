import { Router } from "express";
import { userControllers } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";
import validateRequest from "../../middlewares/validateRequest";
import { updateProfileSchema, changePasswordSchema } from "./user.validation";

const userRoute = Router();

userRoute.get(
  "/me",
  authMiddleware,
  tenantMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  userControllers.getMe
);

userRoute.patch(
  "/profile",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(updateProfileSchema),
  userControllers.updateProfile
);

userRoute.patch(
  "/password",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(changePasswordSchema),
  userControllers.changePassword
);

export default userRoute;
