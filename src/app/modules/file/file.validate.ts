import { z } from "zod";
import { zodObjectId, zodObjectIdOptional } from "../../../shared/zod/objectId";

export const uploadFileSchema = z.object({
  body: z.object({
    name: z.string().min(1, "File name is required").max(255),
    size: z.number().positive("Size must be positive"),
    mimeType: z.string().min(1, "Mime type is required"),
    url: z.string().url("Invalid URL"),
    publicId: z.string().min(1, "Public ID is required"),
    folderId: zodObjectIdOptional,
    path: z.string().min(1, "Path is required"),
  }),
});

export const updateFileSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: zodObjectIdOptional,
    path: z.string().optional(),
  }),
  params: z.object({
    id: zodObjectId,
  }),
});

export const fileParamSchema = z.object({
  params: z.object({
    id: zodObjectId,
  }),
});
