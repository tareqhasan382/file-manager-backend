import express, { Application } from "express";
import cors from "cors";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";
import { globalErrorHandler } from "./app/middlewares/error.middleware";

const app: Application = express();

/* -------------------- CORS -------------------- */
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

/* -------------------- Parsers -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- Routes -------------------- */
app.use("/api/v1", router);

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running 🚀",
  });
});

/* -------------------- Not Found -------------------- */
app.use(notFound);

/* -------------------- Global Error Handler -------------------- */
app.use(globalErrorHandler);

export default app;