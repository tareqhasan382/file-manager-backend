import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";
import { globalErrorHandler } from "./app/middlewares/error.middleware";
import { apiLimiter } from "./app/middlewares/rateLimit.middleware";
import { stripeWebhook } from "./app/modules/billing/stripe.webhook";

const app: Application = express();

/* -------------------- Security Headers -------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'", "https://api.cloudinary.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

/* -------------------- CORS -------------------- */
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "https://file-manager-frontend-lyart.vercel.app","http://localhost:4173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
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

app.use("/api/v1", apiLimiter, router);

/* -------------------- Health -------------------- */
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running 🚀" });
});

/* -------------------- Not Found -------------------- */
app.use(notFound);

/* -------------------- Global Error Handler -------------------- */
app.use(globalErrorHandler);

export default app;
