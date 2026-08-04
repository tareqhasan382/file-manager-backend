import { Schema, model, models, Types, Model } from "mongoose";
import { softDeletePlugin, SoftDeleteDocument } from "../shared/plugins/softDelete";
import { applyDocSerializer } from "../shared/utils/docSerializer";

export const AuditAction = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  SIGNUP: "SIGNUP",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET: "PASSWORD_RESET",
  PROFILE_UPDATE: "PROFILE_UPDATE",
  AVATAR_UPDATE: "AVATAR_UPDATE",
  PAYMENT: "PAYMENT",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  SUBSCRIPTION_CREATED: "SUBSCRIPTION_CREATED",
  SUBSCRIPTION_CANCELED: "SUBSCRIPTION_CANCELED",
  SUBSCRIPTION_RENEWED: "SUBSCRIPTION_RENEWED",
  SUBSCRIPTION_UPGRADED: "SUBSCRIPTION_UPGRADED",
  SUBSCRIPTION_DOWNGRADED: "SUBSCRIPTION_DOWNGRADED",
  PLAN_CHANGE: "PLAN_CHANGE",
  FILE_UPLOAD: "FILE_UPLOAD",
  FILE_DELETE: "FILE_DELETE",
  FILE_UPDATE: "FILE_UPDATE",
  FILE_DOWNLOAD: "FILE_DOWNLOAD",
  FOLDER_CREATE: "FOLDER_CREATE",
  FOLDER_DELETE: "FOLDER_DELETE",
  FOLDER_UPDATE: "FOLDER_UPDATE",
  ROLE_CHANGE: "ROLE_CHANGE",
  MEMBER_INVITE: "MEMBER_INVITE",
  MEMBER_REMOVE: "MEMBER_REMOVE",
  TENANT_BAN: "TENANT_BAN",
  TENANT_UNBAN: "TENANT_UNBAN",
  TENANT_CREATE: "TENANT_CREATE",
  ADMIN_ACTION: "ADMIN_ACTION",
  OTP_VERIFY: "OTP_VERIFY",
  OTP_RESEND: "OTP_RESEND",
} as const;

export const AuditStatus = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];
export type AuditStatusValue = (typeof AuditStatus)[keyof typeof AuditStatus];

export interface AuditLogDoc extends SoftDeleteDocument {
  actorId: Types.ObjectId | null;
  actorEmail: string;
  actorRole: string;
  action: AuditActionValue;
  resource: string;
  resourceId: string | null;
  tenantId: Types.ObjectId | null;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any> | null;
  status: AuditStatusValue;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    actorEmail: { type: String, required: true, index: true },
    actorRole: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    resource: { type: String, required: true, index: true },
    resourceId: { type: String, default: null },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      index: true,
      default: null,
    },
    ipAddress: { type: String, required: true, index: true },
    userAgent: { type: String, default: "" },
    details: { type: Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: Object.values(AuditStatus),
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });

applyDocSerializer(auditLogSchema);

export const AuditLog =
  (models.AuditLog as Model<AuditLogDoc>) ||
  model<AuditLogDoc>("AuditLog", auditLogSchema);
