import { Router } from "express";
import { authControllers } from "./auth.controller";
import validateRequest from "../../middlewares/validateRequest";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";

const authRoute = Router();
authRoute.post("/signup", validateRequest(registerSchema), authControllers.register);
authRoute.post("/sigin", validateRequest(loginSchema), authControllers.login);
authRoute.post("/verify-otp", validateRequest(verifyOtpSchema), authControllers.verifyOtp);
authRoute.post("/resend-otp", validateRequest(resendOtpSchema), authControllers.resendOtp);
authRoute.post("/forgot-password", validateRequest(forgotPasswordSchema), authControllers.forgotPassword);
authRoute.post("/reset-password", validateRequest(resetPasswordSchema), authControllers.resetPassword);
authRoute.post("/logout", authMiddleware, authControllers.logout);
authRoute.get("/me", authMiddleware, authControllers.getMe);
export default authRoute;
