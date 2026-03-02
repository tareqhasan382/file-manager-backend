import express from "express";
import authRoute from "../modules/auth/auth.route";
import billingRoute from "../modules/billing/billing.route";
import folderRoute from "../modules/folder/folder.route";
import fileRoute from "../modules/file/file.route";
import userRoute from "../modules/user/user.route";
import memberRoute from "../modules/member/member.route";


const router = express.Router();

router.use("/auth", authRoute);
router.use("/user",userRoute);
router.use("/tenant/members", memberRoute);
router.use("/billing",billingRoute );
router.use("/folder",folderRoute );
router.use("/files",fileRoute );


export default router;