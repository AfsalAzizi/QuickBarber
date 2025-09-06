const Session = require('../models/Session');
const WabaNumber = require('../models/WabaNumber');
const Settings = require('../models/Settings');
const ServiceCatalog = require('../models/ServiceCatalog');
const Barber = require('../models/Barber');
const Booking = require('../models/Booking');
const { sendWhatsAppMessage, sendButtonMessage } = require('./whatsappService');
const { detectIntent } = require('./intentDetection');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

/**
 * Process incoming WhatsApp message
 * @param {Object} message - WhatsApp message object
 * @param {Object} metadata - Message metadata
 */
async function processIncomingMessage(message, metadata) {
    try {
        console.log('Processing incoming message:', {
            id: message.id,
            from: message.from,
            type: message.type,
            timestamp: message.timestamp
        });

        // Extract message content
        const messageContent = extractMessageContent(message);
        console.log('Extracted message content:', messageContent);

        if (!messageContent) {
            console.log('No message content found, ignoring message');
            return;
        }

        // Get shop information from phone number
        const shopInfo = await getShopFromPhoneNumber(metadata.phone_number_id);
        if (!shopInfo) {
            console.log('No shop found for phone number:', metadata.phone_number_id);
            return;
        }

        console.log('Shop info:', shopInfo.shop_id);

        // Check if this is a first message from user
        const isFirstMessage = await isFirstMessageFromUser(message.from, shopInfo.shop_id);
        console.log('Is first message:', isFirstMessage);

        if (isFirstMessage) {
            await handleFirstMessage(message.from, messageContent, shopInfo, metadata.phone_number_id);
        } else {
            // Load existing session
            const session = await loadOrCreateSession(message.from, shopInfo.shop_id, metadata.phone_number_id);
            console.log('Session loaded:', session._id);

            // Detect intent
            const intent = detectIntent(messageContent, session);
            console.log('Detected intent:', intent);

            // Process intent
            await processIntent(intent, messageContent, session, shopInfo);
        }

    } catch (error) {
        console.error('Error processing incoming message:', error);
    }
}

// ... rest of the functions remain the same, but remove any connectToDatabase() calls