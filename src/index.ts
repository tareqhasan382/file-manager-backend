import { Server } from "http";
import app from "./app";
import config from "./config";


//uncaught Exception handle
process.on("uncaughtException", (error) => {
  // console.log(error);
  process.exit(1);
});
let server: Server;
async function main() {
  try {
    // here database connect

    server = app.listen(config.port, () => {
      console.log(`Server is running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.log("Field to connect Database", error);
  }

  process.on("unhandledRejection", (error) => {
    if (server) {
      server.close(() => {
        // console.log(error);
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

main();

process.on("SIGTERM", () => {
  // console.log("SIGTERM is received");
  if (server) {
    server.close();
  }
});