import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.js";
import ingestRoutes from "./routes/ingest.js";
import dashboardRoutes from "./routes/dashboard.js";
import discrepancyRoutes from "./routes/discrepancies.js";
import explainRoutes from "./routes/explain.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/ingest", ingestRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/discrepancies", discrepancyRoutes);
app.use("/api/explain", explainRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server istening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
