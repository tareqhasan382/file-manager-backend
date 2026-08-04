import rateLimit, { MemoryStore } from "express-rate-limit";
import type { Request, Response } from "express";
import rateLimitConfig from "../../config/rateLimit";

const handler = (_req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    message: "Too many requests, please try again later.",
  });
};

interface LimiterOptions {
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
  skip?: (req: Request) => boolean;
}

const makeLimiter = (options: LimiterOptions) =>
  rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    skip: options.skip,
    handler,
    store: new MemoryStore(),
  });

// Global API protection (applied to /api/v1)
export const apiLimiter = makeLimiter({
  ...rateLimitConfig.api,
  skip: (req) => req.path === "/health",
});

// Stricter limit for authentication endpoints (signup, OTP, password reset)
export const authLimiter = makeLimiter(rateLimitConfig.auth);

// Brute-force protection for login — only failed attempts count
export const loginLimiter = makeLimiter({
  ...rateLimitConfig.login,
  skipSuccessfulRequests: true,
});
