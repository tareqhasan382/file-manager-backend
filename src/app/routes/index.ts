import express from "express";
import authRoute from "../modules/auth/auth.route";
import billingRoute from "../modules/billing/billing.route";


const router = express.Router();

router.use("/auth", authRoute);
router.use("/billing",billingRoute );


export default router;