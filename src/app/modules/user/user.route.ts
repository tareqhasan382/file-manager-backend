import { Router } from "express";
import { userControllers } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const userRoute = Router();

userRoute.get("/me", authMiddleware, userControllers.getMe);

export default userRoute;