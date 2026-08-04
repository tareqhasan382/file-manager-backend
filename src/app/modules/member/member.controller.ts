import { Request,Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import { sendResponse } from "../../../shared/sendResponse";
import { memberServices } from "./member.service";
import { getAuditContext } from "../../middlewares/audit.middleware";

const getMembers = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const members = await memberServices.getMembers(tenantId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Members fetched successfully",
    data: members,
  });
});

const createMember = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const member = await memberServices.createMember({
    tenantId,
    ...req.body,
    auditCtx: getAuditContext(req),
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Member created successfully",
    data: member,
  });
});

const deleteMember = catchAsync(async (req: Request, res: Response) => {
  const { tenantId } = req.user!;
  const id = req.params.id as string;
  const result = await memberServices.deleteMember(id, tenantId, getAuditContext(req));

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

export const memberControllers = {
  getMembers,
  createMember,
  deleteMember,
};
