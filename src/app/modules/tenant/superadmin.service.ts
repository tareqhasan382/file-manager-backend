import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { Plan } from "../../../generated/prisma/enums";

// ─── Get All Tenants ──────────────────────────────────────────────────────────
const getAllTenants = async () => {
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: { select: { users: true, files: true, folders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return tenants;
};

// ─── Get Single Tenant ────────────────────────────────────────────────────────
const getTenantById = async (id: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, email: true, role: true, createdAt: true },
      },
      _count: { select: { files: true, folders: true } },
    },
  });

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  return tenant;
};

// ─── Ban / Unban Tenant ───────────────────────────────────────────────────────
const toggleBanTenant = async (id: string) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { isBanned: !tenant.isBanned },
  });

  return {
    message: updated.isBanned
      ? `Tenant "${tenant.name}" has been banned`
      : `Tenant "${tenant.name}" has been unbanned`,
    isBanned: updated.isBanned,
  };
};

// ─── Change Tenant Plan ───────────────────────────────────────────────────────
const changeTenantPlan = async (id: string, plan: string) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { plan: plan as Plan },
  });

  return updated;
};

// ─── Get All Users ────────────────────────────────────────────────────────────
const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    where: { role: { not: "SUPER_ADMIN" } },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      tenant: {
        select: { id: true, name: true, plan: true, isBanned: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users;
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
const getStats = async () => {
  const [
    totalTenants,
    bannedTenants,
    totalUsers,
    totalFiles,
    planCounts,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
    prisma.file.count(),
    prisma.tenant.groupBy({
      by: ["plan"],
      _count: { plan: true },
    }),
  ]);

  return {
    totalTenants,
    bannedTenants,
    activeTenants: totalTenants - bannedTenants,
    totalUsers,
    totalFiles,
    planBreakdown: planCounts.map((p) => ({
      plan: p.plan,
      count: p._count.plan,
    })),
  };
};

export const superAdminServices = {
  getAllTenants,
  getTenantById,
  toggleBanTenant,
  changeTenantPlan,
  getAllUsers,
  getStats,
};