import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import bcrypt from "bcrypt";

// ─── Get All Members ──────────────────────────────────────────────────────────
const getMembers = async (tenantId: string) => {
  const members = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ["ADMIN", "MEMBER"] },
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return members;
};

// ─── Create Member (OWNER only) ───────────────────────────────────────────────
const createMember = async ({
  tenantId,
  email,
  password,
  role,
}: {
  tenantId: string;
  email: string;
  password: string;
  role: "ADMIN" | "MEMBER";
}) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(
      "User with this email already exists",
      httpStatus.CONFLICT
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const member = await prisma.user.create({
    data: {
      tenantId,
      email,
      password: hashedPassword,
      role: role as Role,
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return member;
};

// ─── Delete Member (OWNER only) ───────────────────────────────────────────────
const deleteMember = async (id: string, tenantId: string) => {
  const member = await prisma.user.findUnique({ where: { id } });

  if (!member || member.tenantId !== tenantId) {
    throw new AppError("Member not found", httpStatus.NOT_FOUND);
  }

  if (member.role === "OWNER") {
    throw new AppError("Cannot remove the OWNER", httpStatus.FORBIDDEN);
  }

  await prisma.user.delete({ where: { id } });

  return { message: "Member removed successfully" };
};

export const memberServices = {
  getMembers,
  createMember,
  deleteMember,
};