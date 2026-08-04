import { Response,Request } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { folderServices } from "./folder.service";
import { getAuditContext } from "../../middlewares/audit.middleware";

// ─── Create ────────────────────────────────────────────────────────────────────
const createFolder = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const folder = await folderServices.createFolder(
    { ...req.body, tenantId },
    getAuditContext(req)
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Folder created successfully",
    data: folder,
  });
});

// ─── Get All ───────────────────────────────────────────────────────────────────
const getFolders = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const folders = await folderServices.getFolders(tenantId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Folders fetched successfully",
    data: folders,
  });
});

// ─── Get Single ────────────────────────────────────────────────────────────────
const getFolderById = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const id = req.params.id as string;
  const folder = await folderServices.getFolderById(id, tenantId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Folder fetched successfully",
    data: folder,
  });
});

// ─── Update ────────────────────────────────────────────────────────────────────
const updateFolder = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const folder = await folderServices.updateFolder(
    {
      id: req.params.id,
      tenantId,
      ...req.body,
    },
    getAuditContext(req)
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Folder updated successfully",
    data: folder,
  });
});

// ─── Delete ────────────────────────────────────────────────────────────────────
const deleteFolder = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const id = req.params.id as string;
  const result = await folderServices.deleteFolder(id, tenantId, getAuditContext(req));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const folderControllers = {
  createFolder,
  getFolders,
  getFolderById,
  updateFolder,
  deleteFolder,
};
