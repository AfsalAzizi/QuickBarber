import { Router } from "express";
import webhookRoutes from "./webhookRoutes";
import healthRoutes from "./healthRoutes";
import adminRoutes from "./adminRoutes";

const router = Router();

// API routes
router.use("/webhook", webhookRoutes);
router.use("/health", healthRoutes);
router.use("/admin", adminRoutes);

// Root endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "QuickBarber API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: "/api/webhook",
      health: "/api/health",
      admin: "/api/admin",
    },
  });
});

export default router;
