import "tsconfig-paths/register";
import "module-alias/register";
import express, { Application } from "express";
import { config, validateEnvironment } from "@/config/environment";
import { connectToDatabase } from "@/config/database";
import {
  setupMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
} from "@/middleware";
import routes from "@/routes";

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    setupMiddleware(this.app);
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use("/api", routes);

    // Root endpoint
    this.app.get("/", (req, res) => {
      res.json({
        success: true,
        message: "QuickBarber API is running",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        endpoints: {
          webhook: "/api/webhook",
          health: "/api/health",
          admin: "/api/admin",
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundMiddleware);
    this.app.use(errorHandlerMiddleware);
  }

  public async start(): Promise<void> {
    try {
      // Validate environment variables
      validateEnvironment();
      console.log("✅ Environment variables validated");

      // Connect to database
      await connectToDatabase();
      console.log("✅ Database connected successfully");

      // Start server
      const port = config.port;
      this.app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);
        console.log(`📱 Environment: ${config.nodeEnv}`);
        console.log(`🌐 API Base URL: http://localhost:${port}/api`);
        console.log(`🔗 Health Check: http://localhost:${port}/api/health`);
        console.log(`📞 Webhook: http://localhost:${port}/api/webhook`);
      });
    } catch (error) {
      console.error("❌ Failed to start server:", error);
      process.exit(1);
    }
  }
}

// Create and start the application
const app = new App();

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("🔄 SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🔄 SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start the application
app.start().catch((error) => {
  console.error("❌ Application failed to start:", error);
  process.exit(1);
});

export default app;
