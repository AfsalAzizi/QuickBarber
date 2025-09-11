import {
  Session,
  WabaNumber,
  Settings,
  ServiceCatalog,
  Barber,
  Booking,
  ISession,
  IServiceCatalog,
  IBarber,
  ISettings,
  IWabaNumber,
  SessionIntent,
} from "../models";
import {
  sendWhatsAppMessage,
  sendButtonMessage,
  ButtonOption,
} from "./whatsappService";
import { detectIntent } from "./intentDetection";
import { WhatsAppMessage } from "../types/express";
import moment from "moment-timezone";

export interface ShopInfo {
  shop_id: string;
  phone_number_id: string;
  display_phone_number: string;
  timezone: string;
  settings: any;
}

export interface MessageMetadata {
  phone_number_id: string;
  display_phone_number: string;
}

/**
 * Process incoming WhatsApp message
 */
export async function processIncomingMessage(
  message: WhatsAppMessage,
  metadata: MessageMetadata
): Promise<void> {
  try {
    console.log("Processing incoming message:", {
      id: message.id,
      from: message.from,
      type: message.type,
      timestamp: message.timestamp,
    });

    // Extract message content
    const messageContent = extractMessageContent(message);
    console.log("Extracted message content:", messageContent);

    if (!messageContent) {
      console.log("No message content found, ignoring message");
      return;
    }

    // Get shop information from phone number
    const shopInfo = await getShopFromPhoneNumber(metadata.phone_number_id);
    if (!shopInfo) {
      console.log("No shop found for phone number:", metadata.phone_number_id);
      return;
    }

    console.log("Shop info:", shopInfo.shop_id);

    // Check if this is a first message from user
    const isFirstMessage = await isFirstMessageFromUser(
      message.from,
      shopInfo.shop_id
    );
    console.log("Is first message:", isFirstMessage);

    if (isFirstMessage) {
      await handleFirstMessage(
        message.from,
        messageContent,
        shopInfo,
        metadata.phone_number_id
      );
    } else {
      // Load existing session
      const session = await loadOrCreateSession(
        message.from,
        shopInfo.shop_id,
        metadata.phone_number_id
      );
      console.log("Session loaded:", session._id);

      // Detect intent
      const intent = detectIntent(messageContent, session);
      console.log("Detected intent:", intent);

      // Process intent
      await processIntent(intent, messageContent, session, shopInfo);
    }
  } catch (error) {
    console.error("Error processing incoming message:", error);
  }
}

/**
 * Extract message content from different message types
 */
function extractMessageContent(message: WhatsAppMessage): string | null {
  switch (message.type) {
    case "text":
      return message.text?.body || null;
    case "interactive":
      if (
        message.interactive?.type === "button_reply" &&
        message.interactive.button_reply
      ) {
        return message.interactive.button_reply.id;
      } else if (
        message.interactive?.type === "list_reply" &&
        message.interactive.list_reply
      ) {
        return message.interactive.list_reply.id;
      }
      break;
    case "button":
      return message.button?.text || null;
    default:
      return null;
  }
  return null;
}

/**
 * Get shop information from phone number
 */
async function getShopFromPhoneNumber(
  phoneNumberId: string
): Promise<ShopInfo | null> {
  try {
    console.log(
      "Searching for WABA number with phone_number_id:",
      phoneNumberId
    );

    const wabaNumber = await WabaNumber.findOne({
      phone_number_id: phoneNumberId,
    })
      .maxTimeMS(5000)
      .lean<IWabaNumber | null>();

    console.log("WABA number query completed, result:", wabaNumber);

    if (!wabaNumber) {
      console.log("No WABA number found for phone_number_id:", phoneNumberId);
      return null;
    }

    console.log(
      "Found WABA number, getting settings for shop_id:",
      wabaNumber.shop_id
    );

    const settings = await Settings.findOne({ shop_id: wabaNumber.shop_id })
      .maxTimeMS(5000)
      .lean<ISettings | null>();

    console.log("Settings query completed, result:", settings);

    if (!settings) {
      console.log("No settings found for shop_id:", wabaNumber.shop_id);
      return null;
    }

    const result: ShopInfo = {
      shop_id: wabaNumber.shop_id,
      phone_number_id: phoneNumberId,
      display_phone_number: wabaNumber.display_phone_number,
      timezone: wabaNumber.timezone,
      settings,
    };

    console.log("Shop info result:", result);
    return result;
  } catch (error: unknown) {
    console.error("Error getting shop from phone number:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Check if this is a first message from user
 */
async function isFirstMessageFromUser(
  userPhone: string,
  shopId: string
): Promise<boolean> {
  try {
    const existingSession = await Session.findOne({
      user_phone: userPhone,
      shop_id: shopId,
      is_active: true,
    }).lean();

    return !existingSession;
  } catch (error) {
    console.error("Error checking for existing session:", error);
    return true; // Default to first message if error
  }
}

/**
 * Handle first message from user
 */
async function handleFirstMessage(
  userPhone: string,
  messageContent: string,
  shopInfo: ShopInfo,
  phoneNumberId: string
): Promise<void> {
  try {
    console.log("Handling first message from user:", userPhone);

    // Create new session
    const session = new Session({
      user_phone: userPhone,
      shop_id: shopInfo.shop_id,
      phone_number_id: phoneNumberId,
      intent: "first_message",
      phase: "welcome",
      is_active: true,
      last_activity: new Date(),
      updated_at_iso: new Date(),
    });

    await session.save();
    console.log("Created new session:", session._id);

    // Send welcome message with services
    await sendWelcomeWithServices(userPhone, shopInfo);
  } catch (error) {
    console.error("Error handling first message:", error);
  }
}

/**
 * Send welcome message with service options
 */
async function sendWelcomeWithServices(
  userPhone: string,
  shopInfo: ShopInfo
): Promise<void> {
  try {
    console.log("Sending welcome message with services to:", userPhone);

    // Get available services
    const services = await ServiceCatalog.find({ is_active: true })
      .sort({ sort_order: 1 })
      .limit(3) // Show first 3 services
      .lean();

    console.log("Found services:", services.length);

    if (services.length === 0) {
      // No services available
      await sendWhatsAppMessage(
        userPhone,
        `Welcome to ${shopInfo.settings.shop_name}! We're currently setting up our services. Please check back later.`
      );
      return;
    }

    // Create welcome message
    const welcomeMessage = `Welcome to ${shopInfo.settings.shop_name}! 

I'm here to help you book your appointment quickly and easily. 

Please select a service:`;

    // Create service buttons
    const serviceButtons: ButtonOption[] = services.map((service, index) => ({
      id: `service_${service.service_key}`,
      title: service.label,
    }));

    // Add "More Services" button if there are more than 3 services
    const totalServices = await ServiceCatalog.countDocuments({
      is_active: true,
    });
    if (totalServices > 3) {
      serviceButtons.push({
        id: "more_services",
        title: "More Services",
      });
    }

    // Send button message
    await sendButtonMessage(userPhone, welcomeMessage, serviceButtons);

    console.log("Welcome message with services sent successfully");
  } catch (error) {
    console.error("Error sending welcome message with services:", error);
  }
}

/**
 * Load or create session
 */
async function loadOrCreateSession(
  userPhone: string,
  shopId: string,
  phoneNumberId: string
): Promise<ISession> {
  try {
    let session = await Session.findOne({
      user_phone: userPhone,
      shop_id: shopId,
      is_active: true,
    });

    if (!session) {
      // Create new session if none exists
      session = new Session({
        user_phone: userPhone,
        shop_id: shopId,
        phone_number_id: phoneNumberId,
        intent: "first_message",
        phase: "welcome",
        is_active: true,
        last_activity: new Date(),
        updated_at_iso: new Date(),
      });

      await session.save();
      console.log("Created new session:", session._id);
    } else {
      // Update last activity
      session.last_activity = new Date();
      session.updated_at_iso = new Date();
      await session.save();
    }

    return session;
  } catch (error) {
    console.error("Error loading or creating session:", error);
    throw error;
  }
}

/**
 * Process intent
 */
async function processIntent(
  intent: SessionIntent,
  messageContent: string,
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  try {
    console.log("Processing intent:", intent);

    switch (intent) {
      case "select_service":
        await handleServiceSelection(messageContent, session, shopInfo);
        break;
      case "select_barber":
        await handleBarberSelection(messageContent, session, shopInfo);
        break;
      case "select_time_period":
        await handleTimePeriodSelection(messageContent, session, shopInfo);
        break;
      case "select_specific_time":
        await handleSpecificTimeSelection(messageContent, session, shopInfo);
        break;
      case "list_services":
        await handleListServices(session, shopInfo);
        break;
      case "list_barbers":
        await handleListBarbers(session, shopInfo);
        break;
      case "book_appointment":
        await handleBookAppointment(session, shopInfo);
        break;
      case "check_availability":
        await handleCheckAvailability(session, shopInfo);
        break;
      case "cancel_booking":
        await handleCancelBooking(session, shopInfo);
        break;
      case "reschedule":
        await handleReschedule(session, shopInfo);
        break;
      default:
        await handleGeneralInquiry(messageContent, session, shopInfo);
        break;
    }
  } catch (error) {
    console.error("Error processing intent:", error);
  }
}

/**
 * Handle service selection
 */
async function handleServiceSelection(
  messageContent: string,
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  try {
    console.log("Handling service selection:", messageContent);

    // Extract service key from message
    let serviceKey = messageContent;
    if (messageContent.startsWith("service_")) {
      serviceKey = messageContent.replace("service_", "");
    }

    // Get service details
    const service = await ServiceCatalog.findOne({
      service_key: serviceKey,
      is_active: true,
    }).lean<IServiceCatalog | null>();

    if (!service) {
      await sendWhatsAppMessage(
        session.user_phone,
        "Sorry, I couldn't find that service. Please select from the available options."
      );
      return;
    }

    // Update session
    session.selected_service = serviceKey;
    session.intent = "select_barber";
    session.phase = "barber_selection";
    session.updated_at_iso = new Date();
    await session.save();

    // Get available barbers
    const barbers = await Barber.find({
      shop_id: shopInfo.shop_id,
      active: true,
    })
      .sort({ sort_order: 1 })
      .limit(3)
      .lean<IBarber[]>();

    if (barbers.length === 0) {
      await sendWhatsAppMessage(
        session.user_phone,
        "Sorry, no barbers are available at the moment. Please try again later."
      );
      return;
    }

    // Send barber selection message
    const barberMessage = `Great choice! You selected: ${service.label}

Now, please select your preferred barber:`;

    const barberButtons: ButtonOption[] = barbers.map((barber) => ({
      id: `barber_${barber.barber_id}`,
      title: barber.name,
    }));

    // Add "More Barbers" button if there are more than 3 barbers
    const totalBarbers = await Barber.countDocuments({
      shop_id: shopInfo.shop_id,
      active: true,
    });
    if (totalBarbers > 3) {
      barberButtons.push({
        id: "more_barbers",
        title: "More Barbers",
      });
    }

    await sendButtonMessage(session.user_phone, barberMessage, barberButtons);
  } catch (error) {
    console.error("Error handling service selection:", error);
  }
}

/**
 * Handle barber selection
 */
async function handleBarberSelection(
  messageContent: string,
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  try {
    console.log("Handling barber selection:", messageContent);
    console.log("Session data:", {
      selected_service: session.selected_service,
      selected_barber_id: session.selected_barber_id,
      phase: session.phase,
    });

    // Extract barber ID from message
    let barberId = messageContent;
    if (messageContent.startsWith("barber_")) {
      barberId = messageContent.replace("barber_", "");
    }

    console.log("Extracted barber ID:", barberId);

    // Get barber details
    const barber = await Barber.findOne({
      barber_id: barberId,
      shop_id: shopInfo.shop_id,
      active: true,
    }).lean<IBarber | null>();

    console.log(
      "Found barber:",
      barber ? { name: barber.name, barber_id: barber.barber_id } : null
    );

    if (!barber) {
      console.log("Barber not found, sending error message");
      await sendWhatsAppMessage(
        session.user_phone,
        "Sorry, I couldn't find that barber. Please select from the available options."
      );
      return;
    }

    // Update session
    session.selected_barber_id = barberId;
    session.selected_barber_name = barber.name;
    session.intent = "select_time_period";
    session.phase = "time_selection";
    session.updated_at_iso = new Date();

    console.log("Updating session with barber selection");
    await session.save();
    console.log("Session updated successfully");

    // Show time period options
    console.log("Showing time period options");
    await showTimePeriodOptions(session, shopInfo);
    console.log("Time period options sent successfully");
  } catch (error) {
    console.error("Error handling barber selection:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );
  }
}

/**
 * Show time period options
 */
async function showTimePeriodOptions(
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  try {
    console.log("Showing time period options");
    console.log("Session data:", {
      selected_barber_id: session.selected_barber_id,
      selected_barber_name: session.selected_barber_name,
      selected_service: session.selected_service,
    });
    console.log("Shop info:", {
      shop_id: shopInfo.shop_id,
      timezone: shopInfo.timezone,
      settings: shopInfo.settings,
    });

    const currentTime = moment().tz(shopInfo.timezone);
    const currentHour = currentTime.hour();
    const currentMinute = currentTime.minute();

    console.log("Current time:", currentTime.format("YYYY-MM-DD HH:mm:ss"));
    console.log("Current hour:", currentHour);

    // Check availability for different time periods
    console.log("Checking immediate slots availability...");
    const hasImmediate = await hasImmediateSlots(
      session,
      shopInfo,
      currentTime
    );

    console.log("Checking evening slots availability...");
    const hasEvening = await hasEveningSlots(session, shopInfo, currentTime);

    console.log("Checking later today slots availability...");
    const hasLaterToday = await hasLaterTodaySlots(
      session,
      shopInfo,
      currentTime
    );

    console.log("Availability check results:", {
      hasImmediate,
      hasEvening,
      hasLaterToday,
    });

    const timeMessage = `Perfect! You selected ${session.selected_barber_name}.

When would you like to book your appointment?`;

    const timeButtons: ButtonOption[] = [];

    if (hasImmediate) {
      timeButtons.push({
        id: "time_immediate",
        title: "Immediate",
      });
    }

    if (hasEvening) {
      timeButtons.push({
        id: "time_evening",
        title: "This evening",
      });
    }

    if (hasLaterToday) {
      timeButtons.push({
        id: "time_later_today",
        title: "Later today",
      });
    }

    console.log("Generated time buttons:", timeButtons);

    if (timeButtons.length === 0) {
      console.log("No time slots available, sending no availability message");
      await sendWhatsAppMessage(
        session.user_phone,
        "Sorry, no time slots are available today. Please try again tomorrow."
      );
      return;
    }

    console.log("Sending time period options to user");
    await sendButtonMessage(session.user_phone, timeMessage, timeButtons);
    console.log("Time period options sent successfully");
  } catch (error) {
    console.error("Error showing time period options:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    // Send error message to user
    try {
      await sendWhatsAppMessage(
        session.user_phone,
        "Sorry, there was an error processing your request. Please try again."
      );
    } catch (sendError) {
      console.error("Error sending error message to user:", sendError);
    }
  }
}

/**
 * Check if immediate slots are available
 */
async function hasImmediateSlots(
  session: ISession,
  shopInfo: ShopInfo,
  currentTime: moment.Moment
): Promise<boolean> {
  try {
    const settings = shopInfo.settings;
    const currentHour = currentTime.hour();
    const currentMinute = currentTime.minute();

    // Parse shop hours
    const [startHour, startMinute] = settings.start_time.split(":").map(Number);
    const [closeHour, closeMinute] = settings.close_time.split(":").map(Number);
    const [eveningHour, eveningMinute] = settings.evening_start
      .split(":")
      .map(Number);

    // Calculate immediate time window (next 2 hours)
    const immediateEndTime = currentTime.clone().add(2, "hours");
    const immediateEndHour = immediateEndTime.hour();
    const immediateEndMinute = immediateEndTime.minute();

    // Check if immediate window is within shop hours
    const immediateEndTimeMinutes = immediateEndHour * 60 + immediateEndMinute;
    const closeTimeMinutes = closeHour * 60 + closeMinute;

    if (immediateEndTimeMinutes > closeTimeMinutes) {
      console.log("Immediate slots not available: extends beyond closing time");
      return false;
    }

    // Check if we're too close to closing time (less than 2 hours)
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    if (currentTimeMinutes + 120 > closeTimeMinutes) {
      console.log("Immediate slots not available: too close to closing time");
      return false;
    }

    // Check for actual availability in the immediate window
    const hasAvailability = await checkTimeSlotAvailability(
      session,
      shopInfo,
      currentTime,
      immediateEndTime
    );

    console.log("Immediate slots availability:", hasAvailability);
    return hasAvailability;
  } catch (error) {
    console.error("Error checking immediate slots:", error);
    return false;
  }
}

/**
 * Check if evening slots are available
 */
async function hasEveningSlots(
  session: ISession,
  shopInfo: ShopInfo,
  currentTime: moment.Moment
): Promise<boolean> {
  try {
    const settings = shopInfo.settings;
    const currentHour = currentTime.hour();
    const currentMinute = currentTime.minute();

    // Check if evening_start is configured
    if (!settings.evening_start || settings.evening_start.trim() === "") {
      console.log("Evening slots not available: evening_start not configured");
      return false;
    }

    // Parse shop hours
    const [eveningHour, eveningMinute] = settings.evening_start
      .split(":")
      .map(Number);
    const [closeHour, closeMinute] = settings.close_time.split(":").map(Number);

    // Check if current time is before evening
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const eveningTimeMinutes = eveningHour * 60 + eveningMinute;

    if (currentTimeMinutes >= eveningTimeMinutes) {
      console.log("Evening slots not available: already past evening time");
      return false;
    }

    // Check if there's enough time between evening and closing
    const closeTimeMinutes = closeHour * 60 + closeMinute;
    const eveningDuration = closeTimeMinutes - eveningTimeMinutes;

    if (eveningDuration < 60) {
      // At least 1 hour needed
      console.log(
        "Evening slots not available: insufficient time between evening and closing"
      );
      return false;
    }

    // Check for actual availability in evening window
    const eveningStart = currentTime
      .clone()
      .hour(eveningHour)
      .minute(eveningMinute)
      .seconds(0);
    const eveningEnd = currentTime
      .clone()
      .hour(closeHour)
      .minute(closeMinute)
      .seconds(0);

    const hasAvailability = await checkTimeSlotAvailability(
      session,
      shopInfo,
      eveningStart,
      eveningEnd
    );

    console.log("Evening slots availability:", hasAvailability);
    return hasAvailability;
  } catch (error) {
    console.error("Error checking evening slots:", error);
    return false;
  }
}

/**
 * Check if later today slots are available
 */
async function hasLaterTodaySlots(
  session: ISession,
  shopInfo: ShopInfo,
  currentTime: moment.Moment
): Promise<boolean> {
  try {
    const settings = shopInfo.settings;
    const currentHour = currentTime.hour();
    const currentMinute = currentTime.minute();

    // Parse shop hours
    const [eveningHour, eveningMinute] = settings.evening_start
      .split(":")
      .map(Number);
    const [closeHour, closeMinute] = settings.close_time.split(":").map(Number);

    // Check if current time is after evening
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const eveningTimeMinutes = eveningHour * 60 + eveningMinute;

    if (currentTimeMinutes < eveningTimeMinutes) {
      console.log("Later today slots not available: not yet evening");
      return false;
    }

    // Check if we're too close to closing time (less than 1 hour)
    const closeTimeMinutes = closeHour * 60 + closeMinute;
    if (currentTimeMinutes + 60 > closeTimeMinutes) {
      console.log("Later today slots not available: too close to closing time");
      return false;
    }

    // Check for actual availability in later today window
    const laterStart = currentTime.clone();
    const laterEnd = currentTime
      .clone()
      .hour(closeHour)
      .minute(closeMinute)
      .seconds(0);

    const hasAvailability = await checkTimeSlotAvailability(
      session,
      shopInfo,
      laterStart,
      laterEnd
    );

    console.log("Later today slots availability:", hasAvailability);
    return hasAvailability;
  } catch (error) {
    console.error("Error checking later today slots:", error);
    return false;
  }
}

/**
 * Check time slot availability by looking for booking conflicts
 */
async function checkTimeSlotAvailability(
  session: ISession,
  shopInfo: ShopInfo,
  startTime: moment.Moment,
  endTime: moment.Moment
): Promise<boolean> {
  try {
    if (!session.selected_barber_id) {
      console.log("No barber selected for availability check");
      return false;
    }

    // Get service duration
    const service = await ServiceCatalog.findOne({
      service_key: session.selected_service,
      is_active: true,
    }).lean<IServiceCatalog | null>();

    if (!service) {
      console.log("Service not found for availability check");
      return false;
    }

    const serviceDuration = service.duration_min;
    const slotInterval = shopInfo.settings.slot_interval_min;

    // Generate potential time slots within the window
    const potentialSlots = generateTimeSlots(
      startTime,
      endTime,
      slotInterval,
      serviceDuration
    );

    if (potentialSlots.length === 0) {
      console.log("No potential slots generated");
      return false;
    }

    // Check for existing bookings that conflict with these slots
    const today = startTime.format("YYYY-MM-DD");
    const existingBookings = await Booking.find({
      shop_id: shopInfo.shop_id,
      barber_id: session.selected_barber_id,
      date: {
        $gte: new Date(today + "T00:00:00.000Z"),
        $lt: new Date(today + "T23:59:59.999Z"),
      },
      status: { $in: ["pending", "confirmed"] },
    }).lean();

    console.log(`Found ${existingBookings.length} existing bookings for today`);

    // Check if any potential slot is available
    for (const slot of potentialSlots) {
      const slotStart = moment(slot.start);
      const slotEnd = moment(slot.end);

      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = moment(booking.start_time, "HH:mm");
        const bookingEnd = moment(booking.end_time, "HH:mm");

        // Check for time overlap
        return slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart);
      });

      if (!hasConflict) {
        console.log(
          `Available slot found: ${slotStart.format(
            "HH:mm"
          )} - ${slotEnd.format("HH:mm")}`
        );
        return true;
      }
    }

    console.log("No available slots found in the time window");
    return false;
  } catch (error) {
    console.error("Error checking time slot availability:", error);
    return false;
  }
}

/**
 * Generate potential time slots within a time window
 */
function generateTimeSlots(
  startTime: moment.Moment,
  endTime: moment.Moment,
  slotInterval: number,
  serviceDuration: number
): Array<{ start: moment.Moment; end: moment.Moment }> {
  const slots: Array<{ start: moment.Moment; end: moment.Moment }> = [];
  const current = startTime.clone();

  while (
    current.clone().add(serviceDuration, "minutes").isSameOrBefore(endTime)
  ) {
    const slotStart = current.clone();
    const slotEnd = current.clone().add(serviceDuration, "minutes");

    slots.push({
      start: slotStart,
      end: slotEnd,
    });

    current.add(slotInterval, "minutes");
  }

  return slots;
}

/**
 * Handle time period selection
 */
async function handleTimePeriodSelection(
  messageContent: string,
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  try {
    console.log("Handling time period selection:", messageContent);

    // Extract time period from message
    let timePeriod = messageContent;
    if (messageContent.startsWith("time_")) {
      timePeriod = messageContent.replace("time_", "");
    }

    // Update session
    session.time_period_key = timePeriod;
    session.intent = "select_specific_time";
    session.updated_at_iso = new Date();
    await session.save();

    // Get available time slots for the selected period
    const timeSlots = await getAvailableTimeSlots(
      session,
      shopInfo,
      timePeriod
    );

    if (timeSlots.length === 0) {
      await sendWhatsAppMessage(
        session.user_phone,
        "Sorry, no time slots are available for the selected period. Please choose another time period."
      );
      return;
    }

    // Send time slot options
    const slotMessage = `Great! Here are the available time slots for ${getTimePeriodLabel(
      timePeriod
    )}:`;

    const slotButtons: ButtonOption[] = timeSlots.map((slot, index) => ({
      id: `slot_${slot.id}`,
      title: slot.title,
    }));

    await sendButtonMessage(session.user_phone, slotMessage, slotButtons);
  } catch (error) {
    console.error("Error handling time period selection:", error);
  }
}

/**
 * Get available time slots for a time period
 */
async function getAvailableTimeSlots(
  session: ISession,
  shopInfo: ShopInfo,
  timePeriod: string
): Promise<Array<{ id: string; title: string }>> {
  try {
    if (!session.selected_barber_id) {
      console.log("No barber selected for time slot generation");
      return [];
    }

    // Get service duration
    const service = await ServiceCatalog.findOne({
      service_key: session.selected_service,
      is_active: true,
    }).lean<IServiceCatalog | null>();

    if (!service) {
      console.log("Service not found for time slot generation");
      return [];
    }

    const serviceDuration = service.duration_min;
    const slotInterval = shopInfo.settings.slot_interval_min;
    const currentTime = moment().tz(shopInfo.timezone);

    // Define time window based on period
    let startTime: moment.Moment;
    let endTime: moment.Moment;

    switch (timePeriod) {
      case "immediate":
        startTime = currentTime.clone().add(15, "minutes"); // 15 min buffer
        endTime = currentTime.clone().add(2, "hours");
        break;
      case "evening":
        if (
          !shopInfo.settings.evening_start ||
          shopInfo.settings.evening_start.trim() === ""
        ) {
          console.log(
            "Evening time period not available: evening_start not configured"
          );
          return [];
        }
        const [eveningHour, eveningMinute] = shopInfo.settings.evening_start
          .split(":")
          .map(Number);
        startTime = currentTime
          .clone()
          .hour(eveningHour)
          .minute(eveningMinute)
          .seconds(0);
        endTime = currentTime
          .clone()
          .hour(shopInfo.settings.close_time.split(":")[0])
          .minute(shopInfo.settings.close_time.split(":")[1])
          .seconds(0);
        break;
      case "later_today":
        startTime = currentTime.clone().add(30, "minutes"); // 30 min buffer
        const [closeHour, closeMinute] = shopInfo.settings.close_time
          .split(":")
          .map(Number);
        endTime = currentTime
          .clone()
          .hour(closeHour)
          .minute(closeMinute)
          .seconds(0);
        break;
      default:
        console.log("Unknown time period:", timePeriod);
        return [];
    }

    // Generate potential time slots
    const potentialSlots = generateTimeSlots(
      startTime,
      endTime,
      slotInterval,
      serviceDuration
    );

    if (potentialSlots.length === 0) {
      console.log("No potential slots generated");
      return [];
    }

    // Get existing bookings for today
    const today = startTime.format("YYYY-MM-DD");
    const existingBookings = await Booking.find({
      shop_id: shopInfo.shop_id,
      barber_id: session.selected_barber_id,
      date: {
        $gte: new Date(today + "T00:00:00.000Z"),
        $lt: new Date(today + "T23:59:59.999Z"),
      },
      status: { $in: ["pending", "confirmed"] },
    }).lean();

    console.log(`Found ${existingBookings.length} existing bookings for today`);

    // Filter out conflicting slots
    const availableSlots: Array<{ id: string; title: string }> = [];

    for (
      let i = 0;
      i < potentialSlots.length && availableSlots.length < 5;
      i++
    ) {
      const slot = potentialSlots[i];
      const slotStart = moment(slot.start);
      const slotEnd = moment(slot.end);

      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = moment(booking.start_time, "HH:mm");
        const bookingEnd = moment(booking.end_time, "HH:mm");

        // Check for time overlap
        return slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart);
      });

      if (!hasConflict) {
        availableSlots.push({
          id: `slot_${i + 1}`,
          title: slotStart.format("h:mm A"),
        });
      }
    }

    console.log(`Generated ${availableSlots.length} available time slots`);
    return availableSlots;
  } catch (error) {
    console.error("Error getting available time slots:", error);
    return [];
  }
}

/**
 * Get time period label
 */
function getTimePeriodLabel(timePeriod: string): string {
  const labels: Record<string, string> = {
    immediate: "immediate slots (next 2 hours)",
    evening: "this evening (6:00 PM onwards)",
    later_today: "later today (after evening)",
  };
  return labels[timePeriod] || timePeriod;
}

// Placeholder functions for other intents
async function handleSpecificTimeSelection(
  messageContent: string,
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for specific time selection
  console.log("Handling specific time selection:", messageContent);
}

async function handleListServices(
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for listing services
  console.log("Handling list services");
}

async function handleListBarbers(
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for listing barbers
  console.log("Handling list barbers");
}

async function handleBookAppointment(
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for booking appointment
  console.log("Handling book appointment");
}

async function handleCheckAvailability(
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for checking availability
  console.log("Handling check availability");
}

async function handleCancelBooking(
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for canceling booking
  console.log("Handling cancel booking");
}

async function handleReschedule(
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for rescheduling
  console.log("Handling reschedule");
}

async function handleGeneralInquiry(
  messageContent: string,
  session: ISession,
  shopInfo: ShopInfo
): Promise<void> {
  // Implementation for general inquiry
  console.log("Handling general inquiry:", messageContent);
}
