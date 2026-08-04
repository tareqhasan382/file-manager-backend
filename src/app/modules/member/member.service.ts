import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import { User } from "../../../models/User";
import { Role } from "../../enums";

// ─── Get All Members ──────────────────────────────────────────────────────────
const getMembers = async (tenantId: string) => {
  const members = await User.find({
    tenantId,
    role: { $in: [Role.ADMIN, Role.MEMBER] },
  })
    .select("id email role fullName createdAt updatedAt")
    .sort({ createdAt: -1 });

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
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    throw new AppError(
      "User with this email already exists",
      httpStatus.CONFLICT
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const member = await User.create({
    tenantId,
    email,
    password: hashedPassword,
    role,
    fullName: "",
  });

  return await User.findById(member._id).select(
    "id email role fullName createdAt updatedAt"
  );
};

// ─── Delete Member (OWNER only) ───────────────────────────────────────────────
const deleteMember = async (id: string, tenantId: string) => {
  const member = await User.findById(id);

  if (!member || member.tenantId.toString() !== tenantId) {
    throw new AppError("Member not found", httpStatus.NOT_FOUND);
  }

  if (member.role === Role.OWNER) {
    throw new AppError("Cannot remove the OWNER", httpStatus.FORBIDDEN);
  }

  await member.softDelete();

  return { message: "Member removed successfully" };
};

export const memberServices = {
  getMembers,
  createMember,
  deleteMember,
};
