import mongoose, { Schema } from "mongoose";
import { ISession, SessionPhase, SessionIntent } from "../types/models";

const sessionSchema = new Schema<ISession>(
  {
    user_phone: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string): boolean {
          return /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: "Phone number must be in international format",
      },
    },
    shop_id: {
      type: String,
      required: true,
    },
    selected_service: {
      type: String,
      default: null,
    },
    first_prompt_id: {
      type: String,
      default: null,
    },
    last_prompt_id: {
      type: String,
      default: null,
    },
    phase: {
      type: String,
      enum: [
        "welcome",
        "service_selection",
        "barber_selection",
        "time_selection",
        "confirmation",
        "completed",
      ],
      default: "welcome",
    },
    phone_number_id: {
      type: String,
      default: null,
    },
    intent: {
      type: String,
      enum: [
        "first_message",
        "book_appointment",
        "check_availability",
        "list_services",
        "list_barbers",
        "cancel_booking",
        "reschedule",
        "general_inquiry",
        "select_service",
        "select_barber",
        "select_time_period",
        "select_specific_time",
        "booking_confirmed",
      ],
      default: null,
    },
    time_period_key: {
      type: String,
      default: null,
    },
    wa_context_id: {
      type: String,
      default: null,
    },
    updated_at_iso: {
      type: Date,
      default: Date.now,
    },
    selected_barber_id: {
      type: String,
      default: null,
    },
    selected_barber_name: {
      type: String,
      default: null,
    },
    booking_id: {
      type: String,
      default: null,
    },
    booking_code: {
      type: String,
      default: null,
    },
    // Additional fields for session management
    last_activity: {
      type: Date,
      default: Date.now,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    context_data: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
sessionSchema.index({ user_phone: 1, shop_id: 1 });
sessionSchema.index({ user_phone: 1, is_active: 1 });
sessionSchema.index({ updated_at_iso: 1 });

// Update last_activity on save
sessionSchema.pre("save", function (next) {
  this.last_activity = new Date();
  this.updated_at_iso = new Date();
  next();
});

export const Session =
  mongoose.models.Session || mongoose.model<ISession>("Session", sessionSchema);
