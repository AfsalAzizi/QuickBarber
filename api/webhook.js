export const runtime = 'nodejs';

const express = require('express');
const crypto = require('crypto');
const { connectToDatabase } = require('../utils/dbConnection');
const { processIncomingMessage } = require('../services/messageProcessor');

const app = express();
app.use(express.json());

// WhatsApp webhook verification endpoint
app.get('/', (req, res) => {
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
app.post('/', async (req, res) => {
    try {
        console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
        
        // Ensure database connection
        await connectToDatabase();
        
        res.status(200).json({ status: 'received' });
        await processWebhookData(req.body);
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function verifyWebhookSignature(payload, signature) {
    const expectedSignature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    );
}

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
        
        // Ensure database connection
        await connectToDatabase();
        
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

export default app;
