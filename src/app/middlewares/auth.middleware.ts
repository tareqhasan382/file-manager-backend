import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import config from "../../config";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization;
  if (!token) {
    res.status(httpStatus.UNAUTHORIZED).json({
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Unauthorized access",
      data: null,
    });
    return;
  }

  try {
    const verifiedUser = jwt.verify(
      token,
      config.jwt.secret as Secret
    ) as JwtPayload;

    req.user = verifiedUser;
    next();
  } catch {
    throw new AppError("Invalid or expired token", httpStatus.UNAUTHORIZED);
  }
};