import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import config from "../../config";
import { prisma } from "../../lib/prisma"; //  add

export const authMiddleware = async ( //  async
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

    //  DB check user actually exist
    const user = await prisma.user.findUnique({
      where: { id: verifiedUser.id },
      select: { id: true, email: true, role: true, tenantId: true },
    });

    if (!user) {
      throw new AppError("User no longer exists", httpStatus.UNAUTHORIZED);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired token", httpStatus.UNAUTHORIZED);
  }
};