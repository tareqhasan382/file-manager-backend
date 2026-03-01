import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";

export const roleMiddleware =
  (...allowedRoles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      throw new AppError("Forbidden access", httpStatus.FORBIDDEN);
    }

    next();
  };