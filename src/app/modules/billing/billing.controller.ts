import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { billingServices } from "./billing.service";
import { sendResponse } from "../../../shared/sendResponse";
import { getAuditContext } from "../../middlewares/audit.middleware";
import { zodObjectId } from "../../../shared/zod/objectId";
import { z } from "zod";

const create = catchAsync(async (req: Request, res: Response) => {
  const data = req.body;
  const { userId, tenantId } = req.user as any;

  const result = await billingServices.createBilling({
    plan: data?.plan,
    userId,
    auditCtx: getAuditContext(req),
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: "Stripe checkout session created",
    data: result,
  });
});

const getHistory = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user as any;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;

  const result = await billingServices.getBillingHistory(tenantId, page, limit, {
    status,
    type,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Billing history fetched successfully",
    data: result.records,
    meta: result.meta,
  });
});

const getSubscription = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user as any;

  const result = await billingServices.getSubscriptionStatus(tenantId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription status fetched successfully",
    data: result,
  });
});

const getBillingById = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user as any;
  const id = req.params.id as string;

  const record = await billingServices.getBillingById(id, tenantId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Billing record fetched successfully",
    data: record,
  });
});

export const billingControllers = { create, getHistory, getSubscription, getBillingById };
