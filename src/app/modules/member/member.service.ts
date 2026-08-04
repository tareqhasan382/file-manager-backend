import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import { User } from "../../../models/User";
import { Role } from "../../enums";
import { AuditAction, logAudit, type AuditContext } from "../../middlewares/audit.middleware";

const buildCtx = (ctx: AuditContext | undefined, userId: string | null, tenantId?: string) => ({
  actorId: ctx?.actorId || null,
  actorEmail: ctx?.actorEmail || "system",
  actorRole: ctx?.actorRole || "SYSTEM",
  tenantId: tenantId || ctx?.tenantId || null,
  ipAddress: ctx?.ipAddress || "api",
  userAgent: ctx?.userAgent || "",
});

const getMembers = async (tenantId: string) => {
  const members = await User.find({
    tenantId,
    role: { $in: [Role.ADMIN, Role.MEMBER] },
  })
    .select("id email role fullName createdAt updatedAt avatar phone")
    .sort({ createdAt: -1 });

  return members;
};

const createMember = async ({
  tenantId,
  email,
  password,
  role,
  auditCtx,
}: {
  tenantId: string;
  email: string;
  password: string;
  role: "ADMIN" | "MEMBER";
  auditCtx?: AuditContext;
}) => {
  const existing = await User.findOne({ email }).select("_ID").lean();
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

  const created = await User.findById(member._id).select(
    "id email role fullName createdAt updatedAt avatar phone"
  );

  await logAudit({
    ...buildCtx(auditCtx, member._id.toString(), tenantId),
    action: role === Role.ADMIN ? AuditAction.ROLE_CHANGE : AuditAction.MEMBER_INVITE,
    resource: "member",
    resourceId: member._id.toString(),
    status: "SUCCESS",
    details: { email, role },
  });

  return created;
};

const deleteMember = async (id: string, tenantId: string, auditCtx?: AuditContext) => {
  const member = await User.findById(id);

  if (!member || member.tenantId.toString() !== tenantId) {
    throw new AppError("Member not found", httpStatus.NOT_FOUND);
  }

  if (member.role === Role.OWNER) {
    throw new AppError("Cannot remove the OWNER", httpStatus.FORBIDDEN);
  }

  await member.softDelete();

  await logAudit({
    ...buildCtx(auditCtx, id, tenantId),
    action: AuditAction.MEMBER_REMOVE,
    resource: "member",
    resourceId: id,
    status: "SUCCESS",
    details: { email: member.email, role: member.role },
  });

  return { message: "Member removed successfully" };
};

export const memberServices = {
  getMembers,
  createMember,
  deleteMember,
};
