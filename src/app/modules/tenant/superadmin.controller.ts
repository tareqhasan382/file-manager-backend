import { Request,Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { superAdminServices } from "./superadmin.service";
import { getAuditContext } from "../../middlewares/audit.middleware";
import { AuditAction, logAudit } from "../../middlewares/audit.middleware";

// ─── Get All Tenants ──────────────────────────────────────────────────────────
const getAllTenants = catchAsync(async (req: Request, res: Response) => {
  const tenants = await superAdminServices.getAllTenants();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tenants fetched successfully",
    data: tenants,
  });
});

// ─── Get Single Tenant ────────────────────────────────────────────────────────
const getTenantById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenant = await superAdminServices.getTenantById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tenant fetched successfully",
    data: tenant,
  });
});

// ─── Ban / Unban Tenant ───────────────────────────────────────────────────────
const toggleBanTenant = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await superAdminServices.toggleBanTenant(id, getAuditContext(req));

  await logAudit({
    ...getAuditContext(req),
    action: AuditAction.ADMIN_ACTION,
    resource: "tenant",
    resourceId: id,
    status: "SUCCESS",
    details: { operation: "ban_toggle", isBanned: result.isBanned },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: { isBanned: result.isBanned },
  });
});

// ─── Change Tenant Plan ───────────────────────────────────────────────────────
const changeTenantPlan = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { plan } = req.body;
  const tenant = await superAdminServices.changeTenantPlan(id, plan, getAuditContext(req));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tenant plan updated successfully",
    data: tenant,
  });
});

// ─── Get All Users ────────────────────────────────────────────────────────────
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await superAdminServices.getAllUsers();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users fetched successfully",
    data: users,
  });
});

// ─── Get User Detail (with billing history) ───────────────────────────────────
const getUserDetail = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await superAdminServices.getUserDetail(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User details fetched successfully",
    data: result,
  });
});

// ─── Get Tenant Billing History ───────────────────────────────────────────────
const getTenantBilling = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await superAdminServices.getTenantBilling(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tenant billing history fetched successfully",
    data: result,
  });
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
const getStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await superAdminServices.getStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stats fetched successfully",
    data: stats,
  });
});

// ─── Billing Ledger ───────────────────────────────────────────────────────────
const getAllBilling = catchAsync(async (req: Request, res: Response) => {
  const billing = await superAdminServices.getAllBilling();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Billing ledger fetched successfully",
    data: billing,
  });
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await superAdminServices.getAuditLogs(req.query);

  const actionValues = Object.values(AuditAction);
  const statusValues = ["SUCCESS", "FAILURE"];
  const resourceValues = [
    "user", "tenant", "billing", "file", "folder",
    "member", "subscription", "auth", "admin",
  ];

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

export const superAdminControllers = {
  getAllTenants,
  getTenantById,
  toggleBanTenant,
  changeTenantPlan,
  getAllUsers,
  getUserDetail,
  getTenantBilling,
  getStats,
  getAllBilling,
  getAuditLogs,
};
