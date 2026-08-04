import { Schema, model, models, Types, Model } from "mongoose";
import { softDeletePlugin, SoftDeleteDocument } from "../shared/plugins/softDelete";
import { applyDocSerializer } from "../shared/utils/docSerializer";

export interface FolderDoc extends SoftDeleteDocument {
  name: string;
  tenantId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<FolderDoc>(
  {
    name: { type: String, required: true, trim: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    // Logical path, e.g. "/documents/invoices"
    path: { type: String, required: true },
  },
  { timestamps: true }
);

folderSchema.plugin(softDeletePlugin);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Duplicate-name detection within the same parent + tenant (only among live rows)
folderSchema.index(
  { tenantId: 1, parentId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
// Flat browsing of a parent's children
folderSchema.index({ tenantId: 1, parentId: 1 });
// Path-based lookups (breadcrumbs / API)
folderSchema.index({ tenantId: 1, path: 1 });

applyDocSerializer(folderSchema);

export const Folder =
  (models.Folder as Model<FolderDoc>) || model<FolderDoc>("Folder", folderSchema);
