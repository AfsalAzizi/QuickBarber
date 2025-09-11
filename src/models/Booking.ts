import mongoose, { Schema } from "mongoose";
import { IBooking, BookingStatus, PaymentStatus } from "../types/models";

const bookingSchema = new Schema<IBooking>(
  {
    booking_id: {
      type: String,
      required: true,
      unique: true,
    },
    booking_code: {
      type: String,
      required: true,
      unique: true,
    },
    shop_id: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    start_time: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string): boolean {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Start time must be in HH:MM format",
      },
    },
    end_time: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string): boolean {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "End time must be in HH:MM format",
      },
    },
    service_key: {
      type: String,
      required: true,
    },
    customer_phone: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string): boolean {
          return /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: "Customer phone must be in international format",
      },
    },
    barber_id: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
        "rescheduled",
      ],
      default: "pending",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    // Additional fields for booking management
    customer_name: {
      type: String,
      default: null,
    },
    customer_email: {
      type: String,
      default: null,
      validate: {
        validator: function (v: string): boolean {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email format",
      },
    },
    notes: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      min: 0,
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid", "refunded", "partial"],
      default: "pending",
    },
    reminder_sent: {
      type: Boolean,
      default: false,
    },
    confirmation_sent: {
      type: Boolean,
      default: false,
    },
    // WhatsApp specific fields
    wa_message_id: {
      type: String,
      default: null,
    },
    wa_context_id: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
bookingSchema.index({ shop_id: 1, date: 1, status: 1 });
bookingSchema.index({ barber_id: 1, date: 1, status: 1 });
bookingSchema.index({ customer_phone: 1, status: 1 });
bookingSchema.index({ created_at: 1 });

// Generate a unique 6-char alphanumeric booking_code before validation
bookingSchema.pre("validate", async function (next) {
  try {
    if (!this.booking_code) {
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
      const gen = () =>
        Array.from({ length: 6 })
          .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
          .join("");

      let code = gen();
      // Ensure uniqueness
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Model: any = this.constructor;
      // Try a few times to avoid rare collisions
      for (let i = 0; i < 5; i++) {
        const exists = await Model.exists({ booking_code: code });
        if (!exists) break;
        code = gen();
      }
      this.booking_code = code;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

export const Booking =
  mongoose.models.Booking || mongoose.model<IBooking>("Booking", bookingSchema);
