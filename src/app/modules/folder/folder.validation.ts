import { z } from "zod";

export const createFolderSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Folder name is required").max(255),
    parentId: z.string().uuid("Invalid parent folder ID").optional(),
    path: z.string().min(1, "Path is required"),
  }),
});

export const updateFolderSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    parentId: z.string().uuid().optional(),
    path: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid folder ID"),
  }),
});

export const folderParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid folder ID"),
  }),
});