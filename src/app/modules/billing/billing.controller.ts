import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { billingServices } from "./billing.service";

const create = catchAsync(async (req: Request, res: Response) => {
  const result = await billingServices.create(req);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Stripe checkout session created",
    data: result,
  });
});

export const billingControllers = {
  create,
};