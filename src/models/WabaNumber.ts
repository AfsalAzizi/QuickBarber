import mongoose, { Schema } from "mongoose";
import { IWabaNumber } from "@/types/models";

const wabaNumberSchema = new Schema<IWabaNumber>(
  {
    phone_number_id: {
      type: String,
      required: true,
      unique: true,
    },
    display_phone_number: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string): boolean {
          return /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: "Display phone number must be in international format",
      },
    },
    shop_id: {
      type: String,
      required: true,
    },
    sheet_id: {
      type: String,
      default: null,
    },
    calendar_id: {
      type: String,
      default: null,
    },
    timezone: {
      type: String,
      required: true,
      default: "Asia/Kolkata",
    },
    welcome_template: {
      type: String,
      default: null,
    },
    // Additional fields for WhatsApp Business API
    is_active: {
      type: Boolean,
      default: true,
    },
    webhook_url: {
      type: String,
      default: null,
    },
    access_token: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes with error handling
wabaNumberSchema.index({ phone_number_id: 1 }, { background: true });
wabaNumberSchema.index({ shop_id: 1 }, { background: true });
wabaNumberSchema.index({ display_phone_number: 1 }, { background: true });

export const WabaNumber =
  mongoose.models.WabaNumber ||
  mongoose.model<IWabaNumber>("WabaNumber", wabaNumberSchema, "wabanumbers");
