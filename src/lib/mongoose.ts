import mongoose from "mongoose";
import config from "../config";

let cached: Promise<typeof mongoose> | null = null;

export const connectDB = async (): Promise<typeof mongoose> => {
  if (!config.mongodb_uri) {
    throw new Error("MONGODB_URI / DATABASE_URL is not configured");
  }

  if (cached) return cached;

  mongoose.set("strictQuery", true);

  cached = mongoose.connect(config.mongodb_uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
    cached = null;
  });
  mongoose.connection.on("disconnected", () => {
    cached = null;
  });

  return cached;
};

export { mongoose };
