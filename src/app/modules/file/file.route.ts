import { Router } from "express";
import { fileControllers } from "./file.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { fileParamSchema, updateFileSchema, uploadFileSchema } from "./file.validate";
import validateRequest from "../../middlewares/validateRequest";


const fileRoute = Router();

fileRoute.post(
  "/",
  authMiddleware,
  validateRequest(uploadFileSchema),
  fileControllers.createFile
);

fileRoute.get("/", authMiddleware, fileControllers.getFiles);

fileRoute.get(
  "/:id",
  authMiddleware,
  validateRequest(fileParamSchema),
  fileControllers.getFileById
);

fileRoute.patch(
  "/:id",
  authMiddleware,
  validateRequest(updateFileSchema),
  fileControllers.updateFile
);

fileRoute.delete(
  "/:id",
  authMiddleware,
  validateRequest(fileParamSchema),
  fileControllers.deleteFile
);

export default fileRoute;