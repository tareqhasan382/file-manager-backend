import { NextFunction, Response, Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import { Tenant } from "../../models/Tenant";

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    throw new AppError("Tenant not found", httpStatus.BAD_REQUEST);
  }

  // Soft-deleted tenants are filtered out automatically.
  const tenant = await Tenant.findById(tenantId);

  if (!tenant) {
    throw new AppError("Tenant does not exist", httpStatus.NOT_FOUND);
  }

  // Ban check
  if (tenant.isBanned) {
    throw new AppError(
      "Your organization has been banned. Please contact support.",
      httpStatus.FORBIDDEN
    );
  }

  req.tenant = tenant;
  next();
};
