import {
  ISession,
  IServiceCatalog,
  IBarber,
  SessionIntent,
} from "@/types/models";

/**
 * Detect user intent from message content
 */
export function detectIntent(
  messageContent: string,
  session: ISession
): SessionIntent {
  if (!messageContent) {
    return "general_inquiry";
  }

  const message = messageContent.toLowerCase().trim();

  // Check for button clicks first (service selection)
  if (message.startsWith("service_")) {
    return "select_service";
  }

  // Check for button clicks (barber selection)
  if (message.startsWith("barber_")) {
    return "select_barber";
  }

  // Check for button clicks (time period selection)
  if (message.startsWith("time_")) {
    return "select_time_period";
  }

  // Check for button clicks (time slot selection)
  if (message.startsWith("slot_")) {
    return "select_specific_time";
  }

  // Check for "more services" button
  if (message === "more_services") {
    return "list_services";
  }

  // Check for "more barbers" button
  if (message === "more_barbers") {
    return "list_barbers";
  }

  // Check if we're in service selection phase and user sent a service name
  if (session.phase === "service_selection") {
    // Common service names that might be sent as text
    const serviceNames = [
      "hair cut",
      "haircut",
      "cut",
      "trim",
      "beard trim",
      "beard",
      "cut + beard",
      "cut and beard",
      "full service",
      "complete service",
    ];

    for (const serviceName of serviceNames) {
      if (message.includes(serviceName)) {
        return "select_service";
      }
    }
  }

  // Check if we're in barber selection phase and user sent a barber name
  if (session.phase === "barber_selection") {
    return "select_barber";
  }

  // Check if we're in time selection phase
  if (session.phase === "time_selection") {
    return "select_time_period";
  }

  // Check for number patterns (for service/barber selection)
  if (/^\d+$/.test(message)) {
    const number = parseInt(message);
    if (number >= 1 && number <= 20) {
      if (session.phase === ("service_selection" as any)) {
        return "select_service";
      } else if (session.phase === ("barber_selection" as any)) {
        return "select_barber";
      } else if (session.phase === ("time_selection" as any)) {
        return "select_time_period";
      }
    }
  }

  // Intent patterns
  const intentPatterns: Record<SessionIntent, string[]> = {
    book_appointment: [
      "book",
      "appointment",
      "schedule",
      "reserve",
      "booking",
      "book me",
      "i want to book",
      "can i book",
      "book a slot",
      "make appointment",
      "set appointment",
      "book now",
    ],
    check_availability: [
      "available",
      "availability",
      "free slots",
      "open slots",
      "when are you free",
      "what time",
      "check time",
      "available time",
      "free time",
      "slots available",
    ],
    list_services: [
      "services",
      "what services",
      "service list",
      "what do you offer",
      "services available",
      "menu",
      "price list",
      "rates",
      "pricing",
      "what can you do",
    ],
    list_barbers: [
      "barbers",
      "barber",
      "stylist",
      "who cuts hair",
      "barber list",
      "available barbers",
      "who is working",
      "staff",
      "team",
      "barbers available",
    ],
    cancel_booking: [
      "cancel",
      "cancellation",
      "cancel booking",
      "cancel appointment",
      "i want to cancel",
      "cancel my booking",
      "remove booking",
      "delete appointment",
    ],
    reschedule: [
      "reschedule",
      "change time",
      "change date",
      "move appointment",
      "change booking",
      "postpone",
      "different time",
      "another time",
      "reschedule appointment",
    ],
    general_inquiry: [
      "hello",
      "hi",
      "hey",
      "help",
      "information",
      "info",
      "contact",
      "phone",
      "address",
      "location",
      "hours",
      "timing",
      "open",
      "closed",
      "when do you open",
      "when do you close",
    ],
    first_message: [],
    select_service: [],
    select_barber: [],
    select_time_period: [],
    select_specific_time: [],
  };

  // Check for exact matches first
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (message === pattern) {
        return intent as SessionIntent;
      }
    }
  }

  // Check for partial matches
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (message.includes(pattern)) {
        return intent as SessionIntent;
      }
    }
  }

  // Default to general inquiry
  return "general_inquiry";
}

/**
 * Check if message contains time pattern
 */
export function isTimePattern(message: string): boolean {
  const timePatterns = [
    /^\d{1,2}:\d{2}$/, // 9:30, 14:00
    /^\d{1,2}\s*(am|pm)$/i, // 9am, 2pm
    /^\d{1,2}:\d{2}\s*(am|pm)$/i, // 9:30am, 2:00pm
    /^(morning|afternoon|evening|night)$/i,
    /^(early|late)$/i,
  ];

  return timePatterns.some((pattern) => pattern.test(message));
}

/**
 * Check if message contains date pattern
 */
export function isDatePattern(message: string): boolean {
  const datePatterns = [
    /^(today|tomorrow|yesterday)$/i,
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
    /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
    /^(next week|this week|next month|this month)$/i,
  ];

  return datePatterns.some((pattern) => pattern.test(message));
}

/**
 * Check if message contains phone number pattern
 */
export function isPhonePattern(message: string): boolean {
  const phonePatterns = [
    /^\+?[1-9]\d{1,14}$/, // International format
    /^\d{10}$/, // 10 digit number
    /^\d{3}-\d{3}-\d{4}$/, // XXX-XXX-XXXX
    /^\d{3}\s\d{3}\s\d{4}$/, // XXX XXX XXXX
    /^\(\d{3}\)\s\d{3}-\d{4}$/, // (XXX) XXX-XXXX
  ];

  return phonePatterns.some((pattern) => pattern.test(message));
}

/**
 * Extract service selection from message
 */
export function extractServiceSelection(
  messageContent: string,
  services: IServiceCatalog[]
): IServiceCatalog | null {
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
    if (
      message.includes(service.service_key.toLowerCase()) ||
      message.includes(service.label.toLowerCase())
    ) {
      return service;
    }
  }

  return null;
}

/**
 * Extract barber selection from message
 */
export function extractBarberSelection(
  messageContent: string,
  barbers: IBarber[]
): IBarber | null {
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
 */
export function extractTime(messageContent: string): string | null {
  if (!messageContent) {
    return null;
  }

  const message = messageContent.toLowerCase().trim();

  // Time patterns
  const timePatterns = [
    { pattern: /^(\d{1,2}):(\d{2})$/, format: "HH:mm" },
    { pattern: /^(\d{1,2})\s*(am|pm)$/i, format: "h a" },
    { pattern: /^(\d{1,2}):(\d{2})\s*(am|pm)$/i, format: "h:mm a" },
  ];

  for (const { pattern, format } of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      return message; // Return the matched time string
    }
  }

  // Check for relative time
  if (message.includes("morning")) return "morning";
  if (message.includes("afternoon")) return "afternoon";
  if (message.includes("evening")) return "evening";
  if (message.includes("night")) return "night";

  return null;
}

/**
 * Extract date from message
 */
export function extractDate(messageContent: string): string | null {
  if (!messageContent) {
    return null;
  }

  const message = messageContent.toLowerCase().trim();

  // Relative dates
  if (message === "today") return "today";
  if (message === "tomorrow") return "tomorrow";
  if (message === "yesterday") return "yesterday";

  // Day of week
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  if (days.includes(message)) return message;

  // Date patterns
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
    /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD
  ];

  for (const pattern of datePatterns) {
    if (pattern.test(message)) {
      return message;
    }
  }

  return null;
}
