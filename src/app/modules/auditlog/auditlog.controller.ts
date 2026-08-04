import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { auditLogService } from "./auditlog.service";
import { AuditAction, AuditStatus } from "../../../models/AuditLog";

const getAllAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;

  const result = await auditLogService.getAllAuditLogs({
    filters: {
      action: query.action,
      resource: query.resource,
      status: query.status,
      tenantId: query.tenantId,
      actorId: query.actorId,
      ipAddress: query.ipAddress,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
    },
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 50,
  });

  const actionValues = Object.values(AuditAction);
  const resourceValues = [
    "user",
    "tenant",
    "billing",
    "file",
    "folder",
    "member",
    "subscription",
    "auth",
    "admin",
  ];
  const statusValues = Object.values(AuditStatus);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs fetched successfully",
    data: result.records,
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      pages: result.meta.pages,
      actions: actionValues,
      resources: resourceValues,
      statuses: statusValues,
    },
  });
});

export const auditLogControllers = {
  getAllAuditLogs,
};
