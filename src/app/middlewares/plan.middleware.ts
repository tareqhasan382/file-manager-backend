// import { NextFunction, Request, Response } from 'express'
// import httpStatus from 'http-status'
// import { AppError } from '../../utils/app_error'
// import { prisma } from '../../lib/prisma'

// export const planMiddleware =
//     (...allowedPlans: string[]) =>
//         async (req: Request, res: Response, next: NextFunction) => {
//             try {
//                 let tenantId = req.user?.tenantId;

//                 if (!tenantId) {
//                     throw new AppError("Tenant not found", httpStatus.BAD_REQUEST);
//                 }
//                 const tenant = await prisma.tenant.findUnique({
//                     where: { id: tenantId },
//                 });

//                 if (!tenant) {
//                     throw new AppError("Tenant does not exist", httpStatus.NOT_FOUND);
//                 }
//                 if (!tenant.plan || !allowedPlans.includes(tenant.plan)) {
//                     throw new AppError(
//                         "Your current plan does not allow this action",
//                         httpStatus.FORBIDDEN
//                     );
//                 }


//                 next()
//             } catch (error) {
//                 next(error)
//             }
//         }

import { Request,Response, NextFunction } from "express";
import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app_error";
import { PLAN_LIMITS, PlanType } from "../../config/planlimits";
// import { PLAN_LIMITS, PlanType } from "../../config/planLimits";
// import { AuthRequest } from "./auth.middleware";

// ─── Helper: get folder depth ──────────────────────────────────────────────────
const getFolderDepth = async (parentId: string): Promise<number> => {
  let depth = 1;
  let currentId: string | null = parentId;

  while (currentId) {
    const result:any = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (!result || !result.parentId) break;
    currentId = result.parentId;
    depth++;
  }

  return depth;
};

// ─── Validate File Upload ──────────────────────────────────────────────────────
export const validateFileUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tenantId } = req.user!;
    const { size, folderId } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { files: true } } },
    });

    if (!tenant) throw new AppError("Tenant not found", httpStatus.NOT_FOUND);

    const limits = PLAN_LIMITS[tenant.plan as PlanType];

    // 1. Max file count check
    if (tenant._count.files >= limits.maxFiles) {
      throw new AppError(
        `Your ${tenant.plan} plan allows maximum ${limits.maxFiles} files. Please upgrade your plan.`,
        httpStatus.FORBIDDEN
      );
    }

    // 2. Storage check
    const fileSizeMB = Number(size);
    const usedMB = tenant.storageUsed;
    if (usedMB + fileSizeMB > limits.maxStorageMB) {
      throw new AppError(
        `Storage limit exceeded. Your ${tenant.plan} plan allows ${limits.maxStorageMB}MB. Used: ${usedMB}MB.`,
        httpStatus.FORBIDDEN
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ─── Validate Folder Create ────────────────────────────────────────────────────
export const validateFolderCreate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tenantId } = req.user!;
    const { parentId } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { folders: true } } },
    });

    if (!tenant) throw new AppError("Tenant not found", httpStatus.NOT_FOUND);

    const limits = PLAN_LIMITS[tenant.plan as PlanType];

    // 1. Max folder count check
    if (tenant._count.folders >= limits.maxFolders) {
      throw new AppError(
        `Your ${tenant.plan} plan allows maximum ${limits.maxFolders} folders. Please upgrade your plan.`,
        httpStatus.FORBIDDEN
      );
    }

    // 2. Folder depth check
    if (parentId) {
      const depth = await getFolderDepth(parentId);
      if (depth >= limits.maxFolderDepth) {
        throw new AppError(
          `Your ${tenant.plan} plan allows maximum ${limits.maxFolderDepth} levels of folder depth. Please upgrade your plan.`,
          httpStatus.FORBIDDEN
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};