import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  isVercel: !!process.env.VERCEL,

  // Database configuration
  mongodbUri: process.env.MONGODB_URI || "",

  // WhatsApp Business API configuration
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "",
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || "v20.0",

  // Business configuration
  businessAccountId: process.env.BUSINESS_ACCOUNT_ID || "",

  // Security
  corsOrigin: process.env.CORS_ORIGIN || "*",

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",
} as const;

// Validate required environment variables
export const validateEnvironment = (): void => {
  const requiredVars = [
    "MONGODB_URI",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
};

// Export individual config values for convenience
export const {
  port,
  nodeEnv,
  isProduction,
  isDevelopment,
  isVercel,
  mongodbUri,
  whatsappAccessToken,
  whatsappVerifyToken,
  whatsappPhoneNumberId,
  whatsappWebhookUrl,
  whatsappApiVersion,
  businessAccountId,
  corsOrigin,
  logLevel,
} = config;
