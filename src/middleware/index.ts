import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "@/config/environment";

// CORS middleware
export const corsMiddleware = cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
});

// Security middleware
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Logging middleware
export const loggingMiddleware = morgan(
  config.isDevelopment ? "dev" : "combined",
  {
    skip: (req: Request) => {
      // Skip logging for health checks in production
      return config.isProduction && req.url === "/health";
    },
  }
);

// Request parsing middleware
export const bodyParsingMiddleware = [
  express.json({ limit: "10mb" }),
  express.urlencoded({ extended: true, limit: "10mb" }),
];

// Trust proxy middleware (for Vercel)
export const trustProxyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.app.set("trust proxy", 1);
  next();
};

// Request ID middleware
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  (req as any).id =
    (req.headers["x-request-id"] as string) ||
    (req.headers["x-vercel-id"] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("X-Request-ID", (req as any).id);
  next();
};

// Rate limiting middleware (basic)
export const rateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Basic rate limiting - can be enhanced with redis or memory store
  const clientIp = req.ip || req.connection.remoteAddress || "unknown";

  // For now, just log the request
  console.log(`Request from ${clientIp} to ${req.path}`);
  next();
};

// Health check middleware
export const healthCheckMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.path === "/health" || req.path === "/api/health") {
    return next();
  }
  next();
};

// Error handling middleware
export const errorHandlerMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  const isDevelopment = config.isDevelopment;

  res.status(500).json({
    success: false,
    error: isDevelopment ? error.message : "Internal Server Error",
    ...(isDevelopment && { stack: error.stack }),
  });
};

// 404 handler
export const notFoundMiddleware = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
};

// Combine all middleware
export const setupMiddleware = (app: express.Application): void => {
  // Trust proxy first (for Vercel)
  app.use(trustProxyMiddleware);

  // Security
  app.use(securityMiddleware);

  // CORS
  app.use(corsMiddleware);

  // Logging
  app.use(loggingMiddleware);

  // Request ID
  app.use(requestIdMiddleware);

  // Rate limiting
  app.use(rateLimitMiddleware);

  // Body parsing
  app.use(bodyParsingMiddleware);

  // Health check
  app.use(healthCheckMiddleware);
};
