import mongoose, { Schema } from "mongoose";

const errorLogSchema = new Schema(
  {
    name: { type: String },
    message: { type: String },
    stack: { type: String },
    context: { type: Schema.Types.Mixed },
    session: { type: Schema.Types.Mixed },
    shop_id: { type: String },
    user_phone: { type: String },
    intent: { type: String },
    phase: { type: String },
    occurred_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

errorLogSchema.index({ occurred_at: -1 });
errorLogSchema.index({ shop_id: 1, user_phone: 1, occurred_at: -1 });

export const ErrorLog =
  mongoose.models.ErrorLog || mongoose.model("ErrorLog", errorLogSchema);
