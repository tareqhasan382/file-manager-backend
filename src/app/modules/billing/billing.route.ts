import { Router } from "express";
import { billingControllers } from "./billing.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const billingRoute = Router();

billingRoute.post("/subscribe", authMiddleware, billingControllers.create)
export default billingRoute; 