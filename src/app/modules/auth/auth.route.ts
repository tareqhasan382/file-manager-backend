import { Router } from "express";
import { authControllers } from "./auth.controller";

const authRoute = Router();
authRoute.post("/signup", authControllers.register);
authRoute.post("/sigin", authControllers.login);
export default authRoute; 