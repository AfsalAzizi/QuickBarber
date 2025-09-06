const mongoose = require('mongoose');

const shopServiceOverrideSchema = new mongoose.Schema({
    shop_id: {
        type: String,
        required: true,
        index: true
    },
    service_key: {
        type: String,
        required: true,
        index: true
    },
    // Override fields
    custom_price: {
        type: Number,
        min: 0
    },
    custom_duration_min: {
        type: Number,
        min: 5,
        max: 480
    },
    custom_label: {
        type: String
    },
    is_available: {
        type: Boolean,
        default: true
    },
    // Additional fields
    notes: {
        type: String,
        default: null
    },
    valid_from: {
        type: Date,
        default: Date.now
    },
    valid_until: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
shopServiceOverrideSchema.index({ shop_id: 1, service_key: 1 }, { unique: true });
shopServiceOverrideSchema.index({ shop_id: 1, is_available: 1 });

module.exports = mongoose.model('ShopServiceOverride', shopServiceOverrideSchema);
