import { Router } from "express";
import { authControllers } from "./auth.controller";
import validateRequest from "../../middlewares/validateRequest";
import { loginSchema, registerSchema } from "./auth.validation";

const authRoute = Router();
authRoute.post("/signup",validateRequest(registerSchema), authControllers.register);
authRoute.post("/sigin",validateRequest(loginSchema), authControllers.login);
export default authRoute; 