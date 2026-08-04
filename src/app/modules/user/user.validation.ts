import { z } from "zod";
import { zodObjectId } from "../../../shared/zod/objectId";

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "Full name is required").max(100).optional(),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .max(30)
      .optional()
      .nullable(),
    avatar: z.string().url("Invalid avatar URL").optional().nullable(),
    designation: z.string().max(100).optional().nullable(),
    bio: z.string().max(1000).optional().nullable(),
    address: z.string().max(300).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
  }),
  params: z.object({
    id: zodObjectId.optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters")
      .max(128),
  }),
});

export const userParamSchema = z.object({
  params: z.object({
    id: zodObjectId,
  }),
});
