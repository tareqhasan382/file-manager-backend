import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { Folder } from "../../../models/Folder";
import { File } from "../../../models/File";
import { Tenant } from "../../../models/Tenant";
import { withTransaction } from "../../../utils/transaction";
import { AuditAction, logAudit, type AuditContext } from "../../middlewares/audit.middleware";

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

const buildAuditCtx = (ctx: AuditContext, file: any): AuditContext => ({
  ...ctx,
  tenantId: ctx.tenantId || file?.tenantId?.toString() || null,
});

// Auto-rename on duplicate: "report.pdf" -> "report (1).pdf" -> "report (2).pdf"
const ensureUniqueName = async (
  tenantId: string,
  folderId: string | null,
  name: string
): Promise<string> => {
  const exists = (n: string) =>
    File.exists({ tenantId, folderId, name: n });

  if (!(await exists(name))) return name;

  const ext = name.includes(".") ? (name.match(/\.[^.]+$/) ?? [""])[0] : "";
  const base = ext ? name.slice(0, -ext.length) : name;

  let counter = 1;
  let candidate = `${base} (${counter})${ext}`;
  while (await exists(candidate)) {
    counter += 1;
    candidate = `${base} (${counter})${ext}`;
  }
  return candidate;
};

// ─── Create ────────────────────────────────────────────────────────────────────
const createFile = async (payload: CreateFilePayload, auditCtx: AuditContext) => {
  const { name, tenantId, folderId, path, size, mimeType, url, publicId } =
    payload;

  // Validate folder belongs to same tenant
  if (folderId) {
    const folder = await Folder.findById(folderId).lean();
    if (!folder || folder.tenantId.toString() !== tenantId) {
      throw new AppError("Folder not found", httpStatus.NOT_FOUND);
    }
  }

  // Duplicate names in the same location are auto-renamed (backed by compound
  // index tenantId+name+folderId).
  const resolvedName = await ensureUniqueName(
    tenantId,
    folderId ? folderId : null,
    name
  );

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
          name: resolvedName,
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

  const fileObj = file.toJSON();
  await logAudit({
    ...buildAuditCtx(auditCtx, file),
    action: AuditAction.FILE_UPLOAD,
    resource: "file",
    resourceId: fileObj.id,
    status: "SUCCESS",
    details: { name: resolvedName, size, mimeType },
  });

  return fileObj;
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
const updateFile = async (payload: UpdateFilePayload, auditCtx: AuditContext) => {
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
      .select("_ID")
      .lean();

    if (duplicate) {
      throw new AppError(
        "File with this name already exists in the same location",
        httpStatus.CONFLICT
      );
    }
  }

  const updated = await File.findByIdAndUpdate(id, updateData, { new: true });

  const updatedObj = updated?.toJSON();
  await logAudit({
    ...buildAuditCtx(auditCtx, file),
    action: AuditAction.FILE_UPDATE,
    resource: "file",
    resourceId: id,
    status: "SUCCESS",
    details: { updatedFields: Object.keys(updateData) },
  });

  return updatedObj;
};

// ─── Delete (soft) ─────────────────────────────────────────────────────────────
// Atomic: release storage + soft-delete the record.
const deleteFile = async (id: string, tenantId: string, auditCtx: AuditContext) => {
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

  await logAudit({
    ...buildAuditCtx(auditCtx, file),
    action: AuditAction.FILE_DELETE,
    resource: "file",
    resourceId: id,
    status: "SUCCESS",
    details: { name: file.name, size: file.size, mimeType: file.mimeType },
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
