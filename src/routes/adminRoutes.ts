import { Router } from "express";
import { AdminController } from "../controllers/adminController";
import { databaseMiddleware } from "../middleware/databaseMiddleware";

const router = Router();

// Apply database middleware to all admin routes
router.use(databaseMiddleware);

// Clear all sessions
router.delete("/sessions", AdminController.clearAllSessions);

// Clear sessions for specific user
router.delete("/sessions/:userPhone", AdminController.clearUserSessions);

// Clear sessions for specific shop
router.delete("/sessions/shop/:shopId", AdminController.clearShopSessions);

// Get session statistics
router.get("/sessions/stats", AdminController.getSessionStats);

// List bookings with optional filters
router.get("/bookings", AdminController.listBookings);

// List error logs with optional filters
router.get("/error-logs", AdminController.listErrorLogs);

// Delete all bookings
router.delete("/bookings", AdminController.deleteAllBookings);

// Clear all data (nuclear option)
router.delete("/clear-all", AdminController.clearAllData);

export default router;
