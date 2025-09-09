import mongoose, { Connection, ConnectOptions } from "mongoose";
import { config } from "./environment";

class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: Connection | null = null;
  private isConnecting = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async connect(): Promise<void> {
    if (this.connection && this.connection.readyState === 1) {
      console.log("✅ Database already connected");
      return;
    }

    if (this.isConnecting) {
      console.log("⏳ Database connection already in progress...");
      return;
    }

    this.isConnecting = true;

    try {
      console.log("🔍 Connecting to MongoDB...");
      console.log(`- MONGODB_URI exists: ${!!config.mongodbUri}`);

      // Connection options optimized for Vercel
      const connectionOptions: ConnectOptions = {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        socketTimeoutMS: 3000,
        maxPoolSize: 1,
        minPoolSize: 0,
        maxIdleTimeMS: 10000,
        bufferCommands: false,
      };

      // Add serverless-specific options if on Vercel
      if (config.isVercel) {
        console.log("🔧 Using Vercel-specific connection options");
      }

      console.log(
        "🔗 Attempting MongoDB connection with options:",
        connectionOptions
      );

      // Add timeout wrapper to prevent hanging
      const connectionPromise = mongoose.connect(
        config.mongodbUri,
        connectionOptions
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Connection timeout after 5 seconds")),
          5000
        );
      });

      await Promise.race([connectionPromise, timeoutPromise]);

      this.connection = mongoose.connection;

      // Set up event listeners
      this.setupEventListeners();

      console.log("✅ Connected to MongoDB successfully");
    } catch (error) {
      console.error("❌ MongoDB connection error:", error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private setupEventListeners(): void {
    if (!this.connection) return;

    this.connection.on("connected", () => {
      console.log("✅ Mongoose connected to MongoDB");
    });

    this.connection.on("error", (error) => {
      console.error("❌ Mongoose connection error:", error);
    });

    this.connection.on("disconnected", () => {
      console.log("⚠️ Mongoose disconnected");
    });

    // Handle process termination
    process.on("SIGINT", this.gracefulShutdown.bind(this));
    process.on("SIGTERM", this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.connection && this.connection.readyState === 1) {
      console.log("🔄 Closing MongoDB connection...");
      await mongoose.connection.close();
      console.log("✅ MongoDB connection closed");
    }
  }

  public getConnection(): Connection | null {
    return this.connection;
  }

  public isConnected(): boolean {
    return this.connection?.readyState === 1;
  }

  public getConnectionState(): {
    state: number;
    stateName: string;
    connected: boolean;
  } {
    const state = this.connection?.readyState ?? 0;
    const stateNames = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    return {
      state,
      stateName: stateNames[state as keyof typeof stateNames],
      connected: state === 1,
    };
  }

  public async disconnect(): Promise<void> {
    if (this.connection && this.connection.readyState === 1) {
      await mongoose.connection.close();
      this.connection = null;
      console.log("✅ Disconnected from MongoDB");
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();

// Export convenience functions
export const connectToDatabase = (): Promise<void> => databaseManager.connect();
export const getDatabaseConnection = (): Connection | null =>
  databaseManager.getConnection();
export const isDatabaseConnected = (): boolean => databaseManager.isConnected();
export const getDatabaseState = () => databaseManager.getConnectionState();
export const disconnectFromDatabase = (): Promise<void> =>
  databaseManager.disconnect();
