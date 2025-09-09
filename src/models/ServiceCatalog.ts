import mongoose, { Schema } from "mongoose";
import { IServiceCatalog } from "../types/models";

const serviceCatalogSchema = new Schema<IServiceCatalog>(
  {
    service_key: {
      type: String,
      required: true,
      unique: true,
    },
    label: {
      type: String,
      required: true,
    },
    duration_min: {
      type: Number,
      required: true,
      min: 5,
      max: 480, // 8 hours max
    },
    default_price: {
      type: Number,
      required: true,
      min: 0,
    },
    // Additional fields for service management
    description: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: "general",
    },
    is_active: {
      type: Boolean,
      default: true,
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

// Index for efficient queries (service_key is unique already)
serviceCatalogSchema.index({ is_active: 1, sort_order: 1 });

export const ServiceCatalog =
  mongoose.models.ServiceCatalog ||
  mongoose.model<IServiceCatalog>("ServiceCatalog", serviceCatalogSchema);
