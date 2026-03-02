import {Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { userServices } from "./user.service";

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

export const userControllers = {
  getMe,
};