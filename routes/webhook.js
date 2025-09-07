const express = require('express');
const router = express.Router();
const { processIncomingMessage } = require('../services/messageProcessor');
const { ensureDatabaseConnection } = require('../server');

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

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
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

        // Ensure database connection before processing
        console.log('Ensuring database connection...');
        await ensureDatabaseConnection();
        console.log('Database connection confirmed');

        // Respond immediately
        res.status(200).json({ status: 'received' });

        // Process in background
        setImmediate(async () => {
            try {
                await processWebhookData(req.body);
            } catch (error) {
                console.error('Background processing error:', error);
            }
        });

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function processWebhookData(body) {
    try {
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

async function processMessages(value) {
    try {
        console.log('Processing messages for phone number:', value.metadata.phone_number_id);

        if (value.messages) {
            for (const message of value.messages) {
                console.log('Processing message:', {
                    id: message.id,
                    from: message.from,
                    type: message.type,
                    timestamp: message.timestamp
                });

                // Skip status messages (delivered, seen, etc.)
                if (message.type === 'status') {
                    console.log('Skipping status message');
                    continue;
                }

                await processIncomingMessage(message, value.metadata);
            }
        }
    } catch (error) {
        console.error('Error processing messages:', error);
    }
}

module.exports = router;
