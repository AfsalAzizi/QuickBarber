import { Document, Types } from "mongoose";

// Base document interface
export interface BaseDocument extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Settings model types
export interface ISettings extends BaseDocument {
  shop_id: string;
  shop_name: string;
  time_zone: string;
  start_time: string;
  close_time: string;
  lunch_start: string;
  lunch_end: string;
  evening_start: string;
  slot_interval_min: number;
  barbers_count: number;
}

// Session model types
export type SessionPhase =
  | "welcome"
  | "service_selection"
  | "barber_selection"
  | "time_selection"
  | "confirmation"
  | "completed";
export type SessionIntent =
  | "first_message"
  | "book_appointment"
  | "check_availability"
  | "list_services"
  | "list_barbers"
  | "cancel_booking"
  | "reschedule"
  | "general_inquiry"
  | "select_service"
  | "select_barber"
  | "select_time_period"
  | "select_specific_time"
  | "booking_confirmed";

export interface ISession extends BaseDocument {
  user_phone: string;
  shop_id: string;
  selected_service?: string;
  first_prompt_id?: string;
  last_prompt_id?: string;
  phase: SessionPhase;
  phone_number_id?: string;
  intent?: SessionIntent;
  time_period_key?: string;
  wa_context_id?: string;
  updated_at_iso: Date;
  selected_barber_id?: string;
  selected_barber_name?: string;
  booking_id?: string;
  booking_code?: string;
  last_activity: Date;
  is_active: boolean;
  context_data: Record<string, any>;
}

// WabaNumber model types
export interface IWabaNumber extends BaseDocument {
  phone_number_id: string;
  display_phone_number: string;
  shop_id: string;
  sheet_id?: string;
  calendar_id?: string;
  timezone: string;
  welcome_template?: string;
  is_active: boolean;
  webhook_url?: string;
  access_token?: string;
}

// ServiceCatalog model types
export interface IServiceCatalog extends BaseDocument {
  service_key: string;
  label: string;
  duration_min: number;
  default_price: number;
  description?: string;
  category: string;
  is_active: boolean;
  sort_order: number;
}

// Barber model types
export interface IBarberWorkingHours {
  start: string;
  end: string;
  is_working: boolean;
}

export interface IBarber extends BaseDocument {
  barber_id: string;
  shop_id: string;
  name: string;
  active: boolean;
  notes?: string;
  phone?: string;
  email?: string;
  specialties: string[];
  working_hours: {
    monday: IBarberWorkingHours;
    tuesday: IBarberWorkingHours;
    wednesday: IBarberWorkingHours;
    thursday: IBarberWorkingHours;
    friday: IBarberWorkingHours;
    saturday: IBarberWorkingHours;
    sunday: IBarberWorkingHours;
  };
  sort_order: number;
}

// Booking model types
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";
export type PaymentStatus = "pending" | "paid" | "refunded" | "partial";

export interface IBooking extends BaseDocument {
  booking_id: string;
  booking_code: string;
  shop_id: string;
  date: Date;
  start_time: string;
  end_time: string;
  service_key: string;
  customer_phone: string;
  barber_id: string;
  status: BookingStatus;
  created_at: Date;
  customer_name?: string;
  customer_email?: string;
  notes?: string;
  price?: number;
  payment_status: PaymentStatus;
  reminder_sent: boolean;
  confirmation_sent: boolean;
  wa_message_id?: string;
  wa_context_id?: string;
}

// ShopServiceOverride model types (if exists)
export interface IShopServiceOverride extends BaseDocument {
  shop_id: string;
  service_key: string;
  price?: number;
  duration_min?: number;
  is_active: boolean;
  notes?: string;
}
