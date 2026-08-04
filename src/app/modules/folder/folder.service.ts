import { Types } from "mongoose";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { Folder } from "../../../models/Folder";
import { File } from "../../../models/File";
import { AuditAction, logAudit, type AuditContext } from "../../middlewares/audit.middleware";

interface CreateFolderPayload {
  name: string;
  tenantId: string;
  parentId?: string;
  path: string;
}

interface UpdateFolderPayload {
  id: string;
  tenantId: string;
  name?: string;
  parentId?: string;
  path?: string;
}

const CHILD_PROJECTION = {
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

// ─── Create ────────────────────────────────────────────────────────────────────
const createFolder = async (payload: CreateFolderPayload, auditCtx: AuditContext) => {
  const { name, tenantId, parentId, path } = payload;

  // Validate parent belongs to same tenant
  if (parentId) {
    const parent = await Folder.findById(parentId).lean();
    if (!parent || parent.tenantId.toString() !== tenantId) {
      throw new AppError("Parent folder not found", httpStatus.NOT_FOUND);
    }
  }

  // Duplicate name check in the same parent
  const existing = await Folder.findOne({
    tenantId,
    name,
    parentId: parentId ? parentId : null,
  })
    .select("_id")
    .lean();
  if (existing) {
    throw new AppError(
      "Folder with this name already exists in the same location",
      httpStatus.CONFLICT
    );
  }

  const folder = await Folder.create({
    name,
    tenantId,
    parentId: parentId ? parentId : null,
    path,
  });

  const folderObj = folder.toJSON();
  await logAudit({
    ...auditCtx,
    action: AuditAction.FOLDER_CREATE,
    resource: "folder",
    resourceId: folderObj.id,
    status: "SUCCESS",
    details: { name, parentId: parentId || null },
  });

  return folderObj;
};

// ─── Get All (by tenant) ────────────────────────────────────────────────────────
const getFolders = async (tenantId: string) => {
  const folders = await Folder.aggregate([
    { $match: { tenantId: new Types.ObjectId(tenantId), deletedAt: null } },
    {
      $lookup: {
        from: "folders",
        let: { fid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$parentId", "$$fid"] },
              deletedAt: null,
            },
          },
          { $sort: { createdAt: -1 } },
          { $project: CHILD_PROJECTION },
        ],
        as: "children",
      },
    },
    {
      $lookup: {
        from: "files",
        let: { fid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$folderId", "$$fid"] },
              deletedAt: null,
            },
          },
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
        path: 1,
        parentId: { $toString: "$parentId" },
        tenantId: { $toString: "$tenantId" },
        createdAt: 1,
        updatedAt: 1,
        children: 1,
        files: 1,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  return folders;
};

// ─── Get Single ────────────────────────────────────────────────────────────────
const getFolderById = async (id: string, tenantId: string) => {
  const [folder, children, files] = await Promise.all([
    Folder.findById(id),
    Folder.find({ parentId: id }).sort({ createdAt: -1 }),
    File.find({ folderId: id }).sort({ createdAt: -1 }),
  ]);

  if (!folder || folder.tenantId.toString() !== tenantId) {
    throw new AppError("Folder not found", httpStatus.NOT_FOUND);
  }

  return {
    ...folder.toJSON(),
    children: children.map((c) => c.toJSON()),
    files: files.map((f) => f.toJSON()),
  };
};

// ─── Update ────────────────────────────────────────────────────────────────────
const updateFolder = async (payload: UpdateFolderPayload, auditCtx: AuditContext) => {
  const { id, tenantId, ...updateData } = payload;

  const folder = await Folder.findById(id).lean();

  if (!folder || folder.tenantId.toString() !== tenantId) {
    throw new AppError("Folder not found", httpStatus.NOT_FOUND);
  }

  // Check duplicate name in same parent on rename
  if (updateData.name) {
    const duplicate = await Folder.findOne({
      name: updateData.name,
      tenantId,
      parentId: folder.parentId,
      _id: { $ne: id },
    })
      .select("_ID")
      .lean();

    if (duplicate) {
      throw new AppError(
        "Folder with this name already exists in the same location",
        httpStatus.CONFLICT
      );
    }
  }

  const updated = await Folder.findByIdAndUpdate(id, updateData, {
    new: true,
  });

  await logAudit({
    ...auditCtx,
    action: AuditAction.FOLDER_UPDATE,
    resource: "folder",
    resourceId: id,
    status: "SUCCESS",
    details: { updatedFields: Object.keys(updateData) },
  });

  return updated;
};

// ─── Delete (soft) ─────────────────────────────────────────────────────────────
const deleteFolder = async (id: string, tenantId: string, auditCtx: AuditContext) => {
  const folder = await Folder.findById(id);

  if (!folder || folder.tenantId.toString() !== tenantId) {
    throw new AppError("Folder not found", httpStatus.NOT_FOUND);
  }

  // Must be empty to delete (soft-deleted children/files are ignored)
  const [childCount, fileCount] = await Promise.all([
    Folder.countDocuments({ parentId: id }),
    File.countDocuments({ folderId: id }),
  ]);

  if (childCount > 0 || fileCount > 0) {
    throw new AppError(
      "Cannot delete folder with subfolders or files",
      httpStatus.BAD_REQUEST
    );
  }

  await folder.softDelete();

  await logAudit({
    ...auditCtx,
    action: AuditAction.FOLDER_DELETE,
    resource: "folder",
    resourceId: id,
    status: "SUCCESS",
    details: { name: folder.name },
  });

  return { message: "Folder deleted successfully" };
};

export const folderServices = {
  createFolder,
  getFolders,
  getFolderById,
  updateFolder,
  deleteFolder,
};
