import { z } from "zod";
import { zodObjectId, zodObjectIdOptional } from "../../../shared/zod/objectId";

export const createFolderSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Folder name is required").max(255),
    parentId: zodObjectIdOptional,
    path: z.string().min(1, "Path is required"),
  }),
});

export const updateFolderSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    parentId: zodObjectIdOptional,
    path: z.string().optional(),
  }),
  params: z.object({
    id: zodObjectId,
  }),
});

export const folderParamSchema = z.object({
  params: z.object({
    id: zodObjectId,
  }),
});
