import { Router } from "express";
import { fileControllers } from "./file.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { fileParamSchema, updateFileSchema, uploadFileSchema } from "./file.validate";
import validateRequest from "../../middlewares/validateRequest";
import { validateFileUpload } from "../../middlewares/plan.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { tenantMiddleware } from "../../middlewares/tenant.middleware";


const fileRoute = Router();

fileRoute.post(
  "/",
  authMiddleware,
  tenantMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(uploadFileSchema),
  validateFileUpload,
  fileControllers.createFile
);

fileRoute.get("/", authMiddleware,tenantMiddleware, fileControllers.getFiles);

fileRoute.get(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(fileParamSchema),
  fileControllers.getFileById
);

fileRoute.patch(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(updateFileSchema),
  fileControllers.updateFile
);

fileRoute.delete(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(fileParamSchema),
  fileControllers.deleteFile
);

export default fileRoute;