import { Request, Response } from "express";
import {
  Session,
  WabaNumber,
  Settings,
  ServiceCatalog,
  Barber,
  Booking,
  ErrorLog,
} from "../models";
import { sendWhatsAppMessage } from "../services/whatsappService";
import moment from "moment-timezone";
import { ISettings, IBarber, IBooking } from "@/types/models";
import { ApiResponse } from "../types/express";

export class AdminController {
  // List barbers for a shop
  static async listBarbers(req: Request, res: Response): Promise<void> {
    try {
      const { shop_id, active } = req.query as Record<string, string>;
      if (!shop_id) {
        res.status(400).json({ success: false, error: "shop_id is required" });
        return;
      }

      const query: any = { shop_id };
      if (typeof active !== "undefined") {
        query.active = active === "true";
      } else {
        // default to active barbers only
        query.active = true;
      }

      const barbers = await Barber.find(query).sort({ sort_order: 1 }).lean();
      res.status(200).json({ success: true, data: barbers });
    } catch (error: unknown) {
      console.error("Error listing barbers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list barbers",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Update a barber (name, active, and any extra fields provided)
  static async updateBarber(req: Request, res: Response): Promise<void> {
    try {
      const { barberId } = req.params as { barberId: string };
      const { shop_id } = req.query as Record<string, string>;
      if (!shop_id || !barberId) {
        res
          .status(400)
          .json({ success: false, error: "shop_id and barberId are required" });
        return;
      }

      const payload = req.body as Record<string, any>;
      if (!payload || typeof payload !== "object") {
        res
          .status(400)
          .json({ success: false, error: "Request body must be an object" });
        return;
      }

      // Allow updating name and active, and any additional provided fields
      const toSet: Record<string, any> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (key === "barber_id" || key === "shop_id" || key === "_id") continue;
        toSet[key] = value;
      }

      const updated = await Barber.findOneAndUpdate(
        { shop_id, barber_id: barberId },
        { $set: toSet },
        { new: true }
      ).lean();

      if (!updated) {
        res.status(404).json({ success: false, error: "Barber not found" });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error: unknown) {
      console.error("Error updating barber:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update barber",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get shop settings and barbers by shop_id
  static async getShopSummary(req: Request, res: Response): Promise<void> {
    try {
      const { shop_id } = req.query as Record<string, string>;
      if (!shop_id) {
        res.status(400).json({ success: false, error: "shop_id is required" });
        return;
      }

      const settings = await Settings.findOne({
        shop_id,
      }).lean<ISettings | null>();
      if (!settings) {
        res.status(404).json({ success: false, error: "Settings not found" });
        return;
      }

      // Always return all barbers irrespective of active flag
      const barbers = await Barber.find({ shop_id })
        .sort({ sort_order: 1 })
        .lean();

      res.status(200).json({ success: true, data: { settings, barbers } });
    } catch (error: unknown) {
      console.error("Error getting shop summary:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get shop summary",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Update shop name
  static async updateShopName(req: Request, res: Response): Promise<void> {
    try {
      const { shop_id } = req.query as Record<string, string>;
      const { shop_name } = req.body as { shop_name?: string };

      if (!shop_id) {
        res.status(400).json({ success: false, error: "shop_id is required" });
        return;
      }
      if (
        !shop_name ||
        typeof shop_name !== "string" ||
        shop_name.trim() === ""
      ) {
        res
          .status(400)
          .json({ success: false, error: "shop_name is required" });
        return;
      }

      const updated = await Settings.findOneAndUpdate(
        { shop_id },
        { $set: { shop_name: shop_name.trim() } },
        { new: true }
      ).lean();

      if (!updated) {
        res.status(404).json({ success: false, error: "Settings not found" });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error: unknown) {
      console.error("Error updating shop name:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update shop name",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Notify next booking for a barber: POST /admin/barbers/:barberId/notify-next?shop_id=QS001
  static async notifyNextBooking(req: Request, res: Response): Promise<void> {
    try {
      const { barberId } = req.params as { barberId: string };
      const { shop_id } = req.query as Record<string, string>;
      if (!shop_id || !barberId) {
        res
          .status(400)
          .json({ success: false, error: "shop_id and barberId are required" });
        return;
      }

      const settings = (await Settings.findOne({
        shop_id,
      }).lean()) as ISettings | null;
      if (!settings) {
        res.status(404).json({ success: false, error: "Settings not found" });
        return;
      }

      const barber = await Barber.findOne({
        shop_id,
        barber_id: barberId,
      }).lean<IBarber | null>();
      if (!barber) {
        res.status(404).json({ success: false, error: "Barber not found" });
        return;
      }

      const tz =
        (settings as ISettings).time_zone ||
        (settings as any).timezone ||
        "UTC";
      const nowTz = moment().tz(tz);
      const today = nowTz.clone().startOf("day").toDate();
      const todayEnd = nowTz.clone().endOf("day").toDate();
      const nowHHmm = nowTz.format("HH:mm");

      // Find next upcoming booking today for this barber
      const next = await Booking.findOne({
        shop_id,
        barber_id: barberId,
        status: { $in: ["pending", "confirmed"] },
        date: { $gte: today, $lte: todayEnd },
        start_time: { $gte: nowHHmm },
      })
        .sort({ date: 1, start_time: 1 })
        .lean<IBooking | null>();

      if (!next) {
        res.status(404).json({
          success: false,
          error: "No upcoming booking found for today",
        });
        return;
      }

      const msg = `Good news — your appointment with ${barber.name} is ready. You can come anytime now. See you soon!`;
      await sendWhatsAppMessage(next.customer_phone, msg);

      res.status(200).json({
        success: true,
        data: { notified: next.customer_phone, booking_id: next.booking_id },
      });
    } catch (error: unknown) {
      console.error("Error notifying next booking:", error);
      res.status(500).json({
        success: false,
        error: "Failed to notify next booking",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Cancel all future bookings for a barber: POST /admin/barbers/:barberId/cancel-future-bookings?shop_id=QS001
  static async cancelAllFutureBookings(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { barberId } = req.params as { barberId: string };
      const { shop_id } = req.query as Record<string, string>;

      if (!shop_id || !barberId) {
        res
          .status(400)
          .json({ success: false, error: "shop_id and barberId are required" });
        return;
      }

      // Get shop settings to determine timezone
      const settings = await Settings.findOne({
        shop_id,
      }).lean<ISettings | null>();

      if (!settings) {
        res.status(404).json({ success: false, error: "Settings not found" });
        return;
      }

      // Check if barber exists and belongs to the shop
      const barber = await Barber.findOne({
        shop_id,
        barber_id: barberId,
      }).lean<IBarber | null>();

      if (!barber) {
        res.status(404).json({ success: false, error: "Barber not found" });
        return;
      }

      // Calculate current time in the shop's timezone
      const tz = settings.time_zone || "UTC";
      const nowTz = moment().tz(tz);
      const now = nowTz.toDate();

      // Find all future bookings for this barber
      const futureBookings = await Booking.find({
        barber_id: barberId,
        shop_id,
        status: { $in: ["pending", "confirmed"] },
        $or: [
          { date: { $gt: now } },
          {
            date: { $gte: nowTz.clone().startOf("day").toDate() },
            start_time: { $gt: nowTz.format("HH:mm") },
          },
        ],
      }).lean<IBooking[]>();

      if (futureBookings.length === 0) {
        res.status(200).json({
          success: true,
          message: "No future bookings found to cancel",
          data: { cancelled_count: 0, barber_name: barber.name },
        });
        return;
      }

      // Cancel all future bookings
      const updateResult = await Booking.updateMany(
        {
          barber_id: barberId,
          shop_id,
          status: { $in: ["pending", "confirmed"] },
          $or: [
            { date: { $gt: now } },
            {
              date: { $gte: nowTz.clone().startOf("day").toDate() },
              start_time: { $gt: nowTz.format("HH:mm") },
            },
          ],
        },
        {
          $set: {
            status: "cancelled",
            updated_at: new Date(),
          },
        }
      );

      // Send cancellation notifications to customers
      const notificationPromises = futureBookings.map(async (booking) => {
        try {
          const cancellationMessage = `We're sorry to inform you that your appointment with ${
            barber.name
          } on ${moment(booking.date).tz(tz).format("MMMM Do, YYYY")} at ${
            booking.start_time
          } has been cancelled. Please contact us to reschedule. We apologize for any inconvenience.`;
          await sendWhatsAppMessage(
            booking.customer_phone,
            cancellationMessage
          );
          return {
            success: true,
            phone: booking.customer_phone,
            booking_id: booking.booking_id,
          };
        } catch (error) {
          console.error(
            `Failed to send cancellation notification to ${booking.customer_phone}:`,
            error
          );
          return {
            success: false,
            phone: booking.customer_phone,
            booking_id: booking.booking_id,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const notificationResults = await Promise.all(notificationPromises);
      const successfulNotifications = notificationResults.filter(
        (result) => result.success
      ).length;
      const failedNotifications = notificationResults.filter(
        (result) => !result.success
      );

      // Deactivate active sessions for affected customers in this shop
      const affectedPhones = Array.from(
        new Set(futureBookings.map((b) => b.customer_phone))
      );
      if (affectedPhones.length > 0) {
        await Session.updateMany(
          { shop_id, user_phone: { $in: affectedPhones }, is_active: true },
          {
            $set: {
              is_active: false,
              updated_at_iso: new Date(),
              intent: null,
              wa_context_id: null,
            },
          }
        );
      }

      res.status(200).json({
        success: true,
        message: `Successfully cancelled ${updateResult.modifiedCount} future bookings for ${barber.name}`,
        data: {
          barber_name: barber.name,
          cancelled_count: updateResult.modifiedCount,
          notifications_sent: successfulNotifications,
          notification_failures: failedNotifications.length,
          failed_notifications: failedNotifications,
        },
      });
    } catch (error: unknown) {
      console.error("Error cancelling future bookings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to cancel future bookings",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  // Add a new barber to a shop
  static async addBarber(req: Request, res: Response): Promise<void> {
    try {
      const { shop_id } = req.query as Record<string, string>;
      const { name } = req.body as { name: string };

      if (!shop_id) {
        res.status(400).json({ success: false, error: "shop_id is required" });
        return;
      }

      if (!name || typeof name !== "string" || name.trim() === "") {
        res.status(400).json({ success: false, error: "name is required" });
        return;
      }

      // Generate unique barber_id
      const barberId = `BARBER_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Get the next sort order for this shop
      const lastBarber = await Barber.findOne({ shop_id })
        .sort({ sort_order: -1 })
        .lean<IBarber | null>();
      const nextSortOrder = lastBarber ? (lastBarber.sort_order || 0) + 1 : 1;

      // Default working hours (9 AM to 6 PM, Monday to Friday)
      const defaultWorkingHours = {
        monday: { start: "09:00", end: "18:00", is_working: true },
        tuesday: { start: "09:00", end: "18:00", is_working: true },
        wednesday: { start: "09:00", end: "18:00", is_working: true },
        thursday: { start: "09:00", end: "18:00", is_working: true },
        friday: { start: "09:00", end: "18:00", is_working: true },
        saturday: { start: "09:00", end: "18:00", is_working: false },
        sunday: { start: "09:00", end: "18:00", is_working: false },
      };

      const newBarber = new Barber({
        barber_id: barberId,
        shop_id,
        name: name.trim(),
        active: true,
        sort_order: nextSortOrder,
        working_hours: defaultWorkingHours,
        specialties: [],
      });

      await newBarber.save();

      res.status(201).json({
        success: true,
        data: newBarber,
        message: "Barber added successfully",
      });
    } catch (error: unknown) {
      console.error("Error adding barber:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add barber",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Delete a barber from a shop
  static async deleteBarber(req: Request, res: Response): Promise<void> {
    try {
      const { barberId } = req.params as { barberId: string };
      const { shop_id } = req.query as Record<string, string>;

      if (!shop_id) {
        res.status(400).json({ success: false, error: "shop_id is required" });
        return;
      }

      if (!barberId) {
        res.status(400).json({ success: false, error: "barberId is required" });
        return;
      }

      // Check if barber exists and belongs to the shop
      const barber = await Barber.findOne({
        barber_id: barberId,
        shop_id,
      }).lean();

      if (!barber) {
        res.status(404).json({
          success: false,
          error: "Barber not found or does not belong to this shop",
        });
        return;
      }

      // Get shop settings to determine timezone
      const settings = await Settings.findOne({
        shop_id,
      }).lean<ISettings | null>();

      if (!settings) {
        res.status(404).json({ success: false, error: "Settings not found" });
        return;
      }

      // Calculate today's date range in the shop's timezone
      const tz = settings.time_zone || "UTC";
      const nowTz = moment().tz(tz);
      const today = nowTz.clone().startOf("day").toDate();
      const todayEnd = nowTz.clone().endOf("day").toDate();

      // Check if barber has any active bookings for today only
      const activeBookingsToday = await Booking.countDocuments({
        barber_id: barberId,
        shop_id,
        status: { $in: ["pending", "confirmed"] },
        date: { $gte: today, $lte: todayEnd },
      });

      if (activeBookingsToday > 0) {
        res.status(400).json({
          success: false,
          error:
            "Cannot delete barber with active bookings for today. Please cancel or complete today's bookings first.",
        });
        return;
      }

      // Delete the barber
      await Barber.deleteOne({
        barber_id: barberId,
        shop_id,
      });

      res.status(200).json({
        success: true,
        message: "Barber deleted successfully",
        data: { deleted_barber_id: barberId },
      });
    } catch (error: unknown) {
      console.error("Error deleting barber:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete barber",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // List error logs with optional filters
  static async listErrorLogs(req: Request, res: Response): Promise<void> {
    try {
      const { user_phone, shop_id, limit } = req.query as Record<
        string,
        string
      >;

      const query: any = {};
      if (user_phone) query.user_phone = user_phone;
      if (shop_id) query.shop_id = shop_id;

      const parsedLimit = Math.min(Math.max(parseInt(limit || "100"), 1), 500);

      const logs = await ErrorLog.find(query)
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .lean();

      const response: ApiResponse = {
        success: true,
        data: logs,
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error listing error logs:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to list error logs",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }

  // Delete all bookings
  static async deleteAllBookings(req: Request, res: Response): Promise<void> {
    try {
      const result = await Booking.deleteMany({});
      const response: ApiResponse = {
        success: true,
        message: "All bookings deleted",
        data: { deletedCount: result.deletedCount },
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error deleting all bookings:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to delete bookings",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }
  // List bookings with optional filters
  static async listBookings(req: Request, res: Response): Promise<void> {
    try {
      const { shop_id, barber_id, from, to, status, date } =
        req.query as Record<string, string>;

      if (!shop_id) {
        res.status(400).json({ success: false, error: "shop_id is required" });
        return;
      }

      const query: any = { shop_id };
      if (barber_id) query.barber_id = barber_id;

      // Handle status filtering - default to pending or confirmed if not specified
      if (status) {
        query.status = status;
      } else {
        query.status = { $in: ["pending", "confirmed"] };
      }

      // Handle date filtering
      if (date) {
        // Single date filter
        const targetDate = new Date(date + "T00:00:00.000Z");
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query.date = { $gte: targetDate, $lt: nextDay };
      } else if (from || to) {
        // Date range filter
        const dateQuery: any = {};
        if (from) dateQuery.$gte = new Date(from + "T00:00:00.000Z");
        if (to) dateQuery.$lte = new Date(to + "T23:59:59.999Z");
        query.date = dateQuery;
      }

      const bookings = await Booking.find(query)
        .sort({ date: -1, start_time: 1 })
        .lean();

      const response: ApiResponse = {
        success: true,
        data: bookings,
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error listing bookings:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to list bookings",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }
  // Clear all sessions
  static async clearAllSessions(req: Request, res: Response): Promise<void> {
    try {
      const result = await Session.deleteMany({});
      const response: ApiResponse = {
        success: true,
        message: "All sessions cleared",
        data: {
          deletedCount: result.deletedCount,
        },
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error clearing sessions:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to clear sessions",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }

  // Clear sessions for specific user
  static async clearUserSessions(req: Request, res: Response): Promise<void> {
    try {
      const { userPhone } = req.params;
      const result = await Session.deleteMany({ user_phone: userPhone });
      const response: ApiResponse = {
        success: true,
        message: `Sessions cleared for user ${userPhone}`,
        data: {
          deletedCount: result.deletedCount,
        },
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error clearing user sessions:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to clear user sessions",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }

  // Clear sessions for specific shop
  static async clearShopSessions(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const result = await Session.deleteMany({ shop_id: shopId });
      const response: ApiResponse = {
        success: true,
        message: `Sessions cleared for shop ${shopId}`,
        data: {
          deletedCount: result.deletedCount,
        },
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error clearing shop sessions:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to clear shop sessions",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }

  // Get session statistics
  static async getSessionStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await Session.aggregate([
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: { $sum: { $cond: ["$is_active", 1, 0] } },
            uniqueUsers: { $addToSet: "$user_phone" },
          },
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            activeSessions: 1,
            uniqueUsers: { $size: "$uniqueUsers" },
          },
        },
      ]);

      const response: ApiResponse = {
        success: true,
        data: stats[0] || {
          totalSessions: 0,
          activeSessions: 0,
          uniqueUsers: 0,
        },
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error getting session stats:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to get session stats",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }

  // Clear all data (nuclear option)
  static async clearAllData(req: Request, res: Response): Promise<void> {
    try {
      const results = await Promise.all([
        Session.deleteMany({}),
        WabaNumber.deleteMany({}),
        Settings.deleteMany({}),
        ServiceCatalog.deleteMany({}),
        Barber.deleteMany({}),
        Booking.deleteMany({}),
      ]);

      const response: ApiResponse = {
        success: true,
        message: "All data cleared",
        data: {
          results: {
            sessions: results[0].deletedCount,
            wabaNumbers: results[1].deletedCount,
            settings: results[2].deletedCount,
            serviceCatalog: results[3].deletedCount,
            barbers: results[4].deletedCount,
            bookings: results[5].deletedCount,
          },
        },
      };
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Error clearing all data:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Failed to clear all data",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }
}
