import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import config from "../../config";
import { User } from "../../models/User";

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

    // Always re-validate against the DB so banned/deleted users
    // and role changes take effect immediately (soft-deleted users are filtered).
    const user = await User.findOne({
      _id: verifiedUser.userId,
    })
      .select("id email role tenantId fullName")
      .lean();

    if (!user) {
      throw new AppError("User no longer exists", httpStatus.UNAUTHORIZED);
    }

    req.user = {
      id: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId.toString(),
    };

    next();
  } catch {
    throw new AppError("Invalid or expired token", httpStatus.UNAUTHORIZED);
  }
};
