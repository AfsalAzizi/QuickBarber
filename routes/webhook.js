const express = require('express');
const crypto = require('crypto');
const router = express.Router();

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

        // Temporarily disable signature verification for testing
        // const signature = req.headers['x-hub-signature-256'];
        // if (signature && !verifyWebhookSignature(req.body, signature)) {
        //     console.log('Invalid webhook signature');
        //     return res.status(403).json({ error: 'Invalid signature' });
        // }

        // Respond to webhook immediately (within 20 seconds)
        res.status(200).json({ status: 'received' });

        // Process the webhook data asynchronously
        await processWebhookData(req.body);

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        // Handle different types of webhook events
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages') {
                        await processMessages(change.value);
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
        if (value.messages) {
            for (const message of value.messages) {
                console.log('Processing message:', {
                    id: message.id,
                    from: message.from,
                    type: message.type,
                    timestamp: message.timestamp
                });

                // Import the message processor
                const { processIncomingMessage } = require('../services/messageProcessor');
                await processIncomingMessage(message, value.metadata);
            }
        }

        // Handle message status updates
        if (value.statuses) {
            for (const status of value.statuses) {
                console.log('Message status update:', {
                    id: status.id,
                    status: status.status,
                    timestamp: status.timestamp
                });
                // Handle status updates if needed
            }
        }
    } catch (error) {
        console.error('Error processing messages:', error);
    }
}

module.exports = router;
