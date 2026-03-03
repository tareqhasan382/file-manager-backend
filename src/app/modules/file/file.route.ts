import { Router } from "express";
import { fileControllers } from "./file.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { fileParamSchema, updateFileSchema, uploadFileSchema } from "./file.validate";
import validateRequest from "../../middlewares/validateRequest";
import { validateFileUpload } from "../../middlewares/plan.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";


const fileRoute = Router();

fileRoute.post(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(uploadFileSchema),
  validateFileUpload,
  fileControllers.createFile
);

fileRoute.get("/", authMiddleware, fileControllers.getFiles);

fileRoute.get(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(fileParamSchema),
  fileControllers.getFileById
);

fileRoute.patch(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(updateFileSchema),
  fileControllers.updateFile
);

fileRoute.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(fileParamSchema),
  fileControllers.deleteFile
);

export default fileRoute;