import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { billingServices } from "./billing.service";

const create = catchAsync(async (req: Request, res: Response) => {
  const data = req.body;
  const { userId, tenantId } = req.user as any;

  const result = await billingServices.createBilling({ plan:data?.plan, userId });

  res.status(httpStatus.OK).json({
    success: true,
    message: "Stripe checkout session created",
    data: result,
  });
});

export const billingControllers = { create };