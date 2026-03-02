import { NextFunction, Response, Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/app_error";
import { prisma } from "../../lib/prisma";

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let tenantId = req.user?.tenantId;

  if (!tenantId) {
    throw new AppError("Tenant not found", httpStatus.BAD_REQUEST);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new AppError("Tenant does not exist", httpStatus.NOT_FOUND);
  }
  tenantId = tenant
  next();
};