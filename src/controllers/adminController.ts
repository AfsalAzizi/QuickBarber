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
import { ApiResponse } from "../types/express";

export class AdminController {
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

      const query: any = {};
      if (shop_id) query.shop_id = shop_id;
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
