import { Router } from "express";
import { folderControllers } from "./folder.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validateRequest";
import { createFolderSchema, folderParamSchema, updateFolderSchema } from "./folder.validation";
import { validateFolderCreate } from "../../middlewares/plan.middleware";

const folderRoute = Router();

folderRoute.post(
  "/",
  authMiddleware,
  validateRequest(createFolderSchema),
  validateFolderCreate,
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