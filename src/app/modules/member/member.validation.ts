import { z } from "zod";

export const createMemberSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters"),
    role: z.enum(["ADMIN", "MEMBER"], {
      message: "Role must be ADMIN or MEMBER",
    }),
  }),
});

export const memberParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid member ID"),
  }),
});