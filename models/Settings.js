const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    shop_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    shop_name: {
        type: String,
        required: true
    },
    time_zone: {
        type: String,
        required: true,
        default: 'Asia/Kolkata'
    },
    start_time: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Start time must be in HH:MM format'
        }
    },
    close_time: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Close time must be in HH:MM format'
        }
    },
    lunch_start: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Lunch start time must be in HH:MM format'
        }
    },
    lunch_end: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Lunch end time must be in HH:MM format'
        }
    },
    evening_start: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Evening start time must be in HH:MM format'
        }
    },
    slot_interval_min: {
        type: Number,
        required: true,
        min: 5,
        max: 60,
        default: 15
    },
    barbers_count: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    }
}, {
    timestamps: true
});

// Index for efficient queries
settingsSchema.index({ shop_id: 1 });

module.exports = mongoose.model('Settings', settingsSchema);
