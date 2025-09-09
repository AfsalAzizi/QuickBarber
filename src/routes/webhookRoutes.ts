import { Router } from "express";
import { WebhookController } from "../controllers/webhookController";
import { databaseMiddleware } from "../middleware/databaseMiddleware";

const router = Router();

// Apply database middleware to all webhook routes
router.use(databaseMiddleware);

// WhatsApp webhook verification endpoint
router.get("/", WebhookController.verifyWebhook);

// WhatsApp webhook endpoint for receiving messages
router.post("/", WebhookController.receiveWebhook);

export default router;
