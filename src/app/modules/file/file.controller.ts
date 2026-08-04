import {Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { fileServices } from "./file.service";
import { getAuditContext } from "../../middlewares/audit.middleware";

// ─── Create ────────────────────────────────────────────────────────────────────
const createFile = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const file = await fileServices.createFile(
    { ...req.body, tenantId },
    getAuditContext(req)
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "File uploaded successfully",
    data: file,
  });
});

// ─── Get All ───────────────────────────────────────────────────────────────────
const getFiles = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const folderId = req.query.folderId as string | undefined;
  const files = await fileServices.getFiles(tenantId, folderId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Files fetched successfully",
    data: files,
  });
});

// ─── Get Single ────────────────────────────────────────────────────────────────
const getFileById = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const id = req.params.id as string;
  const file = await fileServices.getFileById(id, tenantId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "File fetched successfully",
    data: file,
  });
});

// ─── Update ────────────────────────────────────────────────────────────────────
const updateFile = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const id = req.params.id as string;
  const file = await fileServices.updateFile(
    { id, tenantId, ...req.body },
    getAuditContext(req)
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "File updated successfully",
    data: file,
  });
});

// ─── Delete ────────────────────────────────────────────────────────────────────
const deleteFile = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const id = req.params.id as string;

  const result = await fileServices.deleteFile(id, tenantId, getAuditContext(req));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const fileControllers = {
  createFile,
  getFiles,
  getFileById,
  updateFile,
  deleteFile,
};
