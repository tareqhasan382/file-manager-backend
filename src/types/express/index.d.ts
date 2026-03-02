import express from "express";

declare global {
  namespace Express {
    interface Request {
      user?: Record<string, any>;
      // user?: {
      //   userId: string;
      //   email: string;
      //   role: string;
      //   tenantId: string;
      // }
    }
  }
}