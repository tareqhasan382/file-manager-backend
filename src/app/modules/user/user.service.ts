import { Types } from "mongoose";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import { User } from "../../../models/User";
import { AuditAction, logAudit } from "../../middlewares/audit.middleware";

const FOLDER_PROJECTION = {
  id: { $toString: "$_id" },
  _id: 0,
  name: 1,
  path: 1,
  parentId: { $toString: "$parentId" },
  tenantId: { $toString: "$tenantId" },
  createdAt: 1,
  updatedAt: 1,
};

const FILE_PROJECTION = {
  id: { $toString: "$_id" },
  _id: 0,
  name: 1,
  size: 1,
  mimeType: 1,
  url: 1,
  path: 1,
  folderId: { $toString: "$folderId" },
  tenantId: { $toString: "$tenantId" },
  createdAt: 1,
  updatedAt: 1,
};

const getMe = async (userId: string) => {
  const [result] = await User.aggregate([
    { $match: { _id: new Types.ObjectId(userId), deletedAt: null } },
    {
      $project: {
        id: { $toString: "$_id" },
        _id: 0,
        email: 1,
        role: 1,
        fullName: 1,
        avatar: 1,
        phone: 1,
        designation: 1,
        bio: 1,
        address: 1,
        city: 1,
        country: 1,
        createdAt: 1,
        updatedAt: 1,
        tenantId: 1,
      },
    },
    {
      $lookup: {
        from: "tenants",
        localField: "tenantId",
        foreignField: "_id",
        pipeline: [
          { $match: { deletedAt: null } },
          {
            $lookup: {
              from: "folders",
              localField: "_id",
              foreignField: "tenantId",
              pipeline: [
                { $match: { deletedAt: null } },
                { $sort: { createdAt: -1 } },
                { $project: FOLDER_PROJECTION },
              ],
              as: "folders",
            },
          },
          {
            $lookup: {
              from: "files",
              localField: "_id",
              foreignField: "tenantId",
              pipeline: [
                { $match: { deletedAt: null } },
                { $sort: { createdAt: -1 } },
                { $project: FILE_PROJECTION },
              ],
              as: "files",
            },
          },
          {
            $project: {
              id: { $toString: "$_id" },
              _id: 0,
              name: 1,
              plan: 1,
              isBanned: 1,
              subscriptionStatus: 1,
              storageUsed: 1,
              createdAt: 1,
              updatedAt: 1,
              folders: 1,
              files: 1,
            },
          },
        ],
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: false } },
  ]);

  if (!result) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  return result;
};

const updateProfile = async (
  userId: string,
  payload: {
    fullName?: string;
    phone?: string | null;
    avatar?: string | null;
    designation?: string | null;
    bio?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
  },
  auditCtx: { actorId: string | null; actorEmail: string; actorRole: string; tenantId: string | null; ipAddress: string; userAgent: string }
) => {
  const updateData: Record<string, any> = {};
  if (payload.fullName !== undefined) updateData.fullName = payload.fullName.trim();
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.avatar !== undefined) updateData.avatar = payload.avatar;
  if (payload.designation !== undefined) updateData.designation = payload.designation;
  if (payload.bio !== undefined) updateData.bio = payload.bio;
  if (payload.address !== undefined) updateData.address = payload.address;
  if (payload.city !== undefined) updateData.city = payload.city;
  if (payload.country !== undefined) updateData.country = payload.country;

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No fields to update", httpStatus.BAD_REQUEST);
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select(
    "id email fullName avatar phone designation bio address city country role tenantId createdAt updatedAt"
  );

  if (!updated) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  await logAudit({
    ...auditCtx,
    action: AuditAction.PROFILE_UPDATE,
    resource: "user",
    resourceId: userId,
    tenantId: updated.tenantId?.toString(),
    status: "SUCCESS",
    details: { updatedFields: Object.keys(updateData) },
  });

  return updated.toJSON();
};

const changePassword = async (
  userId: string,
  payload: { currentPassword: string; newPassword: string },
  auditCtx: { actorId: string | null; actorEmail: string; actorRole: string; tenantId: string | null; ipAddress: string; userAgent: string }
) => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  const isPasswordMatch = await bcrypt.compare(
    payload.currentPassword,
    user.password
  );

  if (!isPasswordMatch) {
    await logAudit({
      ...auditCtx,
      action: AuditAction.PASSWORD_CHANGE,
      resource: "user",
      resourceId: userId,
      tenantId: user.tenantId?.toString(),
      status: "FAILURE",
      details: { reason: "current_password_mismatch" },
    });
    throw new AppError("Current password is incorrect", httpStatus.UNAUTHORIZED);
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, 10);

  await User.updateOne(
    { _id: userId },
    { $set: { password: hashedPassword } }
  );

  await logAudit({
    ...auditCtx,
    action: AuditAction.PASSWORD_CHANGE,
    resource: "user",
    resourceId: userId,
    tenantId: user.tenantId?.toString(),
    status: "SUCCESS",
  });

  return { message: "Password changed successfully" };
};

export const userServices = {
  getMe,
  updateProfile,
  changePassword,
};
