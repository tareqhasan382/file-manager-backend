import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import config from "../../config";

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    throw new AppError("Unauthorized access", httpStatus.UNAUTHORIZED);
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret as string);
    req.user = decoded;
    next();
  } catch {
    throw new AppError("Invalid or expired token", httpStatus.UNAUTHORIZED);
  }
};