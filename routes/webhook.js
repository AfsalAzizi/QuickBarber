const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const mongoose = require('mongoose');
const { ensureConnection } = require('../utils/dbConnection'); // Add this import

// WhatsApp webhook verification endpoint
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification request:', {
        mode,
        token: token ? '***' : 'missing',
        challenge: challenge ? '***' : 'missing'
    });

    // Check if mode and token are correct
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('Webhook verification failed');
        res.status(403).json({ error: 'Forbidden' });
    }
});

// WhatsApp webhook endpoint for receiving messages
router.post('/', async (req, res) => {
    try {
        console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));

        // Ensure database connection
        await ensureConnection();

        // Respond to webhook immediately (within 20 seconds)
        res.status(200).json({ status: 'received' });

        // Process the webhook data asynchronously
        await processWebhookData(req.body);

    } catch (error) {
        console.error('Error processing webhook:', error);
        // Don't send error response as we already sent 200
    }
});

// Debug endpoint for Vercel
router.get('/debug', async (req, res) => {
    try {
        const debugInfo = {
            mongooseState: mongoose.connection.readyState,
            nodeEnv: process.env.NODE_ENV,
            vercel: !!process.env.VERCEL,
            mongodbUri: !!process.env.MONGODB_URI,
            whatsappToken: !!process.env.WHATSAPP_ACCESS_TOKEN
        };

        res.status(200).json(debugInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Function to verify webhook signature
function verifyWebhookSignature(payload, signature) {
    const expectedSignature = crypto
        .createHmac('sha256', process.env.WHATSAPP_ACCESS_TOKEN)
        .update(JSON.stringify(payload))
        .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
    );
}

// Function to process incoming webhook data
async function processWebhookData(body) {
    try {
        console.log('Full webhook payload:', JSON.stringify(body, null, 2));

        // Handle different types of webhook events
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages') {
                        await processMessages(change.value);
                    } else {
                        console.log('Ignoring non-message webhook event:', change.field);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing webhook data:', error);
    }
}

// Function to process incoming messages
async function processMessages(value) {
    try {
        // Only process actual messages, ignore status updates
        if (value.messages && value.messages.length > 0) {
            console.log('Processing', value.messages.length, 'incoming message(s)');

            for (const message of value.messages) {
                console.log('Processing message:', {
                    id: message.id,
                    from: message.from,
                    type: message.type,
                    timestamp: message.timestamp
                });

                // Extract phone number ID from the webhook payload
                const phoneNumberId = value.metadata?.phone_number_id ||
                    value.phone_number_id ||
                    process.env.WHATSAPP_PHONE_NUMBER_ID;

                console.log('Phone number ID:', phoneNumberId);

                if (!phoneNumberId) {
                    console.error('No phone number ID found in webhook payload');
                    return;
                }

                // Create metadata object
                const metadata = {
                    phone_number_id: phoneNumberId,
                    display_phone_number: value.metadata?.display_phone_number
                };

                // Import the message processor
                const { processIncomingMessage } = require('../services/messageProcessor');
                await processIncomingMessage(message, metadata);
            }
        } else if (value.statuses && value.statuses.length > 0) {
            // Log status updates but don't process them
            console.log('Ignoring', value.statuses.length, 'status update(s):',
                value.statuses.map(s => `${s.id}: ${s.status}`).join(', '));
        } else {
            console.log('No messages or statuses to process in webhook payload');
        }
    } catch (error) {
        console.error('Error processing messages:', error);
    }
}

module.exports = router;
