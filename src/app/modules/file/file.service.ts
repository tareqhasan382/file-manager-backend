import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { Folder } from "../../../models/Folder";
import { File } from "../../../models/File";
import { Tenant } from "../../../models/Tenant";
import { withTransaction } from "../../../utils/transaction";

interface CreateFilePayload {
  name: string;
  size: number;
  mimeType: string;
  url: string;
  publicId: string;
  tenantId: string;
  folderId?: string;
  path: string;
}

interface UpdateFilePayload {
  id: string;
  tenantId: string;
  name?: string;
  folderId?: string;
  path?: string;
}

// ─── Create ────────────────────────────────────────────────────────────────────
const createFile = async (payload: CreateFilePayload) => {
  const { name, tenantId, folderId, path, size, mimeType, url, publicId } =
    payload;

  // Validate folder belongs to same tenant
  if (folderId) {
    const folder = await Folder.findById(folderId).lean();
    if (!folder || folder.tenantId.toString() !== tenantId) {
      throw new AppError("Folder not found", httpStatus.NOT_FOUND);
    }
  }

  // Duplicate name check (backed by compound index tenantId+name+folderId)
  const existing = await File.findOne({
    tenantId,
    name,
    folderId: folderId ? folderId : null,
  })
    .select("_id")
    .lean();
  if (existing) {
    throw new AppError(
      "File with this name already exists in the same location",
      httpStatus.CONFLICT
    );
  }

  // Atomic: charge storage + persist the file record together.
  const file = await withTransaction(async (session) => {
    await Tenant.updateOne(
      { _id: tenantId },
      { $inc: { storageUsed: size } },
      { session }
    );

    const [created] = await File.create(
      [
        {
          name,
          size,
          mimeType,
          url,
          publicId,
          tenantId,
          folderId: folderId ? folderId : null,
          path,
        },
      ],
      { session }
    );

    return created;
  });

  return file.toJSON();
};

// ─── Get All (by tenant) ────────────────────────────────────────────────────────
const getFiles = async (tenantId: string, folderId?: string) => {
  const files = await File.find({
    tenantId,
    ...(folderId ? { folderId } : {}),
  }).sort({ createdAt: -1 });

  return files;
};

// ─── Get Single ────────────────────────────────────────────────────────────────
const getFileById = async (id: string, tenantId: string) => {
  const file = await File.findById(id);

  if (!file || file.tenantId.toString() !== tenantId) {
    throw new AppError("File not found", httpStatus.NOT_FOUND);
  }

  return file;
};

// ─── Update ────────────────────────────────────────────────────────────────────
const updateFile = async (payload: UpdateFilePayload) => {
  const { id, tenantId, ...updateData } = payload;

  const file = await File.findById(id).lean();

  if (!file || file.tenantId.toString() !== tenantId) {
    throw new AppError("File not found", httpStatus.NOT_FOUND);
  }

  // Check duplicate name in same folder on rename
  if (updateData.name) {
    const duplicate = await File.findOne({
      name: updateData.name,
      tenantId,
      folderId: file.folderId,
      _id: { $ne: id },
    })
      .select("_id")
      .lean();

    if (duplicate) {
      throw new AppError(
        "File with this name already exists in the same location",
        httpStatus.CONFLICT
      );
    }
  }

  const updated = await File.findByIdAndUpdate(id, updateData, { new: true });

  return updated;
};

// ─── Delete (soft) ─────────────────────────────────────────────────────────────
// Atomic: release storage + soft-delete the record.
const deleteFile = async (id: string, tenantId: string) => {
  const file = await File.findById(id).lean();

  if (!file || file.tenantId.toString() !== tenantId) {
    throw new AppError("File not found", httpStatus.NOT_FOUND);
  }

  await withTransaction(async (session) => {
    await Tenant.updateOne(
      { _id: tenantId },
      { $inc: { storageUsed: -file.size } },
      { session }
    );

    await File.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date() } },
      { session }
    );
  });

  return { message: "File deleted successfully" };
};

export const fileServices = {
  createFile,
  getFiles,
  getFileById,
  updateFile,
  deleteFile,
};
