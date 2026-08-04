import { z } from "zod";

export const auditLogQuerySchema = z.object({
  query: z.object({
    action: z.string().optional(),
    resource: z.string().optional(),
    status: z.enum(["SUCCESS", "FAILURE"]).optional(),
    tenantId: z.string().optional(),
    actorId: z.string().optional(),
    ipAddress: z.string().optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});
