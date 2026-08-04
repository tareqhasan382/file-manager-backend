import {Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { userServices } from "./user.service";
import { getAuditContext } from "../../middlewares/audit.middleware";

const getMe = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const user = await userServices.getMe(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully",
    data: user,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const result = await userServices.updateProfile(userId, req.body, getAuditContext(req));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const result = await userServices.changePassword(userId, req.body, getAuditContext(req));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const userControllers = {
  getMe,
  updateProfile,
  changePassword,
};
