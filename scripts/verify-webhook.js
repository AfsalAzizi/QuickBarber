#!/usr/bin/env node

/**
 * Meta Webhook Verification Script
 * This script helps verify that your webhook is properly configured
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-app.vercel.app/api/webhook';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

if (!VERIFY_TOKEN) {
    console.error('❌ WHATSAPP_VERIFY_TOKEN not found in environment variables');
    process.exit(1);
}

async function verifyWebhook() {
    console.log('🔍 Verifying Meta Webhook...');
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`🔑 Verify Token: ${VERIFY_TOKEN.substring(0, 8)}...`);
    console.log('');

    try {
        // Test webhook verification
        const challenge = 'test_challenge_123';
        const verificationUrl = `${WEBHOOK_URL}?hub.mode=subscribe&hub.challenge=${challenge}&hub.verify_token=${VERIFY_TOKEN}`;

        console.log('📡 Sending verification request...');
        const response = await axios.get(verificationUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Meta-Webhook-Verifier/1.0'
            }
        });

        if (response.status === 200 && response.data === challenge) {
            console.log('✅ Webhook verification successful!');
            console.log(`📝 Challenge received: ${response.data}`);
            return true;
        } else {
            console.log('❌ Webhook verification failed');
            console.log(`📝 Response: ${response.data}`);
            return false;
        }
    } catch (error) {
        console.log('❌ Webhook verification failed with error:');
        if (error.response) {
            console.log(`📝 Status: ${error.response.status}`);
            console.log(`📝 Response: ${error.response.data}`);
        } else {
            console.log(`📝 Error: ${error.message}`);
        }
        return false;
    }
}

async function testWebhookSignature() {
    console.log('🔍 Testing webhook signature verification...');

    const testPayload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: 'test_entry_id',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '1234567890',
                        phone_number_id: 'test_phone_id'
                    },
                    messages: [{
                        id: 'test_message_id',
                        from: '1234567890',
                        timestamp: '1234567890',
                        type: 'text',
                        text: {
                            body: 'Hello, this is a test message'
                        }
                    }]
                },
                field: 'messages'
            }]
        }]
    };

    const payloadString = JSON.stringify(testPayload);
    const signature = crypto
        .createHmac('sha256', process.env.WHATSAPP_ACCESS_TOKEN || 'test_token')
        .update(payloadString)
        .digest('hex');

    try {
        console.log('📡 Sending test webhook payload...');
        const response = await axios.post(WEBHOOK_URL, testPayload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Hub-Signature-256': `sha256=${signature}`,
                'User-Agent': 'Meta-Webhook-Tester/1.0'
            },
            timeout: 10000
        });

        if (response.status === 200) {
            console.log('✅ Webhook payload test successful!');
            console.log(`📝 Response: ${JSON.stringify(response.data)}`);
            return true;
        } else {
            console.log('❌ Webhook payload test failed');
            console.log(`📝 Status: ${response.status}`);
            console.log(`📝 Response: ${response.data}`);
            return false;
        }
    } catch (error) {
        console.log('❌ Webhook payload test failed with error:');
        if (error.response) {
            console.log(`📝 Status: ${error.response.status}`);
            console.log(`📝 Response: ${error.response.data}`);
        } else {
            console.log(`📝 Error: ${error.message}`);
        }
        return false;
    }
}

async function checkHealth() {
    console.log('🔍 Checking application health...');

    try {
        const healthUrl = WEBHOOK_URL.replace('/api/webhook', '/health');
        const response = await axios.get(healthUrl, { timeout: 5000 });

        if (response.status === 200) {
            console.log('✅ Application is healthy!');
            console.log(`📝 Response: ${JSON.stringify(response.data)}`);
            return true;
        } else {
            console.log('❌ Application health check failed');
            return false;
        }
    } catch (error) {
        console.log('❌ Application health check failed:');
        console.log(`📝 Error: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🚀 QuickBarber Webhook Verification Tool');
    console.log('==========================================');
    console.log('');

    const results = {
        health: await checkHealth(),
        verification: await verifyWebhook(),
        payload: await testWebhookSignature()
    };

    console.log('');
    console.log('📊 Test Results Summary:');
    console.log('========================');
    console.log(`🏥 Health Check: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔐 Webhook Verification: ${results.verification ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📦 Payload Test: ${results.payload ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (results.health && results.verification && results.payload) {
        console.log('🎉 All tests passed! Your webhook is ready for Meta configuration.');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('1. Go to Meta Developer Console');
        console.log('2. Navigate to your WhatsApp Business app');
        console.log('3. Go to WhatsApp → Configuration');
        console.log(`4. Set Webhook URL: ${WEBHOOK_URL}`);
        console.log(`5. Set Verify Token: ${VERIFY_TOKEN}`);
        console.log('6. Subscribe to "messages" events');
        console.log('7. Click "Verify and Save"');
    } else {
        console.log('⚠️  Some tests failed. Please check the errors above and fix them before configuring Meta webhook.');
        process.exit(1);
    }
}

// Run the verification
main().catch(console.error);
