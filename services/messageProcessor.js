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
const { ensureConnection } = require('../utils/dbConnection');

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
        console.log('Extracting message content...');
        const messageContent = extractMessageContent(message);
        console.log('Message content:', messageContent);

        if (!messageContent) {
            console.log('No text content found in message');
            return;
        }

        // Get shop information from phone number
        console.log('Getting shop info for phone number:', metadata.phone_number_id);
        const shopInfo = await getShopFromPhoneNumber(metadata.phone_number_id);
        console.log('Shop info result:', shopInfo);

        if (!shopInfo) {
            console.log('No shop found for phone number:', metadata.phone_number_id);
            return;
        }

        // Check if this is a first message (no existing session)
        console.log('Checking if first message for user:', message.from, 'shop:', shopInfo.shop_id);
        const isFirstMessage = await isFirstMessageFromUser(message.from, shopInfo.shop_id);
        console.log('Is first message:', isFirstMessage);

        if (isFirstMessage) {
            console.log('Handling first message...');
            // Handle first message with welcome flow
            await handleFirstMessage(message.from, messageContent, shopInfo, metadata.phone_number_id);
            console.log('First message handled successfully');
            return;
        }

        // Load existing session
        console.log('Loading existing session...');
        const session = await loadOrCreateSession(message.from, shopInfo.shop_id, metadata.phone_number_id);
        console.log('Session loaded:', session);

        // Detect user intent
        console.log('Detecting intent...');
        const intent = await detectIntent(messageContent, session);
        console.log('Detected intent:', intent);

        // Update session with new intent and message
        console.log('Updating session...');
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
        console.log('Processing intent:', intent);
        await processIntent(intent, messageContent, session, shopInfo);
        console.log('Intent processed successfully');

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
                // Return the button ID instead of title for proper intent detection
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
 * Get shop information from WhatsApp phone number
 * @param {String} phoneNumberId - WhatsApp phone number ID
 * @returns {Object} - Shop information
 */
async function getShopFromPhoneNumber(phoneNumberId) {
    try {
        console.log('Searching for WABA number with phone_number_id:', phoneNumberId);

        // Ensure connection is fully ready before querying
        await ensureConnection();

        console.log('Mongoose connection state before query:', mongoose.connection.readyState);

        // Execute the actual query with proper error handling
        console.log('Starting WABA number query...');
        const wabaNumber = await WabaNumber.findOne({ phone_number_id: phoneNumberId })
            .maxTimeMS(3000) // 3 second timeout
            .lean();

        console.log('WABA number query completed successfully');
        console.log('WABA number query result:', wabaNumber);

        if (!wabaNumber) {
            console.log('No WABA number found for phone_number_id:', phoneNumberId);
            return null;
        }

        console.log('Found WABA number, getting settings for shop_id:', wabaNumber.shop_id);

        // Execute settings query with proper error handling
        console.log('Starting settings query...');
        const settings = await Settings.findOne({ shop_id: wabaNumber.shop_id })
            .maxTimeMS(3000) // 3 second timeout
            .lean();

        console.log('Settings query completed successfully');
        console.log('Settings query result:', settings);

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

        console.log('Returning shop info:', result);
        return result;

    } catch (error) {
        console.error('Error in getShopFromPhoneNumber:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack
        });
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
        console.log('Loading session for user:', userPhone, 'shop:', shopId);

        // Try to find existing active session
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
 * Process user intent and respond accordingly
 * @param {String} intent - Detected intent
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function processIntent(intent, messageContent, session, shopInfo) {
    try {
        console.log('Processing intent:', intent, 'for user:', session.user_phone);

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
                // TODO: Implement specific time slot selection
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
        await sendWhatsAppMessage(session.user_phone, 'Sorry, I encountered an error. Please try again later.');
    }
}

/**
 * Handle welcome message
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleWelcome(session, shopInfo) {
    const welcomeMessage = `Welcome to ${shopInfo.settings.shop_name}\n\nI can help you with:\n• Book an appointment\n• Check availability\n• View our services\n• See our barbers\n• Cancel or reschedule\n\nWhat would you like to do today?`;

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
            await sendWhatsAppMessage(session.user_phone, 'No services are currently available.');
            return;
        }

        let message = `Available Services:\n\n`;
        services.forEach((service, index) => {
            message += `${index + 1}. ${service.label}\n`;
            message += `   Duration: ${service.duration_min} minutes\n\n`;
        });

        message += `To book an appointment, please reply with the service number or name.`;

        await sendWhatsAppMessage(session.user_phone, message);
        await updateSession(session, { phase: 'service_selection' });

    } catch (error) {
        console.error('Error handling list services:', error);
        await sendWhatsAppMessage(session.user_phone, 'Unable to retrieve our services. Please try again later.');
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
            await sendWhatsAppMessage(session.user_phone, 'No barbers are currently available.');
            return;
        }

        let message = `Available Barbers:\n\n`;
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
        await sendWhatsAppMessage(session.user_phone, 'Unable to retrieve our barbers. Please try again later.');
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
        console.log('Handling service selection:', messageContent);

        let selectedService = null;

        // Check if it's a button selection (service_key format)
        if (messageContent.startsWith('service_')) {
            const serviceKey = messageContent.replace('service_', '');
            console.log('Button service selection, service key:', serviceKey);

            selectedService = await ServiceCatalog.findOne({
                service_key: serviceKey,
                is_active: true
            });

            if (selectedService) {
                console.log('Found service from button:', selectedService.label);
            }
        } else {
            // Handle text-based service selection
            console.log('Text-based service selection, searching for:', messageContent);

            // Try to find service by name or partial match
            selectedService = await ServiceCatalog.findOne({
                $or: [
                    { label: { $regex: messageContent, $options: 'i' } },
                    { service_key: { $regex: messageContent, $options: 'i' } }
                ],
                is_active: true
            });

            if (selectedService) {
                console.log('Found service from text:', selectedService.label);
            }
        }

        if (!selectedService) {
            console.log('Service not found, showing available services');
            await handleListServices(session, shopInfo);
            return;
        }

        // Update session with selected service
        console.log('Updating session with selected service:', selectedService.service_key);
        await updateSession(session, {
            selected_service: selectedService.service_key,
            phase: 'barber_selection',
            intent: 'select_barber',
            context_data: {
                ...session.context_data,
                selected_service_name: selectedService.label,
                selected_service_duration: selectedService.duration_min,
                service_selected_at: new Date()
            }
        });

        // Get available barbers for this shop
        console.log('Getting available barbers for shop:', shopInfo.shop_id);
        const barbers = await Barber.find({
            shop_id: shopInfo.shop_id,
            active: true
        }).sort({ sort_order: 1 });

        console.log('Found barbers:', barbers.length);

        if (barbers.length === 0) {
            await sendWhatsAppMessage(
                session.user_phone,
                `Service selected: ${selectedService.label} (${selectedService.duration_min} minutes)\n\nNo barbers are currently available. Please try again later or contact us directly.`
            );
            return;
        }

        // Prepare barber selection message
        const barberSelectionText = `Service selected: ${selectedService.label}\nDuration: ${selectedService.duration_min} minutes\n\nPlease select your preferred barber:\n\nReply "back" to change your service selection.`;

        // Create barber buttons (max 3 buttons for WhatsApp)
        const barberButtons = barbers.slice(0, 3).map(barber => ({
            id: `barber_${barber.barber_id}`,
            title: barber.name
        }));

        // If there are more than 3 barbers, add a "More Barbers" button
        if (barbers.length > 3) {
            barberButtons.push({
                id: 'more_barbers',
                title: 'More Barbers'
            });
        }

        // Send interactive button message with barber selection
        await sendButtonMessage(session.user_phone, barberSelectionText, barberButtons);

        console.log('Barber selection message sent to:', session.user_phone);

    } catch (error) {
        console.error('Error handling service selection:', error);
        await sendWhatsAppMessage(session.user_phone, 'Unable to process your service selection. Please try again.');
    }
}

/**
 * Handle barber selection from button or text
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleBarberSelection(messageContent, session, shopInfo) {
    try {
        console.log('Handling barber selection:', messageContent);

        let selectedBarber = null;

        // Check if it's a button selection (barber_id format)
        if (messageContent.startsWith('barber_')) {
            const barberId = messageContent.replace('barber_', '');
            console.log('Button barber selection, barber ID:', barberId);

            selectedBarber = await Barber.findOne({
                barber_id: barberId,
                shop_id: shopInfo.shop_id,
                active: true
            });

            if (selectedBarber) {
                console.log('Found barber from button:', selectedBarber.name);
            }
        } else if (messageContent === 'more_barbers') {
            // Handle "More Barbers" button
            await handleListBarbers(session, shopInfo);
            return;
        } else {
            // Handle text-based barber selection
            console.log('Text-based barber selection, searching for:', messageContent);

            selectedBarber = await Barber.findOne({
                $or: [
                    { name: { $regex: messageContent, $options: 'i' } },
                    { barber_id: { $regex: messageContent, $options: 'i' } }
                ],
                shop_id: shopInfo.shop_id,
                active: true
            });

            if (selectedBarber) {
                console.log('Found barber from text:', selectedBarber.name);
            }
        }

        if (!selectedBarber) {
            console.log('Barber not found, showing available barbers');
            await handleListBarbers(session, shopInfo);
            return;
        }

        // Update session with selected barber
        console.log('Updating session with selected barber:', selectedBarber.barber_id);
        await updateSession(session, {
            selected_barber_id: selectedBarber.barber_id,
            selected_barber_name: selectedBarber.name,
            phase: 'time_selection',
            intent: 'select_time',
            context_data: {
                ...session.context_data,
                barber_selected_at: new Date()
            }
        });

        // Get service details for confirmation
        const service = await ServiceCatalog.findOne({
            service_key: session.selected_service
        });

        // Send confirmation message
        const confirmationText = `Booking Summary:\n\nService: ${service ? service.label : 'Selected Service'}\nBarber: ${selectedBarber.name}\nDuration: ${service ? service.duration_min : 'N/A'} minutes\n\nNext step: Select your preferred time period.`;

        await sendWhatsAppMessage(session.user_phone, confirmationText);

        // Show time period selection options
        console.log('Showing time period options for user:', session.user_phone);
        await showTimePeriodOptions(session, shopInfo);

        console.log('Barber selection completed for:', session.user_phone);

    } catch (error) {
        console.error('Error handling barber selection:', error);
        await sendWhatsAppMessage(session.user_phone, 'Unable to process your barber selection. Please try again.');
    }
}

/**
 * Handle time period selection
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function handleTimePeriodSelection(messageContent, session, shopInfo) {
    try {
        console.log('Handling time period selection:', messageContent);

        let selectedTimePeriod = null;

        // Check if it's a button selection
        if (messageContent.startsWith('time_')) {
            const timePeriod = messageContent.replace('time_', '');
            console.log('Button time period selection:', timePeriod);
            selectedTimePeriod = timePeriod;
        } else {
            // Handle text-based selection
            const message = messageContent.toLowerCase().trim();
            if (message.includes('immediate') || message.includes('next')) {
                selectedTimePeriod = 'immediate';
            } else if (message.includes('evening')) {
                selectedTimePeriod = 'evening';
            } else if (message.includes('later') || message.includes('today')) {
                selectedTimePeriod = 'later_today';
            }
        }

        if (!selectedTimePeriod) {
            console.log('Time period not recognized, showing available options');
            await showTimePeriodOptions(session, shopInfo);
            return;
        }

        // Update session with selected time period
        console.log('Updating session with time period:', selectedTimePeriod);
        await updateSession(session, {
            time_period_key: selectedTimePeriod,
            phase: 'time_selection',
            intent: 'select_specific_time',
            context_data: {
                ...session.context_data,
                time_period_selected_at: new Date()
            }
        });

        // Get available time slots for the selected period
        const availableSlots = await getAvailableTimeSlots(session, shopInfo, selectedTimePeriod);

        if (availableSlots.length === 0) {
            await sendWhatsAppMessage(
                session.user_phone,
                `No available slots found for ${getTimePeriodLabel(selectedTimePeriod)}. Please try a different time period.`
            );
            await showTimePeriodOptions(session, shopInfo);
            return;
        }

        // Show available time slots
        await showAvailableTimeSlots(session, shopInfo, availableSlots, selectedTimePeriod);

    } catch (error) {
        console.error('Error handling time period selection:', error);
        await sendWhatsAppMessage(session.user_phone, 'Unable to process your time selection. Please try again.');
    }
}

/**
 * Show time period selection options based on current time and shop settings
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 */
async function showTimePeriodOptions(session, shopInfo) {
    try {
        const settings = shopInfo.settings;
        const currentTime = moment().tz(settings.timezone);
        const currentHour = currentTime.hour();

        console.log('Current time:', currentTime.format('HH:mm'), 'Current hour:', currentHour);

        // Determine available time periods based on current time
        const availablePeriods = [];

        // Check if immediate slots are available (next 2 hours)
        if (await hasImmediateSlots(session, shopInfo)) {
            availablePeriods.push({
                id: 'time_immediate',
                title: 'Immediate (Next 2 hours)'
            });
        }

        // Check if evening slots are available (5 PM - 7 PM)
        if (currentHour < 17 && await hasEveningSlots(session, shopInfo)) {
            availablePeriods.push({
                id: 'time_evening',
                title: 'This Evening (5 PM - 7 PM)'
            });
        }

        // Check if later today slots are available (after evening until closing)
        if (await hasLaterTodaySlots(session, shopInfo)) {
            availablePeriods.push({
                id: 'time_later_today',
                title: 'Later Today (After 7 PM)'
            });
        }

        if (availablePeriods.length === 0) {
            await sendWhatsAppMessage(
                session.user_phone,
                'No time slots are available today. Please try again tomorrow or contact us directly.'
            );
            return;
        }

        const timeSelectionText = `Please select your preferred time period:\n\nReply "back" to change your barber selection.`;

        await sendButtonMessage(session.user_phone, timeSelectionText, availablePeriods);

    } catch (error) {
        console.error('Error showing time period options:', error);
        await sendWhatsAppMessage(session.user_phone, 'Unable to show time options. Please try again.');
    }
}

/**
 * Check if immediate slots are available (next 2 hours)
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 * @returns {Boolean}
 */
async function hasImmediateSlots(session, shopInfo) {
    try {
        const settings = shopInfo.settings;
        const currentTime = moment().tz(settings.timezone);
        const endTime = currentTime.clone().add(2, 'hours');

        // Check if we're within business hours
        if (!isWithinBusinessHours(currentTime, settings)) {
            return false;
        }

        // Check for available slots in the next 2 hours
        const availableSlots = await getAvailableSlotsInTimeRange(
            session,
            shopInfo,
            currentTime,
            endTime
        );

        return availableSlots.length > 0;
    } catch (error) {
        console.error('Error checking immediate slots:', error);
        return false;
    }
}

/**
 * Check if evening slots are available (5 PM - 7 PM)
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 * @returns {Boolean}
 */
async function hasEveningSlots(session, shopInfo) {
    try {
        const settings = shopInfo.settings;
        const currentTime = moment().tz(settings.timezone);

        // Evening is 5 PM - 7 PM
        const eveningStart = currentTime.clone().hour(17).minute(0).second(0);
        const eveningEnd = currentTime.clone().hour(19).minute(0).second(0);

        // Check if evening time is in the future
        if (eveningStart.isBefore(currentTime)) {
            return false;
        }

        // Check if we're within business hours
        if (!isWithinBusinessHours(eveningStart, settings)) {
            return false;
        }

        // Check for available slots in evening
        const availableSlots = await getAvailableSlotsInTimeRange(
            session,
            shopInfo,
            eveningStart,
            eveningEnd
        );

        return availableSlots.length > 0;
    } catch (error) {
        console.error('Error checking evening slots:', error);
        return false;
    }
}

/**
 * Check if later today slots are available (after 7 PM until closing)
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 * @returns {Boolean}
 */
async function hasLaterTodaySlots(session, shopInfo) {
    try {
        const settings = shopInfo.settings;
        const currentTime = moment().tz(settings.timezone);

        // Later today is after 7 PM until closing
        const laterStart = currentTime.clone().hour(19).minute(0).second(0);
        const closingTime = getClosingTime(currentTime, settings);

        // Check if later time is in the future
        if (laterStart.isBefore(currentTime)) {
            return false;
        }

        // Check if we're within business hours
        if (!isWithinBusinessHours(laterStart, settings)) {
            return false;
        }

        // Check for available slots in later today
        const availableSlots = await getAvailableSlotsInTimeRange(
            session,
            shopInfo,
            laterStart,
            closingTime
        );

        return availableSlots.length > 0;
    } catch (error) {
        console.error('Error checking later today slots:', error);
        return false;
    }
}

/**
 * Get available time slots for a specific time period
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 * @param {String} timePeriod - Time period key
 * @returns {Array} - Available time slots
 */
async function getAvailableTimeSlots(session, shopInfo, timePeriod) {
    try {
        const settings = shopInfo.settings;
        const currentTime = moment().tz(settings.timezone);

        let startTime, endTime;

        switch (timePeriod) {
            case 'immediate':
                startTime = currentTime;
                endTime = currentTime.clone().add(2, 'hours');
                break;
            case 'evening':
                startTime = currentTime.clone().hour(17).minute(0).second(0);
                endTime = currentTime.clone().hour(19).minute(0).second(0);
                break;
            case 'later_today':
                startTime = currentTime.clone().hour(19).minute(0).second(0);
                endTime = getClosingTime(currentTime, settings);
                break;
            default:
                return [];
        }

        return await getAvailableSlotsInTimeRange(session, shopInfo, startTime, endTime);
    } catch (error) {
        console.error('Error getting available time slots:', error);
        return [];
    }
}

/**
 * Get available slots in a specific time range
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 * @param {Object} startTime - Start time (moment object)
 * @param {Object} endTime - End time (moment object)
 * @returns {Array} - Available time slots
 */
async function getAvailableSlotsInTimeRange(session, shopInfo, startTime, endTime) {
    try {
        const settings = shopInfo.settings;
        const slotInterval = settings.slot_interval_min || 30;
        const service = await ServiceCatalog.findOne({ service_key: session.selected_service });
        const serviceDuration = service ? service.duration_min : 30;

        // Get existing bookings for the selected barber on the same day
        const existingBookings = await Booking.find({
            barber_id: session.selected_barber_id,
            date: startTime.format('YYYY-MM-DD'),
            status: { $in: ['confirmed', 'pending'] }
        });

        console.log('Existing bookings for barber:', existingBookings.length);

        const availableSlots = [];
        const currentSlot = startTime.clone();

        while (currentSlot.isBefore(endTime)) {
            const slotEnd = currentSlot.clone().add(serviceDuration, 'minutes');

            // Check if slot is within business hours
            if (isWithinBusinessHours(currentSlot, settings) &&
                isWithinBusinessHours(slotEnd, settings)) {

                // Check if slot conflicts with existing bookings
                const hasConflict = existingBookings.some(booking => {
                    const bookingStart = moment.tz(booking.start_time, settings.timezone);
                    const bookingEnd = moment.tz(booking.end_time, settings.timezone);

                    return (currentSlot.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart));
                });

                if (!hasConflict) {
                    availableSlots.push({
                        time: currentSlot.format('HH:mm'),
                        datetime: currentSlot.toISOString(),
                        display: currentSlot.format('h:mm A')
                    });
                }
            }

            currentSlot.add(slotInterval, 'minutes');
        }

        return availableSlots;
    } catch (error) {
        console.error('Error getting available slots in time range:', error);
        return [];
    }
}

/**
 * Show available time slots to user
 * @param {Object} session - User session
 * @param {Object} shopInfo - Shop information
 * @param {Array} availableSlots - Available time slots
 * @param {String} timePeriod - Selected time period
 */
async function showAvailableTimeSlots(session, shopInfo, availableSlots, timePeriod) {
    try {
        const timePeriodLabel = getTimePeriodLabel(timePeriod);

        if (availableSlots.length === 0) {
            await sendWhatsAppMessage(
                session.user_phone,
                `No available slots found for ${timePeriodLabel}. Please try a different time period.`
            );
            await showTimePeriodOptions(session, shopInfo);
            return;
        }

        // Create time slot buttons (max 3 buttons for WhatsApp)
        const timeButtons = availableSlots.slice(0, 3).map((slot, index) => ({
            id: `slot_${slot.time}`,
            title: slot.display
        }));

        // If there are more than 3 slots, add a "More Times" button
        if (availableSlots.length > 3) {
            timeButtons.push({
                id: 'more_times',
                title: 'More Times'
            });
        }

        const timeSelectionText = `Available time slots for ${timePeriodLabel}:\n\nPlease select your preferred time:\n\nReply "back" to change time period.`;

        await sendButtonMessage(session.user_phone, timeSelectionText, timeButtons);

    } catch (error) {
        console.error('Error showing available time slots:', error);
        await sendWhatsAppMessage(session.user_phone, 'Unable to show time slots. Please try again.');
    }
}

/**
 * Check if a time is within business hours
 * @param {Object} time - Time to check (moment object)
 * @param {Object} settings - Shop settings
 * @returns {Boolean}
 */
function isWithinBusinessHours(time, settings) {
    const currentHour = time.hour();
    const currentMinute = time.minute();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const openingTime = parseTime(settings.start_time);
    const closingTime = parseTime(settings.close_time);

    // Check lunch break
    if (settings.lunch_start && settings.lunch_end) {
        const lunchStart = parseTime(settings.lunch_start);
        const lunchEnd = parseTime(settings.lunch_end);

        if (currentTimeMinutes >= lunchStart && currentTimeMinutes < lunchEnd) {
            return false;
        }
    }

    return currentTimeMinutes >= openingTime && currentTimeMinutes < closingTime;
}

/**
 * Get closing time for the day
 * @param {Object} currentTime - Current time (moment object)
 * @param {Object} settings - Shop settings
 * @returns {Object} - Closing time (moment object)
 */
function getClosingTime(currentTime, settings) {
    const closingTime = parseTime(settings.close_time);
    return currentTime.clone().hour(Math.floor(closingTime / 60)).minute(closingTime % 60).second(0);
}

/**
 * Parse time string (HH:mm) to minutes
 * @param {String} timeString - Time string in HH:mm format
 * @returns {Number} - Time in minutes
 */
function parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Get time period label
 * @param {String} timePeriod - Time period key
 * @returns {String} - Time period label
 */
function getTimePeriodLabel(timePeriod) {
    switch (timePeriod) {
        case 'immediate':
            return 'Immediate (Next 2 hours)';
        case 'evening':
            return 'This Evening (5 PM - 7 PM)';
        case 'later_today':
            return 'Later Today (After 7 PM)';
        default:
            return 'Selected Time Period';
    }
}

/**
 * Check if this is a first message from user (no existing session)
 * @param {String} userPhone - User's phone number
 * @param {String} shopId - Shop ID
 * @returns {Boolean} - True if first message, false if ongoing session
 */
async function isFirstMessageFromUser(userPhone, shopId) {
    try {
        console.log('Checking for existing session for user:', userPhone, 'shop:', shopId);

        // Check if there's an existing active session
        const existingSession = await Session.findOne({
            user_phone: userPhone,
            shop_id: shopId,
            is_active: true
        });

        console.log('Existing session found:', !!existingSession);

        if (existingSession) {
            console.log('Session exists, this is NOT a first message');
            return false;
        } else {
            console.log('No session found, this IS a first message');
            return true;
        }

    } catch (error) {
        console.error('Error checking for existing session:', error);
        // Default to first message if error
        return true;
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
        // Professional welcome message
        const welcomeText = `Welcome to ${shopInfo.settings.shop_name}\n\nBook your appointment quickly and easily through WhatsApp.\n\nBenefits:\n• No app required - Book directly in chat\n• Fast booking process\n• Available 24/7\n\nPlease select your service:\n\nReply "menu" anytime to see options again.`;

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
        // Professional fallback message
        const fallbackMessage = `Welcome to ${shopInfo.settings.shop_name}\n\nBook your appointment quickly and easily through WhatsApp.\n\nBenefits:\n• No app required - Book directly in chat\n• Fast booking process\n• Available 24/7\n\nPlease reply "services" to see available services and book your appointment.\n\nReply "menu" anytime to see options again.`;

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
