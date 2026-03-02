import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";

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
  const { name, tenantId, folderId, path, size, mimeType, url, publicId } = payload;

  // Check duplicate name in same folder
  // const existing = await prisma.file.findFirst({
  //   where: { name, tenantId, folderId: folderId ?? null },
  // });

  // if (existing) {
  //   throw new AppError(
  //     "File with this name already exists in the same location",
  //     httpStatus.CONFLICT
  //   );
  // }

  // Validate folder belongs to same tenant
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.tenantId !== tenantId) {
      throw new AppError("Folder not found", httpStatus.NOT_FOUND);
    }
  }

  // Update tenant storage usage
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { storageUsed: { increment: size } },
  });

  const file = await prisma.file.create({
    data: { name, size, mimeType, url, publicId, tenantId, folderId, path },
    include: { folder: true },
  });

  return file;
};

// ─── Get All (by tenant) ────────────────────────────────────────────────────────
const getFiles = async (tenantId: string, folderId?: string) => {
  const files = await prisma.file.findMany({
    where: {
      tenantId,
      ...(folderId ? { folderId } : {}),
    },
    include: { folder: true },
    orderBy: { createdAt: "desc" },
  });

  return files;
};

// ─── Get Single ────────────────────────────────────────────────────────────────
const getFileById = async (id: string, tenantId: string) => {
  const file = await prisma.file.findUnique({
    where: { id },
    include: { folder: true },
  });

  if (!file || file.tenantId !== tenantId) {
    throw new AppError("File not found", httpStatus.NOT_FOUND);
  }

  return file;
};

// ─── Update ────────────────────────────────────────────────────────────────────
const updateFile = async (payload: UpdateFilePayload) => {
  const { id, tenantId, ...updateData } = payload;

  const file = await prisma.file.findUnique({ where: { id } });

  if (!file || file.tenantId !== tenantId) {
    throw new AppError("File not found", httpStatus.NOT_FOUND);
  }

  // Check duplicate name in same folder on rename
  if (updateData.name) {
    const duplicate = await prisma.file.findFirst({
      where: {
        name: updateData.name,
        tenantId,
        folderId: file.folderId,
        NOT: { id },
      },
    });

    if (duplicate) {
      throw new AppError(
        "File with this name already exists in the same location",
        httpStatus.CONFLICT
      );
    }
  }

  const updated = await prisma.file.update({
    where: { id },
    data: updateData,
    include: { folder: true },
  });

  return updated;
};

// ─── Delete ────────────────────────────────────────────────────────────────────
const deleteFile = async (id: string, tenantId: string) => {
  const file = await prisma.file.findUnique({ where: { id } });

  if (!file || file.tenantId !== tenantId) {
    throw new AppError("File not found", httpStatus.NOT_FOUND);
  }

  // Decrease tenant storage usage
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { storageUsed: { decrement: file.size } },
  });

  await prisma.file.delete({ where: { id } });

  return { message: "File deleted successfully" };
};

export const fileServices = {
  createFile,
  getFiles,
  getFileById,
  updateFile,
  deleteFile,
};