import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";

// ─── Get Me ────────────────────────────────────────────────────────────────────
const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
          storageUsed: true,
          createdAt: true,
          folders: {
            select: {
              id: true,
              name: true,
              path: true,
              parentId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          files: {
            select: {
              id: true,
              name: true,
              size: true,
              mimeType: true,
              url: true,
              path: true,
              folderId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  return user;
};

export const userServices = {
  getMe,
};