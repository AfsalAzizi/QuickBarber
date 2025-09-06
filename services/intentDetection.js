/**
 * Detect user intent from message content
 * @param {String} messageContent - User's message content
 * @param {Object} session - User session
 * @returns {String} - Detected intent
 */
function detectIntent(messageContent, session) {
    if (!messageContent) {
        return 'general_inquiry';
    }

    const message = messageContent.toLowerCase().trim();

    // Intent patterns
    const intentPatterns = {
        book_appointment: [
            'book', 'appointment', 'schedule', 'reserve', 'booking', 'book me', 'i want to book',
            'can i book', 'book a slot', 'make appointment', 'set appointment', 'book now'
        ],
        check_availability: [
            'available', 'availability', 'free slots', 'open slots', 'when are you free',
            'what time', 'check time', 'available time', 'free time', 'slots available'
        ],
        list_services: [
            'services', 'what services', 'service list', 'what do you offer', 'services available',
            'menu', 'price list', 'rates', 'pricing', 'what can you do'
        ],
        list_barbers: [
            'barbers', 'barber', 'stylist', 'who cuts hair', 'barber list', 'available barbers',
            'who is working', 'staff', 'team', 'barbers available'
        ],
        cancel_booking: [
            'cancel', 'cancellation', 'cancel booking', 'cancel appointment', 'i want to cancel',
            'cancel my booking', 'remove booking', 'delete appointment'
        ],
        reschedule: [
            'reschedule', 'change time', 'change date', 'move appointment', 'change booking',
            'postpone', 'different time', 'another time', 'reschedule appointment'
        ],
        general_inquiry: [
            'hello', 'hi', 'hey', 'help', 'information', 'info', 'contact', 'phone', 'address',
            'location', 'hours', 'timing', 'open', 'closed', 'when do you open', 'when do you close'
        ]
    };

    // Check for exact matches first
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
        for (const pattern of patterns) {
            if (message === pattern) {
                return intent;
            }
        }
    }

    // Check for partial matches
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
        for (const pattern of patterns) {
            if (message.includes(pattern)) {
                return intent;
            }
        }
    }

    // Check for button clicks (service selection)
    if (message.startsWith('service_')) {
        return 'select_service';
    }

    // Check for button clicks (barber selection)  
    if (message.startsWith('barber_')) {
        return 'select_barber';
    }

    // Check for "more services" button
    if (message === 'more_services') {
        return 'list_services';
    }

    // Check for number patterns (for service/barber selection)
    if (/^\d+$/.test(message)) {
        const number = parseInt(message);
        if (number >= 1 && number <= 20) {
            // This could be a service or barber selection
            if (session.phase === 'service_selection') {
                return 'select_service';
            } else if (session.phase === 'barber_selection') {
                return 'select_barber';
            }
        }
    }

    // Check for time patterns
    if (isTimePattern(message)) {
        return 'select_time';
    }

    // Check for date patterns
    if (isDatePattern(message)) {
        return 'select_date';
    }

    // Check for phone number patterns
    if (isPhonePattern(message)) {
        return 'provide_phone';
    }

    // Default to general inquiry
    return 'general_inquiry';
}

/**
 * Check if message contains time pattern
 * @param {String} message - Message content
 * @returns {Boolean} - True if time pattern found
 */
function isTimePattern(message) {
    const timePatterns = [
        /^\d{1,2}:\d{2}$/, // 9:30, 14:00
        /^\d{1,2}\s*(am|pm)$/i, // 9am, 2pm
        /^\d{1,2}:\d{2}\s*(am|pm)$/i, // 9:30am, 2:00pm
        /^(morning|afternoon|evening|night)$/i,
        /^(early|late)$/i
    ];

    return timePatterns.some(pattern => pattern.test(message));
}

/**
 * Check if message contains date pattern
 * @param {String} message - Message content
 * @returns {Boolean} - True if date pattern found
 */
function isDatePattern(message) {
    const datePatterns = [
        /^(today|tomorrow|yesterday)$/i,
        /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
        /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD
        /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
        /^(next week|this week|next month|this month)$/i
    ];

    return datePatterns.some(pattern => pattern.test(message));
}

/**
 * Check if message contains phone number pattern
 * @param {String} message - Message content
 * @returns {Boolean} - True if phone pattern found
 */
function isPhonePattern(message) {
    const phonePatterns = [
        /^\+?[1-9]\d{1,14}$/, // International format
        /^\d{10}$/, // 10 digit number
        /^\d{3}-\d{3}-\d{4}$/, // XXX-XXX-XXXX
        /^\d{3}\s\d{3}\s\d{4}$/, // XXX XXX XXXX
        /^\(\d{3}\)\s\d{3}-\d{4}$/ // (XXX) XXX-XXXX
    ];

    return phonePatterns.some(pattern => pattern.test(message));
}

/**
 * Extract service selection from message
 * @param {String} messageContent - User's message content
 * @param {Array} services - Available services
 * @returns {Object} - Selected service or null
 */
function extractServiceSelection(messageContent, services) {
    if (!messageContent || !services) {
        return null;
    }

    const message = messageContent.toLowerCase().trim();

    // Check for number selection
    if (/^\d+$/.test(message)) {
        const number = parseInt(message);
        if (number >= 1 && number <= services.length) {
            return services[number - 1];
        }
    }

    // Check for service name match
    for (const service of services) {
        if (message.includes(service.service_key.toLowerCase()) ||
            message.includes(service.label.toLowerCase())) {
            return service;
        }
    }

    return null;
}

/**
 * Extract barber selection from message
 * @param {String} messageContent - User's message content
 * @param {Array} barbers - Available barbers
 * @returns {Object} - Selected barber or null
 */
function extractBarberSelection(messageContent, barbers) {
    if (!messageContent || !barbers) {
        return null;
    }

    const message = messageContent.toLowerCase().trim();

    // Check for number selection
    if (/^\d+$/.test(message)) {
        const number = parseInt(message);
        if (number >= 1 && number <= barbers.length) {
            return barbers[number - 1];
        }
    }

    // Check for barber name match
    for (const barber of barbers) {
        if (message.includes(barber.name.toLowerCase())) {
            return barber;
        }
    }

    return null;
}

/**
 * Extract time from message
 * @param {String} messageContent - User's message content
 * @returns {String} - Extracted time or null
 */
function extractTime(messageContent) {
    if (!messageContent) {
        return null;
    }

    const message = messageContent.toLowerCase().trim();

    // Time patterns
    const timePatterns = [
        { pattern: /^(\d{1,2}):(\d{2})$/, format: 'HH:mm' },
        { pattern: /^(\d{1,2})\s*(am|pm)$/i, format: 'h a' },
        { pattern: /^(\d{1,2}):(\d{2})\s*(am|pm)$/i, format: 'h:mm a' }
    ];

    for (const { pattern, format } of timePatterns) {
        const match = message.match(pattern);
        if (match) {
            return message; // Return the matched time string
        }
    }

    // Check for relative time
    if (message.includes('morning')) return 'morning';
    if (message.includes('afternoon')) return 'afternoon';
    if (message.includes('evening')) return 'evening';
    if (message.includes('night')) return 'night';

    return null;
}

/**
 * Extract date from message
 * @param {String} messageContent - User's message content
 * @returns {String} - Extracted date or null
 */
function extractDate(messageContent) {
    if (!messageContent) {
        return null;
    }

    const message = messageContent.toLowerCase().trim();

    // Relative dates
    if (message === 'today') return 'today';
    if (message === 'tomorrow') return 'tomorrow';
    if (message === 'yesterday') return 'yesterday';

    // Day of week
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (days.includes(message)) return message;

    // Date patterns
    const datePatterns = [
        /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
        /^\d{4}-\d{1,2}-\d{1,2}$/ // YYYY-MM-DD
    ];

    for (const pattern of datePatterns) {
        if (pattern.test(message)) {
            return message;
        }
    }

    return null;
}

module.exports = {
    detectIntent,
    extractServiceSelection,
    extractBarberSelection,
    extractTime,
    extractDate,
    isTimePattern,
    isDatePattern,
    isPhonePattern
};
