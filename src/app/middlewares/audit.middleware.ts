import { Request, Response, NextFunction } from "express";
import { auditLogService, type LogAuditParams } from "../modules/auditlog/auditlog.service";
import { AuditAction, AuditStatus, type AuditActionValue, type AuditStatusValue } from "../../models/AuditLog";

interface AuditContext {
  actorId: string | null;
  actorEmail: string;
  actorRole: string;
  tenantId: string | null;
  ipAddress: string;
  userAgent: string;
}

export function getAuditContext(req: Request): AuditContext {
  const forwarded = req.headers["x-forwarded-for"];
  let ipAddress: string = "unknown";

  if (typeof forwarded === "string") {
    ipAddress = forwarded.split(",")[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    ipAddress = String(forwarded[0]).trim();
  } else if (req.ip) {
    ipAddress = String(req.ip);
  } else if (req.socket?.remoteAddress) {
    ipAddress = String(req.socket.remoteAddress);
  }

  const user = req.user as { id?: string; email?: string; role?: string; tenantId?: string } | undefined;

  return {
    ipAddress,
    userAgent: req.get("User-Agent") || "",
    actorId: user?.id || null,
    actorEmail: user?.email || "anonymous",
    actorRole: user?.role || "anonymous",
    tenantId: user?.tenantId || null,
  };
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  await auditLogService.createEntry(params);
}

export { AuditAction };
export type { AuditContext };

export const auditLogger =
  (config: {
    action: AuditActionValue;
    resource: string;
    getResourceId?: (req: Request) => string | null;
    getDetails?: (req: Request, res: Response) => Record<string, any> | null;
  }) =>
  (req: Request, res: Response, next: NextFunction) => {
    const context = getAuditContext(req);
    const rawId = config.getResourceId
      ? config.getResourceId(req)
      : req.params?.id;
    const resourceId: string | null = rawId ? String(rawId) : null;

    res.on("finish", () => {
      const statusCode = res.statusCode;
      const status: AuditStatusValue =
        statusCode >= 200 && statusCode < 300 ? AuditStatus.SUCCESS : AuditStatus.FAILURE;

      const details = config.getDetails ? config.getDetails(req, res) : null;

      logAudit({
        ...context,
        action: config.action,
        resource: config.resource,
        resourceId,
        details,
        status,
      }).catch((err: any) =>
        console.error("Audit log error (non-blocking):", err)
      );
    });

    next();
  };
