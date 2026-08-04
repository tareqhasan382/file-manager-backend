import { AuditLog, type AuditActionValue, type AuditStatusValue, type AuditLogDoc } from "../../../models/AuditLog";

interface LogAuditParams {
  actorId?: string | null;
  actorEmail?: string;
  actorRole?: string;
  action: AuditActionValue;
  resource: string;
  resourceId?: string | null;
  tenantId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any> | null;
  status: AuditStatusValue;
}

const createEntry = async (params: LogAuditParams): Promise<void> => {
  try {
    await AuditLog.create({
      actorId: params.actorId || null,
      actorEmail: params.actorEmail || "system",
      actorRole: params.actorRole || "SYSTEM",
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId || null,
      tenantId: params.tenantId || null,
      ipAddress: params.ipAddress || "unknown",
      userAgent: params.userAgent || "",
      details: params.details || null,
      status: params.status,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
};

const getAllAuditLogs = async ({
  filters,
  page = 1,
  limit = 50,
}: {
  filters?: {
    action?: string;
    resource?: string;
    status?: string;
    tenantId?: string;
    actorId?: string;
    ipAddress?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  };
  page?: number;
  limit?: number;
}) => {
  const match: Record<string, any> = {};

  if (filters?.action) match.action = filters.action;
  if (filters?.resource) match.resource = filters.resource;
  if (filters?.status) match.status = filters.status;
  if (filters?.actorId) match.actorId = filters.actorId;
  if (filters?.ipAddress) match.ipAddress = filters.ipAddress;

  if (filters?.tenantId) {
    match.tenantId = filters.tenantId;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    match.createdAt = {};
    if (filters.dateFrom) match.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) match.createdAt.$lte = new Date(filters.dateTo);
  }

  if (filters?.search) {
    match.$or = [
      { actorEmail: { $regex: filters.search, $options: "i" } },
      { action: { $regex: filters.search, $options: "i" } },
      { resource: { $regex: filters.search, $options: "i" } },
      { resourceId: { $regex: filters.search, $options: "i" } },
      { ipAddress: { $regex: filters.search, $options: "i" } },
    ];
  }

  const skip = Math.max((Number(page) - 1) * Number(limit), 0);
  const lim = Math.max(Math.min(Number(limit), 100), 1);

  const [records, total] = await Promise.all([
    AuditLog.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    AuditLog.countDocuments(match),
  ]);

  return {
    records,
    meta: {
      page: Number(page),
      limit: lim,
      total,
      pages: Math.ceil(total / lim),
    },
  };
};

export const auditLogService = {
  createEntry,
  getAllAuditLogs,
};

export type { LogAuditParams };
