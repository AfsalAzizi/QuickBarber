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

// List barbers for a shop (defaults to active=true)
router.get("/barbers", AdminController.listBarbers);

// Add a new barber to a shop
router.post("/barbers", AdminController.addBarber);

// Update a barber (by barberId) with query shop_id
router.patch("/barbers/:barberId", AdminController.updateBarber);

// Delete a barber from a shop
router.delete("/barbers/:barberId", AdminController.deleteBarber);

// Notify next booking for a barber
router.post(
  "/barbers/:barberId/notify-next",
  AdminController.notifyNextBooking
);

// Cancel all future bookings for a barber
router.post(
  "/barbers/:barberId/cancel-future-bookings",
  AdminController.cancelAllFutureBookings
);

// Get shop settings and barbers
router.get("/shop-summary", AdminController.getShopSummary);

// Update shop name
router.patch("/shop-name", AdminController.updateShopName);

// Clear all data (nuclear option)
router.delete("/clear-all", AdminController.clearAllData);

export default router;
