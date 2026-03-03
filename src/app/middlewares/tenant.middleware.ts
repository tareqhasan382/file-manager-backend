import { NextFunction, Response, Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import { prisma } from "../../lib/prisma";

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const tenantId = req.user?.tenantId;
//console.log("tenantId---------->",tenantId)
  if (!tenantId) {
    throw new AppError("Tenant not found", httpStatus.BAD_REQUEST);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
//console.log("tenant---------->",tenant)
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