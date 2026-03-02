import { Router } from "express";
import { folderControllers } from "./folder.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validateRequest";
import { createFolderSchema, folderParamSchema, updateFolderSchema } from "./folder.validation";

const folderRoute = Router();

folderRoute.post(
  "/",
  authMiddleware,
  validateRequest(createFolderSchema),
  folderControllers.createFolder
);

folderRoute.get("/", authMiddleware, folderControllers.getFolders);

folderRoute.get(
  "/:id",
  authMiddleware,
  validateRequest(folderParamSchema),
  folderControllers.getFolderById
);

folderRoute.patch(
  "/:id",
  authMiddleware,
  validateRequest(updateFolderSchema),
  folderControllers.updateFolder
);

folderRoute.delete(
  "/:id",
  authMiddleware,
  validateRequest(folderParamSchema),
  folderControllers.deleteFolder
);

export default folderRoute;