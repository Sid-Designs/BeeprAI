import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import errorMiddleware from "./middlewares/error.middleware.js";
import { globalLimiter } from "./middlewares/rateLimiter.middleware.js";

// ─── Existing routes (untouched functionality) ────────────────────────────────
import healthRoutes from "./routes/health.route.js";
import tenantRoutes from "./routes/tenant.route.js";
import agentRoutes from "./routes/agent.route.js";
import kbRoutes from "./routes/kb.route.js";
import aiRoutes from "./routes/ai.route.js";
import livekitRoutes from "./routes/livekit.route.js";
import callRoutes from "./routes/call.route.js";
import callAnalysisRoutes from "./routes/callAnalysis.route.js";
import adminRoutes from "./routes/admin.route.js";
import realtimeRoutes from "./realtime/api/realtime.route.js";

// ─── New auth routes ──────────────────────────────────────────────────────────
import authRoutes from "./routes/auth.route.js";
import organizationRoutes from "./routes/organization.route.js";
import userRoutes from "./routes/user.route.js";
import paymentRoutes from "./routes/payment.route.js";
import bulkCampaignRoutes from "./routes/bulkCampaign.route.js";
import calendarRoutes from "./routes/calendar.route.js";
import appointmentRoutes from "./routes/appointment.route.js";
import { webhook as paymentWebhook } from "./controllers/payment.controller.js";

const app = express();

// Next.js API proxy (and production load balancers) send X-Forwarded-For.
// Required for express-rate-limit and correct client IP detection.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === "false") {
  app.set("trust proxy", false);
} else if (trustProxy) {
  const parsed = Number(trustProxy);
  app.set("trust proxy", Number.isNaN(parsed) ? trustProxy : parsed);
} else {
  app.set("trust proxy", 1);
}

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed.`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Internal-Token",
    ],
  }),
);

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
// LiveKit SIP webhook needs raw body for signature verification — must come first
app.use("/api/livekit/sip/webhook", express.raw({ type: "*/*" }));
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentWebhook,
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Auth routes (public) ─────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);

// ─── Resource routes (protected — middleware applied inside each route file) ──
app.use("/api/organization", organizationRoutes);
app.use("/api/user", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/bulk-campaigns", bulkCampaignRoutes);

// ─── Existing routes ──────────────────────────────────────────────────────────
app.use("/api", healthRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/tenant/:tenantId/calendar", calendarRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/kb", kbRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/call", callRoutes);
app.use("/api/call-analysis", callAnalysisRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/livekit", livekitRoutes);
app.use("/api/realtime", realtimeRoutes);

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Beepr API is running...");
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
