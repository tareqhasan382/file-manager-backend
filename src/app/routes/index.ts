import express from "express";
import authRoute from "../modules/auth/auth.route";

const router = express.Router();

router.use("/auth", authRoute);


export default router;