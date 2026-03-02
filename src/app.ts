import express, { Application } from "express";
import cors from "cors";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";
import { globalErrorHandler } from "./app/middlewares/error.middleware";
import { stripeWebhook } from "./app/modules/billing/stripe.webhook";

const app: Application = express();

/* -------------------- CORS -------------------- */
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000","https://file-manager-frontend-lyart.vercel.app"],
  credentials: true,
}));

/* -------------------- Stripe Webhook -------------------- */
app.post(
  "/api/v1/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

/* -------------------- JSON Parsers -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- Routes -------------------- */

app.use("/api/v1", router);

/* -------------------- Health -------------------- */
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running 🚀" });
});

/* -------------------- Not Found -------------------- */
app.use(notFound);

/* -------------------- Global Error Handler -------------------- */
app.use(globalErrorHandler);

export default app;