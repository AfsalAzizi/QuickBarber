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
      const { shop_id, include_inactive } = req.query as Record<string, string>;
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

      const barberQuery: any = { shop_id };
      if (include_inactive !== "true") barberQuery.active = true;
      const barbers = await Barber.find(barberQuery)
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

      const nowTz = moment().tz((settings as ISettings).time_zone);
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
      const { shop_id, barber_id, from, to, status } = req.query as Record<
        string,
        string
      >;

      if (!shop_id) {
        res.status(400).json({ success: false, error: "shop_id is required" });
        return;
      }

      const query: any = { shop_id };
      if (barber_id) query.barber_id = barber_id;
      if (status) query.status = status;

      if (from || to) {
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
