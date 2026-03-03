import { Router } from "express";
import { userControllers } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";

const userRoute = Router();

userRoute.get("/me", authMiddleware, tenantMiddleware,roleMiddleware("ADMIN", "OWNER", "MEMBER"), userControllers.getMe);

export default userRoute;