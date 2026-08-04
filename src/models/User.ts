import { Schema, model, models, Types, Model } from "mongoose";
import { Role } from "../app/enums";
import { softDeletePlugin, SoftDeleteDocument } from "../shared/plugins/softDelete";
import { applyDocSerializer } from "../shared/utils/docSerializer";

export interface UserDoc extends SoftDeleteDocument {
  tenantId: Types.ObjectId;
  email: string;
  password: string;
  role: (typeof Role)[keyof typeof Role];
  fullName: string;
  isVerified: boolean;
  verificationCode: string | null;
  verificationCodeExpires: Date | null;
  verificationCodeSentAt: Date | null;
  resetCode: string | null;
  resetCodeExpires: Date | null;
  resetCodeSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Password is excluded from every read by default; select `+password` explicitly.
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(Role), required: true },
    fullName: { type: String, trim: true, default: "" },
    // Email verification (OTP). New signups start unverified and can't log in.
    isVerified: { type: Boolean, default: false, index: true },
    // OTP codes are stored hashed (bcrypt) and never exposed via the API.
    verificationCode: { type: String, select: false },
    verificationCodeExpires: { type: Date, select: false },
    verificationCodeSentAt: { type: Date, select: false },
    // Password-reset OTP fields.
    resetCode: { type: String, select: false },
    resetCodeExpires: { type: Date, select: false },
    resetCodeSentAt: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.plugin(softDeletePlugin);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Member listing + role scoping within a tenant
userSchema.index({ tenantId: 1, role: 1 });
// Email uniqueness (field-level unique: true above) — global, prevents
// account resurrection across tenants.

applyDocSerializer(userSchema);

export const User =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", userSchema);
