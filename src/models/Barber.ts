import mongoose, { Schema } from "mongoose";
import { IBarber, IBarberWorkingHours } from "@/types/models";

const workingHoursSchema = new Schema<IBarberWorkingHours>(
  {
    start: String,
    end: String,
    is_working: { type: Boolean, default: true },
  },
  { _id: false }
);

const barberSchema = new Schema<IBarber>(
  {
    barber_id: {
      type: String,
      required: true,
      unique: true,
    },
    shop_id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: null,
    },
    // Additional fields for barber management
    phone: {
      type: String,
      default: null,
      validate: {
        validator: function (v: string): boolean {
          return !v || /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: "Phone number must be in international format",
      },
    },
    email: {
      type: String,
      default: null,
      validate: {
        validator: function (v: string): boolean {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email format",
      },
    },
    specialties: [
      {
        type: String,
      },
    ],
    working_hours: {
      monday: workingHoursSchema,
      tuesday: workingHoursSchema,
      wednesday: workingHoursSchema,
      thursday: workingHoursSchema,
      friday: workingHoursSchema,
      saturday: workingHoursSchema,
      sunday: workingHoursSchema,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
barberSchema.index({ barber_id: 1 });
barberSchema.index({ shop_id: 1, active: 1 });
barberSchema.index({ shop_id: 1, sort_order: 1 });

export const Barber =
  mongoose.models.Barber || mongoose.model<IBarber>("Barber", barberSchema);
