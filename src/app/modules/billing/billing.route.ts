import { Router } from "express";
import { billingControllers } from "./billing.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";

const billingRoute = Router();

billingRoute.post("/subscribe",authMiddleware,roleMiddleware("ADMIN"), billingControllers.create)
export default billingRoute; 