import { ClientSession } from "mongoose";
import { mongoose } from "../lib/mongoose";

/**
 * Runs `fn` inside a MongoDB multi-document transaction.
 *
 * Requires a replica set (MongoDB Atlas and the bundled docker-compose both
 * provide one). If transactions are unavailable the callback is executed
 * without a session so local/standalone development still works.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (error: any) {
    // Not on a replica set -> fall back to a plain (non-atomic) execution.
    if (
      error?.message &&
      /Transaction numbers are only allowed on a replica set member/.test(
        error.message
      )
    ) {
      return fn(session);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
