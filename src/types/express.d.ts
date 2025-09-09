import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: {
        id: string;
        phone: string;
        shopId: string;
      };
      session?: {
        id: string;
        userPhone: string;
        shopId: string;
        intent: string;
        phase: string;
      };
    }
  }
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "interactive" | "button";
  text?: {
    body: string;
  };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    text: string;
    payload: string;
  };
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      messages?: WhatsAppMessage[];
      statuses?: Array<{
        id: string;
        status: "sent" | "delivered" | "read" | "failed";
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

export interface WhatsAppWebhookData {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

export interface SessionData {
  userPhone: string;
  shopId: string;
  selectedService?: string;
  selectedBarberId?: string;
  selectedBarberName?: string;
  intent:
    | "first_message"
    | "select_service"
    | "select_barber"
    | "select_time_period"
    | "select_specific_time";
  phase: string;
  phoneNumberId: string;
  timePeriodKey?: string;
  waContextId?: string;
  bookingId?: string;
  bookingCode?: string;
  updatedAtIso?: string;
}

export interface ServiceOption {
  id: string;
  title: string;
  description?: string;
}

export interface BarberOption {
  id: string;
  title: string;
  description?: string;
}

export interface TimeSlot {
  id: string;
  title: string;
  description?: string;
  available: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  environment: string;
  database: {
    state: number;
    stateName: string;
    connected: boolean;
  };
  uptime: number;
  memory: NodeJS.MemoryUsage;
}

export interface DatabaseHealthResponse {
  connected: boolean;
  collections: string[];
  models: Array<{
    name: string;
    count: number;
    collectionName: string;
    status: string;
    error?: any;
  }>;
  environment: {
    mongodbUri: boolean;
    nodeEnv: string;
  };
  timestamp: string;
  status?: string;
  message?: string;
}
