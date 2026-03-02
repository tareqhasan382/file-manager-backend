import { z } from "zod";

export const changePlanSchema = z.object({
  body: z.object({
    plan: z.enum(["FREE", "SILVER", "GOLD", "DIAMOND"], {
      message: "Invalid plan",
    }),
  }),
  params: z.object({
    id: z.string().uuid("Invalid tenant ID"),
  }),
});

export const tenantParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid tenant ID"),
  }),
});