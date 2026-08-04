import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Types } from "mongoose";
import { Tenant } from "../../models/Tenant";
import { Folder } from "../../models/Folder";
import { File } from "../../models/File";
import { AppError } from "../../utils/app_error";
import { PLAN_LIMITS, PlanType } from "../../config/planlimits";

/**
 * Computes the depth of a folder in a single round-trip using `$graphLookup`.
 * Replaces the previous N+1 "walk the parent chain" loop.
 */
const getFolderDepth = async (parentId: string): Promise<number> => {
  const [result] = await Folder.aggregate<{ depth: number }>([
    { $match: { _id: new Types.ObjectId(parentId), deletedAt: null } },
    {
      $graphLookup: {
        from: "folders",
        startWith: "$parentId",
        connectFromField: "parentId",
        connectToField: "_id",
        as: "ancestors",
        maxDepth: 50,
        restrictSearchWithMatch: { deletedAt: null },
      },
    },
    { $project: { depth: { $add: [{ $size: "$ancestors" }, 1] } } },
  ]);

  return result ? result.depth : 1;
};

// ─── Validate File Upload ──────────────────────────────────────────────────────
export const validateFileUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tenantId } = req.user!;
    const { size } = req.body;

    // Parallel reads: tenant + live file count (no N+1)
    const [tenant, fileCount] = await Promise.all([
      Tenant.findById(tenantId).lean(),
      File.countDocuments({ tenantId }),
    ]);

    if (!tenant) throw new AppError("Tenant not found", httpStatus.NOT_FOUND);

    const limits = PLAN_LIMITS[tenant.plan as PlanType];

    // 1. Max file count check
    if (fileCount >= limits.maxFiles) {
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

    const [tenant, folderCount] = await Promise.all([
      Tenant.findById(tenantId).lean(),
      Folder.countDocuments({ tenantId }),
    ]);

    if (!tenant) throw new AppError("Tenant not found", httpStatus.NOT_FOUND);

    const limits = PLAN_LIMITS[tenant.plan as PlanType];

    // 1. Max folder count check
    if (folderCount >= limits.maxFolders) {
      throw new AppError(
        `Your ${tenant.plan} plan allows maximum ${limits.maxFolders} folders. Please upgrade your plan.`,
        httpStatus.FORBIDDEN
      );
    }

    // 2. Folder depth check (single $graphLookup query)
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
