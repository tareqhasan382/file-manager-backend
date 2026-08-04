import httpStatus from "http-status";
import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { authServices } from "./auth.service";
import { sendResponse } from "../../../shared/sendResponse";
import { AuditAction, getAuditContext, logAudit } from "../../middlewares/audit.middleware";

const register = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.register(req.body);

  const ctx = getAuditContext(req);
  await logAudit({
    ...ctx,
    action: AuditAction.SIGNUP,
    resource: "auth",
    resourceId: result.userId,
    tenantId: result.tenantId,
    status: "SUCCESS",
    details: { email: result.email, plan: result.plan },
  });

  await logAudit({
    ...ctx,
    action: AuditAction.TENANT_CREATE,
    resource: "tenant",
    resourceId: result.tenantId,
    tenantId: result.tenantId,
    status: "SUCCESS",
    details: { tenantId: result.tenantId, plan: result.plan },
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully. Verification code sent to your email.",
    data: result,
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.login(req.body);

  const ctx = getAuditContext(req);
  await logAudit({
    ...ctx,
    action: AuditAction.LOGIN,
    resource: "auth",
    resourceId: result.userId,
    tenantId: result.tenantId,
    status: "SUCCESS",
    details: { email: req.body.email, role: result.role },
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: "User logged in successfully",
    ...result,
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  const ctx = getAuditContext(req);
  await logAudit({
    ...ctx,
    action: AuditAction.LOGOUT,
    resource: "auth",
    status: "SUCCESS",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: null,
  });
});

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await authServices.verifyOtp(req.body);

  const ctx = getAuditContext(req);
  await logAudit({
    ...ctx,
    action: AuditAction.OTP_VERIFY,
    resource: "auth",
    resourceId: result.userId,
    tenantId: result.tenantId,
    status: "SUCCESS",
    details: { email: req.body.email },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Email verified successfully",
    data: result,
  });
});

const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authServices.resendOtp(req.body);

  const ctx = getAuditContext(req);
  await logAudit({
    ...ctx,
    action: AuditAction.OTP_RESEND,
    resource: "auth",
    status: "SUCCESS",
    details: { email },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authServices.forgotPassword(req.body);

  const ctx = getAuditContext(req);
  await logAudit({
    ...ctx,
    action: AuditAction.PASSWORD_RESET,
    resource: "auth",
    status: "SUCCESS",
    details: { email, operation: "forgot_password" },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authServices.resetPassword(req.body);

  const ctx = getAuditContext(req);
  await logAudit({
    ...ctx,
    action: AuditAction.PASSWORD_CHANGE,
    resource: "auth",
    status: "SUCCESS",
    details: { email, operation: "reset_password" },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const result = await authServices.getMe(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Session valid",
    data: result,
  });
});

export const authControllers = {
  register,
  login,
  logout,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getMe,
};
