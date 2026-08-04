import { Schema, Document, Model, Query } from "mongoose";

/**
 * Soft-delete plugin.
 *
 * Adds a `deletedAt: Date | null` field and transparently excludes soft-deleted
 * documents from all query operations (find, findOne, count, update, delete...).
 *
 * - `doc.softDelete()`  -> mark as deleted
 * - `doc.restore()`     -> un-mark as deleted
 * - `Model.findDeleted()`     -> only soft-deleted documents
 * - `Model.findWithDeleted()` -> all documents (ignore filter)
 */

export interface SoftDeleteFields {
  deletedAt: Date | null;
}

export interface SoftDeleteDocument extends Document, SoftDeleteFields {
  softDelete: (session?: any) => Promise<this>;
  restore: (session?: any) => Promise<this>;
}

export interface SoftDeleteModel<T extends Document> extends Model<T> {
  findDeleted: () => Query<any[], any>;
  findWithDeleted: () => Query<any[], any>;
}

const HOOKED_QUERY_METHODS = [
  "find",
  "findOne",
  "countDocuments",
  "estimatedDocumentCount",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
] as const;

export function softDeletePlugin(schema: Schema) {
  schema.add({ deletedAt: { type: Date, default: null, index: true } });

  schema.methods.softDelete = function (session?: any) {
    this.deletedAt = new Date();
    return this.save({ session });
  };

  schema.methods.restore = function (session?: any) {
    this.deletedAt = null;
    return this.save({ session });
  };

  // Only inject the filter when the caller did not already specify `deletedAt`
  // (so `findDeleted` / `findWithDeleted` can override it explicitly).
  const injectDeletedFilter = function (this: any) {
    if (this._conditions && this._conditions.deletedAt === undefined) {
      this._conditions.deletedAt = null;
    }
  };

  for (const method of HOOKED_QUERY_METHODS) {
    schema.pre(method as any, injectDeletedFilter);
  }

  schema.statics.findDeleted = function () {
    return this.find({ deletedAt: { $ne: null } });
  };

  schema.statics.findWithDeleted = function () {
    return this.find({ deletedAt: { $exists: true } });
  };
}
