import { Request, Response } from "express";
import { config } from "../config/environment";
import { processIncomingMessage } from "../services/messageProcessor";
import { WhatsAppWebhookData, ApiResponse } from "../types/express";

export class WebhookController {
  // WhatsApp webhook verification endpoint
  static async verifyWebhook(req: Request, res: Response): Promise<void> {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    console.log("Webhook verification request:", {
      mode,
      token: token ? "***" : "missing",
      challenge: challenge ? "***" : "missing",
    });

    if (mode === "subscribe" && token === config.whatsappVerifyToken) {
      console.log("Webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      console.log("Webhook verification failed");
      const errorResponse: ApiResponse = {
        success: false,
        error: "Forbidden",
      };
      res.status(403).json(errorResponse);
    }
  }

  // WhatsApp webhook endpoint for receiving messages
  static async receiveWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log(
        "Received webhook payload:",
        JSON.stringify(req.body, null, 2)
      );

      // Respond immediately to prevent timeout
      const response: ApiResponse = {
        success: true,
        message: "Webhook received successfully",
      };
      res.status(200).json(response);

      // Process in background
      setImmediate(async () => {
        try {
          await WebhookController.processWebhookData(req.body);
        } catch (error) {
          console.error("Background processing error:", error);
        }
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      const errorResponse: ApiResponse = {
        success: false,
        error: "Internal server error",
      };
      res.status(500).json(errorResponse);
    }
  }

  private static async processWebhookData(
    body: WhatsAppWebhookData
  ): Promise<void> {
    try {
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === "messages") {
              await WebhookController.processMessages(change.value);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook data:", error);
    }
  }

  private static async processMessages(value: any): Promise<void> {
    try {
      console.log(
        "Processing messages for phone number:",
        value.metadata.phone_number_id
      );

      if (value.messages) {
        for (const message of value.messages) {
          console.log("Processing message:", {
            id: message.id,
            from: message.from,
            type: message.type,
            timestamp: message.timestamp,
          });

          // Skip status messages (delivered, seen, etc.)
          if (message.type === "status") {
            console.log("Skipping status message");
            continue;
          }

          await processIncomingMessage(message, value.metadata);
        }
      }
    } catch (error) {
      console.error("Error processing messages:", error);
    }
  }
}
