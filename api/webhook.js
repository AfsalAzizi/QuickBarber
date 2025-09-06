
// Vercel serverless webhook handler with zero-latency ACK and cached MongoDB
const crypto = require('crypto');
const { connectToDatabase } = require('../utils/dbConnection');
const { processIncomingMessage } = require('../services/messageProcessor');

// Handler for GET requests (webhook verification)
async function handleGet(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification attempt:', {
        mode,
        token: token ? '***' : 'missing',
        challenge: challenge ? '***' : 'missing',
        expectedToken: process.env.WEBHOOK_VERIFY_TOKEN ? '***' : 'MISSING_ENV_VAR'
    });

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        return res.status(200).send(challenge);
    } else {
        console.log('Webhook verification failed:', {
            modeMatch: mode === 'subscribe',
            tokenMatch: token === process.env.WEBHOOK_VERIFY_TOKEN,
            hasEnvVar: !!process.env.WEBHOOK_VERIFY_TOKEN
        });
        return res.status(403).json({ error: 'Forbidden' });
    }
}

// Handler for POST requests (message processing)
async function handlePost(req, res) {
    try {
        console.log('POST request received:', {
            contentType: req.headers['content-type'],
            bodyType: typeof req.body,
            hasBody: !!req.body
        });

        // Body is already parsed by Vercel as JSON
        const body = req.body;

        if (!body) {
            console.log('No body received');
            return res.status(400).json({ error: 'No body' });
        }

        console.log('Received body:', JSON.stringify(body, null, 2));

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
                .update(JSON.stringify(body))
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
                console.log('=== BACKGROUND PROCESSING STARTED ===');
                console.log('Processing webhook payload in background');

                // Single DB connect per request (cached connection)
                console.log('Connecting to database...');
                await connectToDatabase();
                console.log('Database connected successfully');

                console.log('Calling processWebhookData...');
                await processWebhookData(body);
                console.log('processWebhookData completed');

                console.log('=== BACKGROUND PROCESSING COMPLETED ===');
            } catch (error) {
                console.error('=== BACKGROUND PROCESSING ERROR ===');
                console.error('Background processing error:', error.message);
                console.error('Error stack:', error.stack);
            }
        });

    } catch (error) {
        console.error('Webhook handler error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Process WhatsApp webhook data structure
async function processWebhookData(body) {
    try {
        console.log('=== STARTING processWebhookData ===');
        console.log('Processing webhook data:', JSON.stringify(body, null, 2));

        if (body.object !== 'whatsapp_business_account') {
            console.log('Ignoring non-WhatsApp payload, object:', body.object);
            return;
        }

        console.log('WhatsApp payload confirmed, processing entries...');
        for (const entry of body.entry || []) {
            console.log('Processing entry:', entry.id);
            for (const change of entry.changes || []) {
                console.log('Processing change, field:', change.field);
                if (change.field === 'messages') {
                    console.log('Messages field found, calling processMessages...');
                    await processMessages(change.value);
                }
            }
        }
        console.log('=== COMPLETED processWebhookData ===');
    } catch (error) {
        console.error('Error in processWebhookData:', error);
        console.error('Error stack:', error.stack);
    }
}

// Process messages array
async function processMessages(value) {
    try {
        console.log('=== STARTING processMessages ===');
        console.log('Value received:', JSON.stringify(value, null, 2));

        if (!value.messages || !Array.isArray(value.messages)) {
            console.log('No messages to process, messages:', value.messages);
            return;
        }

        console.log(`Processing ${value.messages.length} messages for phone: ${value.metadata?.phone_number_id}`);

        for (const message of value.messages) {
            try {
                console.log('Processing individual message:', message.id, 'type:', message.type);

                // Skip status messages (delivered, seen, etc.)
                if (message.type === 'status') {
                    console.log(`Skipping status message: ${message.id}`);
                    continue;
                }

                console.log(`Processing message: ${message.id} (${message.type})`);

                // Process the message (DB connection already established)
                console.log('Calling processIncomingMessage...');
                await processIncomingMessage(message, value.metadata || {});
                console.log('processIncomingMessage completed for:', message.id);

            } catch (error) {
                console.error(`Error processing message ${message.id}:`, error);
                console.error('Error stack:', error.stack);
            }
        }
        console.log('=== COMPLETED processMessages ===');
    } catch (error) {
        console.error('Error in processMessages:', error);
        console.error('Error stack:', error.stack);
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

// Remove this line - let Vercel handle JSON parsing automatically
// module.exports.config = {
//     api: {
//         bodyParser: false
//     }
// };

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
