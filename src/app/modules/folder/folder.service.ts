import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";

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

// ─── Create ────────────────────────────────────────────────────────────────────
const createFolder = async (payload: CreateFolderPayload) => {
  const { name, tenantId, parentId, path } = payload;

  // Check duplicate name in same parent
  const existing = await prisma.folder.findFirst({
    where: { name, tenantId, parentId: parentId ?? null },
  });

  if (existing) {
    throw new AppError(
      "Folder with this name already exists in the same location",
      httpStatus.CONFLICT
    );
  }

  // Validate parent belongs to same tenant
  if (parentId) {
    const parent = await prisma.folder.findUnique({ where: { id: parentId } });
    if (!parent || parent.tenantId !== tenantId) {
      throw new AppError("Parent folder not found", httpStatus.NOT_FOUND);
    }
  }

  const folder = await prisma.folder.create({
    data: { name, tenantId, parentId, path },
    include: { parent: true, children: true },
  });

  return folder;
};

// ─── Get All (by tenant) ────────────────────────────────────────────────────────
const getFolders = async (tenantId: string) => {
  const folders = await prisma.folder.findMany({
    where: { tenantId },
    include: { children: true, files: true },
    orderBy: { createdAt: "desc" },
  });

  return folders;
};

// ─── Get Single ────────────────────────────────────────────────────────────────
const getFolderById = async (id: string, tenantId: string) => {
  const folder = await prisma.folder.findUnique({
    where: { id },
    include: { children: true, files: true, parent: true },
  });

  if (!folder || folder.tenantId !== tenantId) {
    throw new AppError("Folder not found", httpStatus.NOT_FOUND);
  }

  return folder;
};

// ─── Update ────────────────────────────────────────────────────────────────────
const updateFolder = async (payload: UpdateFolderPayload) => {
  const { id, tenantId, ...updateData } = payload;

  const folder = await prisma.folder.findUnique({ where: { id } });

  if (!folder || folder.tenantId !== tenantId) {
    throw new AppError("Folder not found", httpStatus.NOT_FOUND);
  }

  // Check duplicate name in same parent on rename
  if (updateData.name) {
    const duplicate = await prisma.folder.findFirst({
      where: {
        name: updateData.name,
        tenantId,
        parentId: folder.parentId,
        NOT: { id },
      },
    });

    if (duplicate) {
      throw new AppError(
        "Folder with this name already exists in the same location",
        httpStatus.CONFLICT
      );
    }
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: updateData,
    include: { children: true, parent: true },
  });

  return updated;
};

// ─── Delete ────────────────────────────────────────────────────────────────────
const deleteFolder = async (id: string, tenantId: string) => {
  const folder = await prisma.folder.findUnique({
    where: { id },
    include: { children: true, files: true },
  });

  if (!folder || folder.tenantId !== tenantId) {
    throw new AppError("Folder not found", httpStatus.NOT_FOUND);
  }

  if (folder.children.length > 0 || folder.files.length > 0) {
    throw new AppError(
      "Cannot delete folder with subfolders or files",
      httpStatus.BAD_REQUEST
    );
  }

  await prisma.folder.delete({ where: { id } });

  return { message: "Folder deleted successfully" };
};

export const folderServices = {
  createFolder,
  getFolders,
  getFolderById,
  updateFolder,
  deleteFolder,
};