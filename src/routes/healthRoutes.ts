import { Router } from "express";
import { HealthController } from "@/controllers/healthController";
import { optionalDatabaseMiddleware } from "@/middleware/databaseMiddleware";

const router = Router();

// Apply optional database middleware (doesn't fail if DB is down)
router.use(optionalDatabaseMiddleware);

// Basic health check endpoint
router.get("/", HealthController.getHealth);

// Database health check endpoint
router.get("/db", HealthController.getDatabaseHealth);

// Simple test endpoint (no DB required)
router.get("/test", HealthController.getTest);

// Environment variables check
router.get("/env", HealthController.getEnvironment);

export default router;
