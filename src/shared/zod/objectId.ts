import { z } from "zod";

export const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const zodObjectId = z.string().regex(MONGO_ID_REGEX, "Invalid ObjectId");

export const zodObjectIdOptional = zodObjectId.optional().nullable();
