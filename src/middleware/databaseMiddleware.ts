import { Request, Response, NextFunction } from "express";
import { getDatabaseState } from "../config/database";
import { ApiResponse } from "../types/express";

// Database connection middleware
export const databaseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!getDatabaseState().connected) {
    const errorResponse: ApiResponse = {
      success: false,
      error: "Database connection not available",
      message: "Please try again later",
    };
    res.status(503).json(errorResponse);
    return;
  }
  next();
};

// Optional database middleware (doesn't fail if DB is down)
export const optionalDatabaseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.databaseConnected = getDatabaseState().connected;
  req.databaseState = getDatabaseState();
  next();
};

// Database health check middleware
export const databaseHealthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const dbState = getDatabaseState();

  if (req.path.includes("/health") || req.path.includes("/db-health")) {
    req.databaseState = dbState;
    return next();
  }

  // For other routes, check if database is connected
  if (!getDatabaseState().connected) {
    const errorResponse: ApiResponse = {
      success: false,
      error: "Database unavailable",
      message: "Database connection is not available. Please try again later.",
      data: {
        database: dbState,
      },
    };
    return res.status(503).json(errorResponse);
  }

  next();
};

// Extend Request interface for database middleware
declare global {
  namespace Express {
    interface Request {
      databaseConnected?: boolean;
      databaseState?: {
        state: number;
        stateName: string;
        connected: boolean;
      };
    }
  }
}
