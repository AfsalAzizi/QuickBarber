import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/quickbarber";

export const connectToDatabase = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log("✅ MongoDB already connected");
      return;
    }

    console.log("🔄 Attempting to connect to MongoDB...");
    console.log("MongoDB URI:", MONGODB_URI.replace(/\/\/.*@/, "//***:***@"));

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    } as any);
    console.log("✅ Connected to MongoDB successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
  }
};

export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error);
  }
};

export const getDatabaseState = (): {
  state: number;
  stateName: string;
  connected: boolean;
} => {
  const state = mongoose.connection.readyState;
  const stateNames = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  } as const;
  return {
    state,
    stateName: stateNames[state as keyof typeof stateNames],
    connected: state === 1,
  };
};
