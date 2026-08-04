import { Schema } from "mongoose";

/**
 * Applies a consistent `toJSON` / `toObject` transform so documents exposed to
 * the API always use:
 *   - `id` (string) instead of `_id`
 *   - stringified ObjectId references (`tenantId`, `folderId`, `parentId`)
 *   - no `__v` and no internal `deletedAt` field
 */
export function applyDocSerializer(schema: Schema) {
  const transform = (_doc: unknown, ret: Record<string, any>) => {
    if (ret._id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.deletedAt;

    for (const ref of ["tenantId", "folderId", "parentId"]) {
      if (ret[ref]) ret[ref] = ret[ref].toString();
    }
    return ret;
  };

  schema.set("toJSON", { virtuals: true, versionKey: false, transform });
  schema.set("toObject", { virtuals: true, versionKey: false, transform });
}

export function toIdString(value: unknown): string | null {
  if (!value) return null;
  return value.toString();
}
