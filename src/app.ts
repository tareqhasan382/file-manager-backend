import express, { Application } from "express";
const app: Application = express();
import cors from "cors";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

//parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Applications route
app.use("/api/v1", router);
app.get("/", (req, res) => {
  res.status(200).json({ status: 200, message: " Our server is Running 🚀" });
});

app.use(notFound);

app.use((err: any, req: any, res: any, next: any) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;