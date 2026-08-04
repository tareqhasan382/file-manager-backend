import { Types } from "mongoose";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { User } from "../../../models/User";

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

// ─── Get Me ────────────────────────────────────────────────────────────────────
// Single aggregation pipeline: user -> tenant -> folders + files.
// Replaces the 4 sequential "include" queries with one round-trip.
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

export const userServices = {
  getMe,
};
