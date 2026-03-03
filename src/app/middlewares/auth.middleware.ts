import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import config from "../../config";
import { prisma } from "../../lib/prisma";


export const authMiddleware = async (
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
    //console.log("verifiedUser--------->", verifiedUser)
    const user = await prisma.user.findUnique({
      where: { id: verifiedUser.userId },
      select: { id: true, email: true, role: true, tenantId: true },
    });

    if (!user) {
      throw new AppError("User no longer exists", httpStatus.UNAUTHORIZED);
    }
   // console.log("user--------->", user)
    req.user = user;
    req.user = verifiedUser;

    next();
  } catch {

    throw new AppError("Invalid or expired token", httpStatus.UNAUTHORIZED);
  }
};