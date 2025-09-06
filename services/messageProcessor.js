const Session = require('../models/Session');
const WabaNumber = require('../models/WabaNumber');
const Settings = require('../models/Settings');
const ServiceCatalog = require('../models/ServiceCatalog');
const Barber = require('../models/Barber');
const Booking = require('../models/Booking');
const { sendWhatsAppMessage, sendButtonMessage } = require('./whatsappService');
const { detectIntent } = require('./intentDetection');
const moment = require('moment-timezone');

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

        // Extract message content based on type
        const messageContent = extractMessageContent(message);
        if (!messageContent) {
            console.log('No text content found in message');
            return;
        }

        // Get shop information from phone number
        const shopInfo = await getShopFromPhoneNumber(metadata.phone_number_id);
        if (!shopInfo) {
            console.log('No shop found for phone number:', metadata.phone_number_id);
            return;
        }

        // Check if this is a first message (no existing session or new conversation)
        const isFirstMessage = await isFirstMessageFromUser(message.from, shopInfo.shop_id);

        if (isFirstMessage) {
            // Handle first message with welcome flow
            await handleFirstMessage(message.from, messageContent, shopInfo, metadata.phone_number_id);
            return;
        }

        // Load existing session
        const session = await loadOrCreateSession(message.from, shopInfo.shop_id, metadata.phone_number_id);

        // Detect user intent
        const intent = await detectIntent(messageContent, session);

        // Update session with new intent and message
        await updateSession(session, {
            intent,
            last_activity: new Date(),
            context_data: {
                ...session.context_data,
                last_message: messageContent,
                last_message_id: message.id
            }
        });

        // Process based on intent
        await processIntent(intent, messageContent, session, shopInfo);

    } catch (error) {
        console.error('Error processing incoming message:', error);
        // Send error message to user
        await sendWhatsAppMessage(message.from, 'Sorry, I encountered an error. Please try again later.');
    }
}

/**
 * Extract message content based on message type
 * @param {Object} message - WhatsApp message object
 * @returns {String} - Extracted message content
 */
function extractMessageContent(message) {
    switch (message.type) {
        case 'text':
            return message.text.body;
        case 'interactive':
            if (message.interactive.type === 'button_reply') {
                return message.interactive.button_reply.title;
            } else if (message.interactive.type === 'list_reply') {
                return message.interactive.list_reply.title;
            }
            break;
        case 'button':
            return message.button.text;
        default:
            return null;
    }
}

/**
 * Get shop information from WhatsApp phone number
 * @param {String} phoneNumberId - WhatsApp phone number ID
 * @returns {Object} - Shop information
 */
async function getShopFromPhoneNumber(phoneNumberId) {
    try {
        const wabaNumber = await WabaNumber.findOne({ phone_number_id: phoneNumberId });
        if (!wabaNumber) {
            return null;
        }

        const settings = await Settings.findOne({ shop_id: wabaNumber.shop_id });
        return {
            shop_id: wabaNumber.shop_id,
            phone_number_id: phoneNumberId,
            display_phone_number: wabaNumber.display_phone_number,
            timezone: wabaNumber.timezone,
            settings
        };
    } catch (error) {
        console.error('Error getting shop from phone number:', error);
        return null;
    }
}

/**
 * Load existing session or create new one
 * @param {String} userPhone - User's phone number
 * @param {String} shopId - Shop ID
 * @param {String} phoneNumberId - WhatsApp phone number ID
 * @returns {Object} - Session object
 */
async function loadOrCreateSession(userPhone, shopId, phoneNumberId) {
    try {
        // Try to find existing active session
        let session = await Session.findOne({
            user_phone: userPhone,
            shop_id: shopId,
            is_active: true
        });

        if (!session) {
            // Create new session
            session = new Session({
                user_phone: userPhone,
                shop_id: shopId,
                phone_number_id: phoneNumberId,
                phase: 'welcome',
                is_active: true,
                context_data: {}
            });
            await session.save();
        }

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
 * Process user intent and respond accordingly
 * @param {String} intent - Detected intent
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function processIntent(intent, messageContent, session, shopInfo) {
    try {
        switch (intent) {
            case 'book_appointment':
                await handleBookAppointment(messageContent, session, shopInfo);
                break;
            case 'check_availability':
                await handleCheckAvailability(messageContent, session, shopInfo);
                break;
            case 'list_services':
                await handleListServices(session, shopInfo);
                break;
            case 'list_barbers':
                await handleListBarbers(session, shopInfo);
                break;
            case 'cancel_booking':
                await handleCancelBooking(messageContent, session, shopInfo);
                break;
            case 'reschedule':
                await handleReschedule(messageContent, session, shopInfo);
                break;
            case 'general_inquiry':
                await handleGeneralInquiry(messageContent, session, shopInfo);
                break;
            case 'select_service':
                await handleServiceSelection(messageContent, session, shopInfo);
                break;
            default:
                await handleWelcome(session, shopInfo);
                break;
        }
    } catch (error) {
        console.error('Error processing intent:', error);
        await sendWhatsAppMessage(session.user_phone, 'Sorry, I encountered an error. Please try again later.');
    }
}

/**
 * Handle welcome message
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleWelcome(session, shopInfo) {
    const welcomeMessage = `Welcome to ${shopInfo.settings.shop_name}! 🎉

I can help you with:
• 📅 Book an appointment
• 🕐 Check availability
• ✂️ View our services
• 👨‍💼 See our barbers
• ❌ Cancel or reschedule

What would you like to do today?`;

    await sendWhatsAppMessage(session.user_phone, welcomeMessage);

    // Update session phase
    await updateSession(session, { phase: 'service_selection' });
}

/**
 * Handle service listing
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleListServices(session, shopInfo) {
    try {
        const services = await ServiceCatalog.find({ is_active: true }).sort({ sort_order: 1 });

        if (services.length === 0) {
            await sendWhatsAppMessage(session.user_phone, 'Sorry, no services are currently available.');
            return;
        }

        let message = `Here are our available services:\n\n`;
        services.forEach((service, index) => {
            message += `${index + 1}. ${service.label}\n`;
            message += `   Duration: ${service.duration_min} minutes\n`;
            message += `   Price: ₹${service.default_price}\n\n`;
        });

        message += `To book an appointment, please reply with the service number or name.`;

        await sendWhatsAppMessage(session.user_phone, message);
        await updateSession(session, { phase: 'service_selection' });

    } catch (error) {
        console.error('Error handling list services:', error);
        await sendWhatsAppMessage(session.user_phone, 'Sorry, I couldn\'t retrieve our services. Please try again later.');
    }
}

/**
 * Handle barber listing
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleListBarbers(session, shopInfo) {
    try {
        const barbers = await Barber.find({
            shop_id: shopInfo.shop_id,
            active: true
        }).sort({ sort_order: 1 });

        if (barbers.length === 0) {
            await sendWhatsAppMessage(session.user_phone, 'Sorry, no barbers are currently available.');
            return;
        }

        let message = `Here are our available barbers:\n\n`;
        barbers.forEach((barber, index) => {
            message += `${index + 1}. ${barber.name}\n`;
            if (barber.specialties && barber.specialties.length > 0) {
                message += `   Specialties: ${barber.specialties.join(', ')}\n`;
            }
            message += `\n`;
        });

        message += `To book with a specific barber, please reply with the barber number or name.`;

        await sendWhatsAppMessage(session.user_phone, message);
        await updateSession(session, { phase: 'barber_selection' });

    } catch (error) {
        console.error('Error handling list barbers:', error);
        await sendWhatsAppMessage(session.user_phone, 'Sorry, I couldn\'t retrieve our barbers. Please try again later.');
    }
}

/**
 * Handle appointment booking
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleBookAppointment(messageContent, session, shopInfo) {
    // This is a simplified version - you'll need to implement the full booking flow
    await sendWhatsAppMessage(session.user_phone, 'Booking functionality will be implemented in the next phase. For now, please contact us directly.');
}

/**
 * Handle availability check
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleCheckAvailability(messageContent, session, shopInfo) {
    // This is a simplified version - you'll need to implement the full availability check
    await sendWhatsAppMessage(session.user_phone, 'Availability check functionality will be implemented in the next phase. For now, please contact us directly.');
}

/**
 * Handle booking cancellation
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleCancelBooking(messageContent, session, shopInfo) {
    // This is a simplified version - you'll need to implement the full cancellation flow
    await sendWhatsAppMessage(session.user_phone, 'Cancellation functionality will be implemented in the next phase. For now, please contact us directly.');
}

/**
 * Handle rescheduling
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleReschedule(messageContent, session, shopInfo) {
    // This is a simplified version - you'll need to implement the full rescheduling flow
    await sendWhatsAppMessage(session.user_phone, 'Rescheduling functionality will be implemented in the next phase. For now, please contact us directly.');
}

/**
 * Handle general inquiries
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleGeneralInquiry(messageContent, session, shopInfo) {
    const response = `Thank you for your inquiry! For detailed information about our services, please visit our shop or call us directly.

Shop: ${shopInfo.settings.shop_name}
Phone: ${shopInfo.display_phone_number}

Is there anything specific I can help you with regarding appointments?`;

    await sendWhatsAppMessage(session.user_phone, response);
}

/**
 * Handle service selection from button or text
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleServiceSelection(messageContent, session, shopInfo) {
    try {
        // Check if it's a button selection (service_key format)
        if (messageContent.startsWith('service_')) {
            const serviceKey = messageContent.replace('service_', '');
            const service = await ServiceCatalog.findOne({ service_key: serviceKey });

            if (service) {
                // Update session with selected service
                await updateSession(session, {
                    selected_service: serviceKey,
                    phase: 'barber_selection'
                });

                // Get available barbers
                const barbers = await Barber.find({
                    shop_id: shopInfo.shop_id,
                    active: true
                }).sort({ sort_order: 1 });

                if (barbers.length > 0) {
                    // Send barber selection message
                    const barberButtons = barbers.slice(0, 3).map(barber => ({
                        id: `barber_${barber.barber_id}`,
                        title: barber.name
                    }));

                    await sendButtonMessage(
                        session.user_phone,
                        `Great! You selected ${service.label}. Now choose your barber:`,
                        barberButtons
                    );
                } else {
                    await sendWhatsAppMessage(session.user_phone, `Great! You selected ${service.label}. Let me check available barbers and get back to you.`);
                }
            }
        } else {
            // Handle text-based service selection
            await handleListServices(session, shopInfo);
        }
    } catch (error) {
        console.error('Error handling service selection:', error);
        await sendWhatsAppMessage(session.user_phone, 'Sorry, I couldn\'t process your service selection. Please try again.');
    }
}

/**
 * Check if this is the first message from a user
 * @param {String} userPhone - User's phone number
 * @param {String} shopId - Shop ID
 * @returns {Boolean} - True if this is a first message
 */
async function isFirstMessageFromUser(userPhone, shopId) {
    try {
        // Check if there's any existing session for this user and shop
        const existingSession = await Session.findOne({
            user_phone: userPhone,
            shop_id: shopId
        });

        return !existingSession;
    } catch (error) {
        console.error('Error checking first message:', error);
        return true; // Default to first message if error
    }
}

/**
 * Handle first message from user
 * @param {String} userPhone - User's phone number
 * @param {String} messageContent - User's message content
 * @param {Object} shopInfo - Shop information
 * @param {String} phoneNumberId - WhatsApp phone number ID
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
                first_message: messageContent,
                first_message_time: new Date()
            }
        });
        await session.save();

        // Get services for the shop
        const services = await ServiceCatalog.find({ is_active: true }).sort({ sort_order: 1 });

        // Create welcome message with service buttons
        await sendWelcomeWithServices(userPhone, shopInfo, services);

        // Update session phase
        await updateSession(session, { phase: 'service_selection' });

    } catch (error) {
        console.error('Error handling first message:', error);
        await sendWhatsAppMessage(userPhone, 'Welcome! I\'m here to help you book an appointment. Please try again.');
    }
}

/**
 * Send welcome message with service selection buttons
 * @param {String} userPhone - User's phone number
 * @param {Object} shopInfo - Shop information
 * @param {Array} services - Available services
 */
async function sendWelcomeWithServices(userPhone, shopInfo, services) {
    try {
        // Welcome message text
        const welcomeText = `Book in minutes—choose a service below. Reply **menu** anytime to see options again.`;

        // Create service buttons (max 3 buttons for WhatsApp)
        const serviceButtons = services.slice(0, 3).map(service => ({
            id: `service_${service.service_key}`,
            title: service.label
        }));

        // If there are more than 3 services, add a "More Services" button
        if (services.length > 3) {
            serviceButtons.push({
                id: 'more_services',
                title: 'More Services'
            });
        }

        // Send interactive button message
        await sendButtonMessage(userPhone, welcomeText, serviceButtons);

        console.log('Welcome message with services sent to:', userPhone);

    } catch (error) {
        console.error('Error sending welcome with services:', error);
        // Fallback to simple text message
        const fallbackMessage = `Welcome to ${shopInfo.settings.shop_name}! 💈\n\nI can help you book an appointment. Please reply with "services" to see our available services.`;
        await sendWhatsAppMessage(userPhone, fallbackMessage);
    }
}

/**
 * Load existing session
 * @param {String} userPhone - User's phone number
 * @param {String} shopId - Shop ID
 * @returns {Object} - Session object
 */
async function loadSession(userPhone, shopId) {
    try {
        const session = await Session.findOne({
            user_phone: userPhone,
            shop_id: shopId,
            is_active: true
        });

        return session;
    } catch (error) {
        console.error('Error loading session:', error);
        return null;
    }
}

module.exports = {
    processIncomingMessage
};
