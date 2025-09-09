import express, { Application } from "express";
import { config, validateEnvironment } from "./config/environment";
import { connectToDatabase, disconnectFromDatabase } from "./config/database";

import {
  setupMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
} from "./middleware";
import routes from "./routes";

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
      console.log("🚀 Starting server...");
      console.log("Environment:", config.nodeEnv);
      console.log("MongoDB URI configured:", !!process.env.MONGODB_URI);

      validateEnvironment();
      console.log("✅ Environment variables validated");

      console.log("🔄 Connecting to MongoDB...");
      await connectToDatabase();
      console.log("✅ MongoDB connected, starting server...");

      const port = config.port;
      this.app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);
        console.log(`📊 Health check: http://localhost:${port}/api/health`);
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
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  await disconnectFromDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  await disconnectFromDatabase();
  process.exit(0);
});

app.start().catch((error) => {
  console.error("❌ Application failed to start:", error);
  process.exit(1);
});

export default app;
