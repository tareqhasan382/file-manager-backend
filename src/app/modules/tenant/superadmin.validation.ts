import { z } from "zod";
import { zodObjectId } from "../../../shared/zod/objectId";

export const changePlanSchema = z.object({
  body: z.object({
    plan: z.enum(["FREE", "SILVER", "GOLD", "DIAMOND"], {
      message: "Invalid plan",
    }),
  }),
  params: z.object({
    id: zodObjectId,
  }),
});

export const tenantParamSchema = z.object({
  params: z.object({
    id: zodObjectId,
  }),
});
