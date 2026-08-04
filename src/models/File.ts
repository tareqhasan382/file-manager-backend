import { Schema, model, models, Types, Model } from "mongoose";
import { softDeletePlugin, SoftDeleteDocument } from "../shared/plugins/softDelete";
import { applyDocSerializer } from "../shared/utils/docSerializer";

export interface FileDoc extends SoftDeleteDocument {
  name: string;
  size: number; // in MB
  mimeType: string;
  url: string; // Cloudinary secure_url
  publicId: string; // Cloudinary public_id
  tenantId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<FileDoc>(
  {
    name: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    path: { type: String, required: true },
  },
  { timestamps: true }
);

fileSchema.plugin(softDeletePlugin);

// ── Indexes ───────────────────────────────────────────────────────────────────
// The hot path: list files inside a folder (or whole tenant) newest-first
fileSchema.index({ tenantId: 1, folderId: 1, createdAt: -1 });
// Duplicate-name detection within the same folder + tenant
fileSchema.index({ tenantId: 1, name: 1, folderId: 1 });
// A Cloudinary asset should only ever be referenced once (among live rows)
fileSchema.index(
  { publicId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

applyDocSerializer(fileSchema);

export const File = (models.File as Model<FileDoc>) || model<FileDoc>("File", fileSchema);
