import { Server } from "http";
import app from "./app";
import config from "./config";
import { connectDB, mongoose } from "./lib/mongoose";

// uncaught Exception handle
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

let server: Server;

async function main() {
  try {
    // Connect to MongoDB (Atlas / replica set supports multi-doc transactions)
    await connectDB();
    console.log("MongoDB connected successfully");

    server = app.listen(config.port, () => {
      console.log(`Server is running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("Failed to connect Database:", error);
    process.exit(1);
  }

  process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
    if (server) {
      server.close(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

main();

const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  if (server) server.close();
  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
