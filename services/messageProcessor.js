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

/**
 * Extract message content from different message types
 * @param {Object} message - WhatsApp message object
 * @returns {String} - Extracted message content
 */
function extractMessageContent(message) {
    switch (message.type) {
        case 'text':
            return message.text.body;
        case 'interactive':
            if (message.interactive.type === 'button_reply') {
                return message.interactive.button_reply.id;
            } else if (message.interactive.type === 'list_reply') {
                return message.interactive.list_reply.id;
            }
            break;
        case 'button':
            return message.button.text;
        default:
            return null;
    }
}

/**
 * Get shop information from phone number
 * @param {String} phoneNumberId - Phone number ID
 * @returns {Object} - Shop information
 */
async function getShopFromPhoneNumber(phoneNumberId) {
    try {
        console.log('Searching for WABA number with phone_number_id:', phoneNumberId);

        const wabaNumber = await WabaNumber.findOne({ phone_number_id: phoneNumberId })
            .maxTimeMS(5000) // Increased timeout
            .lean();

        console.log('WABA number query completed, result:', wabaNumber);

        if (!wabaNumber) {
            console.log('No WABA number found for phone_number_id:', phoneNumberId);
            return null;
        }

        console.log('Found WABA number, getting settings for shop_id:', wabaNumber.shop_id);

        const settings = await Settings.findOne({ shop_id: wabaNumber.shop_id })
            .maxTimeMS(5000) // Increased timeout
            .lean();

        console.log('Settings query completed, result:', settings);

        if (!settings) {
            console.log('No settings found for shop_id:', wabaNumber.shop_id);
            return null;
        }

        const result = {
            shop_id: wabaNumber.shop_id,
            phone_number_id: phoneNumberId,
            display_phone_number: wabaNumber.display_phone_number,
            timezone: wabaNumber.timezone,
            settings
        };

        console.log('Shop info result:', result);
        return result;

    } catch (error) {
        console.error('Error getting shop from phone number:', error);
        console.error('Error details:', error.message);
        return null;
    }
}

/**
 * Check if this is a first message from user
 * @param {String} userPhone - User's phone number
 * @param {String} shopId - Shop ID
 * @returns {Boolean} - True if first message
 */
async function isFirstMessageFromUser(userPhone, shopId) {
    try {
        console.log('Checking for existing session for user:', userPhone, 'shop:', shopId);

        const existingSession = await Session.findOne({
            user_phone: userPhone,
            shop_id: shopId,
            is_active: true
        });

        console.log('Existing session found:', !!existingSession);
        return !existingSession;
    } catch (error) {
        console.error('Error checking for existing session:', error);
        return true; // Default to first message if error
    }
}

/**
 * Load existing session or create new one
 * @param {String} userPhone - User's phone number
 * @param {String} shopId - Shop ID
 * @param {String} phoneNumberId - Phone number ID
 * @returns {Object} - Session object
 */
async function loadOrCreateSession(userPhone, shopId, phoneNumberId) {
    try {
        console.log('Loading or creating session for user:', userPhone);

        let session = await Session.findOne({
            user_phone: userPhone,
            shop_id: shopId,
            is_active: true
        });

        if (session) {
            console.log('Found existing session:', session._id);
            // Update last activity
            session.last_activity = new Date();
            session.updated_at_iso = new Date();
            await session.save();
            return session;
        }

        // If no session found, create a new one
        console.log('No existing session found, creating new session...');
        session = new Session({
            user_phone: userPhone,
            shop_id: shopId,
            phone_number_id: phoneNumberId,
            phase: 'welcome',
            intent: 'general_inquiry',
            is_active: true,
            context_data: {
                session_created: new Date()
            }
        });

        await session.save();
        console.log('New session created:', session._id);
        return session;

    } catch (error) {
        console.error('Error loading/creating session:', error);
        throw error;
    }
}

/**
 * Update session with new data
 * @param {Object} session - Session object
 * @param {Object} updateData - Data to update
 */
async function updateSession(session, updateData) {
    try {
        Object.assign(session, updateData);
        await session.save();
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
}

/**
 * Process user intent
 * @param {String} intent - Detected intent
 * @param {String} messageContent - Message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function processIntent(intent, messageContent, session, shopInfo) {
    try {
        console.log('Processing intent:', intent, 'for user:', session.user_phone);

        switch (intent) {
            case 'first_message':
                await handleFirstMessage(session.user_phone, messageContent, shopInfo, session.phone_number_id);
                break;
            case 'book_appointment':
                await handleBookAppointment(session, shopInfo);
                break;
            case 'check_availability':
                await handleCheckAvailability(session, shopInfo);
                break;
            case 'list_services':
                await handleListServices(session, shopInfo);
                break;
            case 'list_barbers':
                await handleListBarbers(session, shopInfo);
                break;
            case 'cancel_booking':
                await handleCancelBooking(session, shopInfo);
                break;
            case 'reschedule':
                await handleReschedule(session, shopInfo);
                break;
            case 'select_service':
                await handleServiceSelection(messageContent, session, shopInfo);
                break;
            case 'select_barber':
                await handleBarberSelection(messageContent, session, shopInfo);
                break;
            case 'select_time':
                await showTimePeriodOptions(session, shopInfo);
                break;
            case 'select_time_period':
                await handleTimePeriodSelection(messageContent, session, shopInfo);
                break;
            case 'select_specific_time':
                await sendWhatsAppMessage(session.user_phone, 'Specific time selection functionality will be implemented in the next phase.');
                break;
            default:
                // Check session phase to determine what to do
                if (session.phase === 'service_selection') {
                    await handleServiceSelection(messageContent, session, shopInfo);
                } else if (session.phase === 'barber_selection') {
                    await handleBarberSelection(messageContent, session, shopInfo);
                } else if (session.phase === 'time_selection') {
                    await handleTimePeriodSelection(messageContent, session, shopInfo);
                } else {
                    await handleWelcome(session, shopInfo);
                }
                break;
        }
    } catch (error) {
        console.error('Error processing intent:', error);
        await sendWhatsAppMessage(session.user_phone, 'Sorry, I encountered an error. Please try again.');
    }
}

/**
 * Handle first message from user
 * @param {String} userPhone - User's phone number
 * @param {String} messageContent - Message content
 * @param {Object} shopInfo - Shop information
 * @param {String} phoneNumberId - Phone number ID
 */
async function handleFirstMessage(userPhone, messageContent, shopInfo, phoneNumberId) {
    try {
        console.log('Handling first message from user:', userPhone);

        // Create new session
        const session = new Session({
            user_phone: userPhone,
            shop_id: shopInfo.shop_id,
            phone_number_id: phoneNumberId,
            phase: 'welcome',
            intent: 'first_message',
            is_active: true,
            context_data: {
                session_created: new Date(),
                first_message: messageContent
            }
        });

        await session.save();
        console.log('New session created for first message:', session._id);

        // Send welcome message with services
        await sendWelcomeWithServices(userPhone, shopInfo);

    } catch (error) {
        console.error('Error handling first message:', error);
        await sendWhatsAppMessage(userPhone, 'Welcome! I encountered an error. Please try again.');
    }
}

/**
 * Send welcome message with service options
 * @param {String} userPhone - User's phone number
 * @param {Object} shopInfo - Shop information
 */
async function sendWelcomeWithServices(userPhone, shopInfo) {
    try {
        console.log('Sending welcome message with services to:', userPhone);

        // Get available services for this shop
        const services = await ServiceCatalog.find({
            shop_id: shopInfo.shop_id
        }).sort({ sort_order: 1 }).limit(3);

        console.log('Found services:', services.length);

        if (services.length === 0) {
            await sendWhatsAppMessage(
                userPhone,
                `Welcome to ${shopInfo.settings.shop_name}! We're currently setting up our services. Please contact us directly for bookings.`
            );
            return;
        }

        const welcomeText = `Welcome to ${shopInfo.settings.shop_name}! 

Book your appointment quickly and easily through WhatsApp. No phone calls needed - just select your service and we'll handle the rest.

Please select a service:`;

        // Create service buttons (max 3 buttons for WhatsApp)
        const serviceButtons = services.map(service => ({
            id: `service_${service.service_key}`,
            title: service.label
        }));

        // Add "More Services" button if there are more than 3 services
        const totalServices = await ServiceCatalog.countDocuments({ shop_id: shopInfo.shop_id });
        if (totalServices > 3) {
            serviceButtons.push({
                id: 'more_services',
                title: 'More Services'
            });
        }

        await sendButtonMessage(userPhone, welcomeText, serviceButtons);
        console.log('Welcome message with services sent successfully');

    } catch (error) {
        console.error('Error sending welcome message with services:', error);
        await sendWhatsAppMessage(userPhone, 'Welcome! Please contact us directly to book an appointment.');
    }
}

// Add placeholder functions for other handlers
async function handleBookAppointment(session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Booking functionality will be implemented soon.');
}

async function handleCheckAvailability(session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Availability check functionality will be implemented soon.');
}

async function handleListServices(session, shopInfo) {
    await sendWelcomeWithServices(session.user_phone, shopInfo);
}

async function handleListBarbers(session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Barber list functionality will be implemented soon.');
}

async function handleCancelBooking(session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Cancellation functionality will be implemented soon.');
}

async function handleReschedule(session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Rescheduling functionality will be implemented soon.');
}

async function handleServiceSelection(messageContent, session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Service selection functionality will be implemented soon.');
}

async function handleBarberSelection(messageContent, session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Barber selection functionality will be implemented soon.');
}

async function showTimePeriodOptions(session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Time selection functionality will be implemented soon.');
}

async function handleTimePeriodSelection(messageContent, session, shopInfo) {
    await sendWhatsAppMessage(session.user_phone, 'Time period selection functionality will be implemented soon.');
}

async function handleWelcome(session, shopInfo) {
    await sendWelcomeWithServices(session.user_phone, shopInfo);
}

module.exports = { processIncomingMessage };