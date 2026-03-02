import { Request,Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { superAdminServices } from "./superadmin.service";
// import { superAdminServices } from "./superAdmin.service";
// import { AuthRequest } from "../../middlewares/auth.middleware";

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
  const result = await superAdminServices.toggleBanTenant(id);

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
  const tenant = await superAdminServices.changeTenantPlan(id, plan);

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

export const superAdminControllers = {
  getAllTenants,
  getTenantById,
  toggleBanTenant,
  changeTenantPlan,
  getAllUsers,
  getStats,
};