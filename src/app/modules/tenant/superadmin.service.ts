import { Types } from "mongoose";
import { AppError } from "../../../utils/app_error";
import httpStatus from "http-status";
import { Tenant } from "../../../models/Tenant";
import { User } from "../../../models/User";
import { File } from "../../../models/File";
import { Folder } from "../../../models/Folder";
import { Billing, BillingStatus, BillingType } from "../../../models/Billing";
import { Plan } from "../../enums";
import { AuditAction, logAudit, type AuditContext } from "../../middlewares/audit.middleware";
import { auditLogService } from "../auditlog/auditlog.service";

const TENANT_COUNT_PROJECTION = {
  id: { $toString: "$_id" },
  _id: 0,
  name: 1,
  plan: 1,
  subscriptionStatus: 1,
  isBanned: 1,
  storageUsed: 1,
  createdAt: 1,
  updatedAt: 1,
  _count: 1,
};

// ─── Get All Tenants ──────────────────────────────────────────────────────────
// Single aggregation: tenant rows + live counts via $lookup + $size (no N+1)
const getAllTenants = async () => {
  return Tenant.aggregate([
    { $match: { deletedAt: null } },
    {
      $lookup: {
        from: "users",
        let: { tid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$tenantId", "$$tid"] }, deletedAt: null } },
        ],
        as: "users",
      },
    },
    {
      $lookup: {
        from: "files",
        let: { tid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$tenantId", "$$tid"] }, deletedAt: null } },
        ],
        as: "files",
      },
    },
    {
      $lookup: {
        from: "folders",
        let: { tid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$tenantId", "$$tid"] }, deletedAt: null } },
        ],
        as: "folders",
      },
    },
    {
      $project: {
        ...TENANT_COUNT_PROJECTION,
        _count: {
          users: { $size: "$users" },
          files: { $size: "$files" },
          folders: { $size: "$folders" },
        },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
};

// ─── Get Single Tenant ────────────────────────────────────────────────────────
const getTenantById = async (id: string) => {
  const [tenant] = await Tenant.aggregate([
    { $match: { _id: new Types.ObjectId(id), deletedAt: null } },
    {
      $lookup: {
        from: "users",
        let: { tid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$tenantId", "$$tid"] }, deletedAt: null } },
          { $sort: { createdAt: -1 } },
          {
            $project: {
              id: { $toString: "$_id" },
              _id: 0,
              email: 1,
              role: 1,
              fullName: 1,
              createdAt: 1,
            },
          },
        ],
        as: "users",
      },
    },
    {
      $lookup: {
        from: "files",
        let: { tid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$tenantId", "$$tid"] }, deletedAt: null } },
        ],
        as: "files",
      },
    },
    {
      $lookup: {
        from: "folders",
        let: { tid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$tenantId", "$$tid"] }, deletedAt: null } },
        ],
        as: "folders",
      },
    },
    {
      $project: {
        ...TENANT_COUNT_PROJECTION,
        users: 1,
        _count: {
          files: { $size: "$files" },
          folders: { $size: "$folders" },
        },
      },
    },
  ]);

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  return tenant;
};

// ─── Ban / Unban Tenant ───────────────────────────────────────────────────────
const toggleBanTenant = async (id: string, auditCtx?: AuditContext) => {
  const tenant = await Tenant.findById(id);

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  const updated = await Tenant.findByIdAndUpdate(
    id,
    { isBanned: !tenant.isBanned },
    { new: true }
  );

  const action = updated!.isBanned ? AuditAction.TENANT_BAN : AuditAction.TENANT_UNBAN;
  await logAudit({
    ...(auditCtx || { actorId: null, actorEmail: "system", actorRole: "SYSTEM", tenantId: null, ipAddress: "api", userAgent: "" }),
    action,
    resource: "tenant",
    resourceId: id,
    tenantId: id,
    status: "SUCCESS",
    details: { isBanned: updated!.isBanned, tenantName: tenant.name },
  });

  return {
    message: updated!.isBanned
      ? `Tenant "${tenant.name}" has been banned`
      : `Tenant "${tenant.name}" has been unbanned`,
    isBanned: updated!.isBanned,
  };
};

// ─── Change Tenant Plan ───────────────────────────────────────────────────────
const changeTenantPlan = async (id: string, plan: string, auditCtx?: AuditContext) => {
  const tenant = await Tenant.findById(id);

  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  const updated = await Tenant.findByIdAndUpdate(
    id,
    { plan: plan as Plan },
    { new: true }
  );

  if (updated && updated.plan !== tenant.plan) {
    await Billing.create({
      tenantId: updated._id,
      plan: updated.plan,
      type: BillingType.SUBSCRIPTION,
      status: BillingStatus.ACTIVE,
      amount: 0,
      currency: "usd",
      description: `Plan changed by admin: ${tenant.plan} → ${updated.plan}`,
    });

    await logAudit({
      ...(auditCtx || { actorId: null, actorEmail: "system", actorRole: "SYSTEM", tenantId: null, ipAddress: "api", userAgent: "" }),
      action: AuditAction.PLAN_CHANGE,
      resource: "tenant",
      resourceId: id,
      tenantId: id,
      status: "SUCCESS",
      details: { previousPlan: tenant.plan, newPlan: updated!.plan },
    });
  }

  return updated;
};

// ─── Get All Users ────────────────────────────────────────────────────────────
// Single aggregation with $lookup to embed tenant info (avoids N+1)
const getAllUsers = async () => {
  return User.aggregate([
    { $match: { deletedAt: null, role: { $ne: "SUPER_ADMIN" } } },
    {
      $lookup: {
        from: "tenants",
        let: { tid: "$tenantId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$tid"] },
              deletedAt: null,
            },
          },
          {
            $project: {
              id: { $toString: "$_id" },
              _id: 0,
              name: 1,
              plan: 1,
              isBanned: 1,
            },
          },
        ],
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        id: { $toString: "$_id" },
        _id: 0,
        email: 1,
        role: 1,
        fullName: 1,
        createdAt: 1,
        updatedAt: 1,
        tenant: 1,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
const getStats = async () => {
  const [tenantAgg, totalFiles, totalUsers] = await Promise.all([
    Tenant.aggregate([
      { $match: { deletedAt: null } },
      {
        $facet: {
          totalTenants: [{ $count: "count" }],
          bannedTenants: [{ $match: { isBanned: true } }, { $count: "count" }],
          planBreakdown: [
            { $group: { _id: "$plan", count: { $sum: 1 } } },
          ],
        },
      },
    ]),
    File.countDocuments({}),
    User.countDocuments({ role: { $ne: "SUPER_ADMIN" } }),
  ]);

  const data = tenantAgg[0] || {};
  const totalTenants = data.totalTenants[0]?.count ?? 0;
  const bannedTenants = data.bannedTenants[0]?.count ?? 0;

  return {
    totalTenants,
    bannedTenants,
    activeTenants: totalTenants - bannedTenants,
    totalUsers,
    totalFiles,
    planBreakdown: (data.planBreakdown || []).map((p: any) => ({
      plan: p._id,
      count: p.count,
    })),
  };
};

// ─── Billing Ledger (all tenants) ─────────────────────────────────────────────
const getAllBilling = async () => {
  const records = await Billing.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "tenants",
        localField: "tenantId",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        id: { $toString: "$_id" },
        _id: 0,
        tenantId: { $toString: "$tenantId" },
        tenantName: "$tenant.name",
        plan: 1,
        previousPlan: 1,
        type: 1,
        status: 1,
        amount: 1,
        currency: 1,
        description: 1,
        stripeSubscriptionId: 1,
        stripeCheckoutId: 1,
        stripeInvoiceId: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  const [summary] = await Billing.aggregate([
    {
      $facet: {
        totalRecords: [{ $count: "count" }],
        totalRevenue: [
          {
            $match: {
              status: { $in: [BillingStatus.PAID, BillingStatus.COMPLETED] },
              type: BillingType.PAYMENT,
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ],
        paidPayments: [
          {
            $match: {
              status: { $in: [BillingStatus.PAID, BillingStatus.COMPLETED] },
              type: BillingType.PAYMENT,
            },
          },
          { $count: "count" },
        ],
        activeSubscriptions: [
          {
            $match: {
              status: BillingStatus.ACTIVE,
              stripeSubscriptionId: { $ne: null },
            },
          },
          { $group: { _id: "$stripeSubscriptionId" } },
          { $count: "count" },
        ],
        failedPayments: [
          { $match: { status: BillingStatus.FAILED } },
          { $count: "count" },
        ],
        pendingCheckouts: [
          { $match: { status: BillingStatus.PENDING } },
          { $count: "count" },
        ],
      },
    },
  ]);

  return {
    records,
    summary: {
      totalRecords: summary?.totalRecords?.[0]?.count ?? 0,
      totalRevenue: summary?.totalRevenue?.[0]?.total ?? 0,
      paidPayments: summary?.paidPayments?.[0]?.count ?? 0,
      activeSubscriptions: summary?.activeSubscriptions?.[0]?.count ?? 0,
      failedPayments: summary?.failedPayments?.[0]?.count ?? 0,
      pendingCheckouts: summary?.pendingCheckouts?.[0]?.count ?? 0,
    },
  };
};

// ─── Get User Detail (admin) ──────────────────────────────────────────────────
const getUserDetail = async (userId: string) => {
  const user = await User.findById(userId)
    .select(
      "id email fullName role avatar phone isVerified createdAt updatedAt"
    )
    .populate("tenantId", "name plan subscriptionStatus isBanned storageUsed createdAt updatedAt")
    .lean();

  if (!user) {
    throw new AppError("User not found", httpStatus.NOT_FOUND);
  }

  const billing = await Billing.find({ tenantId: user.tenantId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return {
    user,
    billing,
  };
};

// ─── Get Tenant Billing History (admin) ───────────────────────────────────────
const getTenantBilling = async (tenantId: string) => {
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) {
    throw new AppError("Tenant not found", httpStatus.NOT_FOUND);
  }

  const records = await Billing.find({ tenantId })
    .sort({ createdAt: -1 })
    .lean();

  const [summary] = await Billing.aggregate([
    { $match: { tenantId: new Types.ObjectId(tenantId) } },
    {
      $facet: {
        totalRecords: [{ $count: "count" }],
        totalSpent: [
          {
            $match: {
              status: { $in: [BillingStatus.PAID, BillingStatus.COMPLETED] },
              type: BillingType.PAYMENT,
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ],
        paidPayments: [
          {
            $match: {
              status: { $in: [BillingStatus.PAID, BillingStatus.COMPLETED] },
              type: BillingType.PAYMENT,
            },
          },
          { $count: "count" },
        ],
        pendingCheckouts: [
          { $match: { status: BillingStatus.PENDING } },
          { $count: "count" },
        ],
        failedPayments: [
          { $match: { status: BillingStatus.FAILED } },
          { $count: "count" },
        ],
      },
    },
  ]);

  return {
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      plan: tenant.plan,
      subscriptionStatus: tenant.subscriptionStatus,
      isBanned: tenant.isBanned,
      stripeCustomerId: tenant.stripeCustomerId,
      storageUsed: tenant.storageUsed,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    },
    records,
    summary: {
      totalRecords: summary?.totalRecords?.[0]?.count ?? 0,
      totalSpent: summary?.totalSpent?.[0]?.total ?? 0,
      paidPayments: summary?.paidPayments?.[0]?.count ?? 0,
      pendingCheckouts: summary?.pendingCheckouts?.[0]?.count ?? 0,
      failedPayments: summary?.failedPayments?.[0]?.count ?? 0,
    },
  };
};

const getAuditLogs = async (query: any) => {
  return auditLogService.getAllAuditLogs({
    filters: {
      action: query.action,
      resource: query.resource,
      status: query.status,
      tenantId: query.tenantId,
      actorId: query.actorId,
      ipAddress: query.ipAddress,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
    },
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 50,
  });
};

export const superAdminServices = {
  getAllTenants,
  getTenantById,
  toggleBanTenant,
  changeTenantPlan,
  getAllUsers,
  getStats,
  getAllBilling,
  getUserDetail,
  getTenantBilling,
  getAuditLogs,
};
