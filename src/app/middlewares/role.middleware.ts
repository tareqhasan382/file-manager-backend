import { NextFunction, Response, Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";

export const roleMiddleware =
  (...allowedRoles: string[]) =>
    (req: Request, res: Response, next: NextFunction) => {
      const role = req.user?.role;

      if (!role || !allowedRoles.includes(role)) {
        throw new AppError("Forbidden access", httpStatus.FORBIDDEN);
      }

      next();
    };