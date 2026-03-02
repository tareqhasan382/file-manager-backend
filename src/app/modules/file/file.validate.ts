import { z } from "zod";

export const uploadFileSchema = z.object({
  body: z.object({
    name: z.string().min(1, "File name is required").max(255),
    size: z.number().positive("Size must be positive"),
    mimeType: z.string().min(1, "Mime type is required"),
    url: z.string().url("Invalid URL"),
    publicId: z.string().min(1, "Public ID is required"),
    folderId: z.string().uuid("Invalid folder ID").optional(),
    path: z.string().min(1, "Path is required"),
  }),
});

export const updateFileSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: z.string().uuid().optional(),
    path: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("Invalid file ID"),
  }),
});

export const fileParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid file ID"),
  }),
});