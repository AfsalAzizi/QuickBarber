import { Request, Response } from "express";
import { getDatabaseState, isDatabaseConnected } from "@/config/database";
import {
  HealthCheckResponse,
  DatabaseHealthResponse,
  ApiResponse,
} from "@/types/express";
import {
  Session,
  WabaNumber,
  Settings,
  ServiceCatalog,
  Barber,
  Booking,
} from "@/models";

export class HealthController {
  // Basic health check endpoint
  static async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const dbState = getDatabaseState();

      const response: HealthCheckResponse = {
        status: "OK",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        database: dbState,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Health check error:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Health check failed",
      };
      res.status(500).json(errorResponse);
    }
  }

  // Database health check endpoint
  static async getDatabaseHealth(req: Request, res: Response): Promise<void> {
    try {
      console.log("Testing database connection...");

      const connectionState = getDatabaseState();
      console.log("Database connection state:", connectionState);

      const response: DatabaseHealthResponse = {
        connected: isDatabaseConnected(),
        collections: [],
        models: [],
        environment: {
          mongodbUri: !!process.env.MONGODB_URI,
          nodeEnv: process.env.NODE_ENV || "development",
        },
        timestamp: new Date().toISOString(),
      };

      if (isDatabaseConnected()) {
        try {
          // Test a simple query
          console.log("Testing simple query...");
          const mongoose = require("mongoose");
          const testResult = await mongoose.connection.db.admin().ping();
          console.log("Ping result:", testResult);

          // List all collections
          const collections = await mongoose.connection.db
            .listCollections()
            .toArray();
          response.collections = collections.map(
            (col: { name: string }) => col.name
          );

          // Test each model
          const models = [
            { name: "Session", model: Session },
            { name: "WabaNumber", model: WabaNumber },
            { name: "Settings", model: Settings },
            { name: "ServiceCatalog", model: ServiceCatalog },
            { name: "Barber", model: Barber },
            { name: "Booking", model: Booking },
          ];

          const modelTests: DatabaseHealthResponse["models"] = [];
          for (const { name, model } of models) {
            try {
              const count = await model.countDocuments();
              modelTests.push({
                name,
                count,
                collectionName: model.collection.name,
                status: "ok",
              });
              console.log(`${name}: ${count} documents`);
            } catch (error: unknown) {
              modelTests.push({
                name,
                count: 0,
                collectionName: model.collection.name,
                status: "error",
                error,
              });
              console.error(`${name} error:`, error);
            }
          }

          response.models = modelTests;
          response.status = "success";
          response.message = "Database connection is working";
        } catch (error: unknown) {
          console.error("Database test error:", error);
          response.status = "error";
          response.message = `Database test failed: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      } else {
        response.status = "error";
        response.message = `Database is ${connectionState.stateName}`;
      }

      console.log("Database health response:", response);
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Database health check error:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Database health check failed",
        message: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }

  // Simple test endpoint (no DB required)
  static async getTest(req: Request, res: Response): Promise<void> {
    const response: ApiResponse = {
      success: true,
      data: {
        status: "OK",
        timestamp: new Date().toISOString(),
        message: "API is working without database",
        environment: process.env.NODE_ENV || "development",
      },
    };
    res.status(200).json(response);
  }

  // Environment variables check
  static async getEnvironment(req: Request, res: Response): Promise<void> {
    try {
      const mongoUri = process.env.MONGODB_URI;

      const response: ApiResponse = {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          hasMongoUri: !!mongoUri,
          mongoUriLength: mongoUri ? mongoUri.length : 0,
          mongoUriPrefix: mongoUri
            ? mongoUri.substring(0, 20) + "..."
            : "NOT_SET",
          nodeEnv: process.env.NODE_ENV,
          environment: "production",
        },
      };

      res.status(200).json(response);
    } catch (error: unknown) {
      const errorResponse: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      res.status(500).json(errorResponse);
    }
  }
}
