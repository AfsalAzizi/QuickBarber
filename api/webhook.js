
// Vercel serverless webhook handler with zero-latency ACK and cached MongoDB
const crypto = require('crypto');
const { connectToDatabase } = require('../utils/dbConnection');
const { processIncomingMessage } = require('../services/messageProcessor');

// Handler for GET requests (webhook verification)
async function handleGet(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        return res.status(200).send(challenge);
    } else {
        console.log('Webhook verification failed');
        return res.status(403).json({ error: 'Forbidden' });
    }
}

// Handler for POST requests (message processing)
async function handlePost(req, res) {
    try {
        // Parse JSON safely
        let body;
        try {
            body = JSON.parse(req.body);
        } catch (parseError) {
            console.log('Invalid JSON payload');
            return res.status(400).json({ error: 'Invalid JSON' });
        }

        // Optional signature verification
        if (process.env.WEBHOOK_SECRET || process.env.WHATSAPP_APP_SECRET) {
            const signature = req.headers['x-hub-signature-256'];
            if (!signature) {
                console.log('Missing signature header');
                return res.status(403).json({ error: 'Missing signature' });
            }

            const secret = process.env.WEBHOOK_SECRET || process.env.WHATSAPP_APP_SECRET;
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(req.body)
                .digest('hex');

            const providedSignature = signature.replace('sha256=', '');

            if (!crypto.timingSafeEqual(
                Buffer.from(providedSignature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            )) {
                console.log('Invalid signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
        }

        // ZERO-LATENCY ACK: Respond immediately
        res.status(200).json({ ok: true });

        // Background processing with setImmediate for better performance
        setImmediate(async () => {
            try {
                console.log('Processing webhook payload in background');

                // Single DB connect per request (cached connection)
                await connectToDatabase();

                await processWebhookData(body);
            } catch (error) {
                console.error('Background processing error:', error.message);
            }
        });

    } catch (error) {
        console.error('Webhook handler error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Process WhatsApp webhook data structure
async function processWebhookData(body) {
    if (body.object !== 'whatsapp_business_account') {
        console.log('Ignoring non-WhatsApp payload');
        return;
    }

    for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
            if (change.field === 'messages') {
                await processMessages(change.value);
            }
        }
    }
}

// Process messages array
async function processMessages(value) {
    if (!value.messages || !Array.isArray(value.messages)) {
        console.log('No messages to process');
        return;
    }

    console.log(`Processing ${value.messages.length} messages for phone: ${value.metadata?.phone_number_id}`);

    for (const message of value.messages) {
        try {
            // Skip status messages (delivered, seen, etc.)
            if (message.type === 'status') {
                console.log(`Skipping status message: ${message.id}`);
                continue;
            }

            // TODO: Add idempotency check here
            // Check if message.id was already processed to prevent duplicate handling
            // Example: const existing = await ProcessedMessage.findOne({ message_id: message.id });
            // if (existing) { console.log('Duplicate message, skipping'); continue; }

            console.log(`Processing message: ${message.id} (${message.type})`);

            // Process the message (DB connection already established)
            await processIncomingMessage(message, value.metadata || {});

        } catch (error) {
            console.error(`Error processing message ${message.id}:`, error.message);
        }
    }
}

// Main handler function
async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hub-signature-256');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return await handleGet(req, res);
    }

    if (req.method === 'POST') {
        return await handlePost(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// Export for Vercel
module.exports = handler;

// Preserve raw body for signature verification
module.exports.config = {
    api: {
        bodyParser: false
    }
};

/*
ACCEPTANCE TESTS:

1. GET Verification:
   curl "https://your-domain.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=$WEBHOOK_VERIFY_TOKEN&hub.challenge=123"
   Expected: Returns "123" with status 200

2. POST with valid payload:
   curl -X POST "https://your-domain.vercel.app/api/webhook" \
        -H "Content-Type: application/json" \
        -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"id":"test123","type":"text","text":{"body":"hello"}}],"metadata":{"phone_number_id":"123"}},"field":"messages"}]}]}'
   Expected: Returns {"ok":true} immediately, processing logs appear after

3. POST with invalid signature (when WEBHOOK_SECRET is set):
   curl -X POST "https://your-domain.vercel.app/api/webhook" \
        -H "Content-Type: application/json" \
        -H "x-hub-signature-256: sha256=invalid" \
        -d '{"test":"data"}'
   Expected: Returns 403 with error message

4. Check logs for:
   - No duplicate "Database connected" messages
   - No secrets/tokens in logs
   - Background processing happens after ACK response
   - Single connection per warm process
*/
