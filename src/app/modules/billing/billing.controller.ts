import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { billingServices } from "./billing.service";
import { sendResponse } from "../../../shared/sendResponse";
import { sendEmail } from "../../../lib/email";

const create = catchAsync(async (req: Request, res: Response) => {
  const data = req.body;
  const { userId, tenantId } = req.user as any;

  const result = await billingServices.createBilling({ plan:data?.plan, userId });
  await sendEmail({
    to: "tareqhasan382@gmail.com",
    subject: "Stripe checkout session created",
    text: `Hi Tareq, your subscription will renew on .`,
  });
  res.status(httpStatus.OK).json({
    success: true,
    message: "Stripe checkout session created",
    data: result,
  });
});

const getHistory = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user as any;

  const history = await billingServices.getBillingHistory(tenantId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Billing history fetched successfully",
    data: history,
  });
});

export const billingControllers = { create, getHistory };