import { Router } from "express";
import { folderControllers } from "./folder.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validateRequest";
import { createFolderSchema, folderParamSchema, updateFolderSchema } from "./folder.validation";
import { validateFolderCreate } from "../../middlewares/plan.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";

const folderRoute = Router();
folderRoute.post(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN","OWNER","MEMBER"),
  validateRequest(createFolderSchema),
  validateFolderCreate,
  folderControllers.createFolder
);

folderRoute.get("/", authMiddleware,roleMiddleware("ADMIN", "OWNER", "MEMBER"), folderControllers.getFolders);

folderRoute.get(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(folderParamSchema),
  folderControllers.getFolderById
);

folderRoute.patch(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(updateFolderSchema),
  folderControllers.updateFolder
);

folderRoute.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "OWNER", "MEMBER"),
  validateRequest(folderParamSchema),
  folderControllers.deleteFolder
);

export default folderRoute;