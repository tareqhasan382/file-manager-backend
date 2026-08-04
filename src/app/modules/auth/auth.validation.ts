import { z } from "zod";
import { Plan } from "../../enums";

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address"),

    password: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters"),

    fullName: z
      .string()
      .min(1, "Full name is required"),

    companyName: z
      .string()
      .min(1, "Company name is required"),

    plan: z
      .enum(Object.values(Plan) as [string, ...string[]])
      .optional()
      .default(Plan.FREE),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address"),

    password: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters"),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    code: z
      .string()
      .length(6, "Code must be exactly 6 digits")
      .regex(/^\d{6}$/, "Code must be numeric"),
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: z.string().min(1, "Email is required").email("Invalid email address"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().min(1, "Email is required").email("Invalid email address"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    code: z
      .string()
      .length(6, "Code must be exactly 6 digits")
      .regex(/^\d{6}$/, "Code must be numeric"),
    newPassword: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters"),
  }),
});
