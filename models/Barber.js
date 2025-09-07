const mongoose = require('mongoose');

const barberSchema = new mongoose.Schema({
    barber_id: {
        type: String,
        required: true,
        unique: true
    },
    shop_id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    notes: {
        type: String,
        default: null
    },
    // Additional fields for barber management
    phone: {
        type: String,
        default: null,
        validate: {
            validator: function (v) {
                return !v || /^\+?[1-9]\d{1,14}$/.test(v);
            },
            message: 'Phone number must be in international format'
        }
    },
    email: {
        type: String,
        default: null,
        validate: {
            validator: function (v) {
                return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'Invalid email format'
        }
    },
    specialties: [{
        type: String
    }],
    working_hours: {
        monday: { start: String, end: String, is_working: { type: Boolean, default: true } },
        tuesday: { start: String, end: String, is_working: { type: Boolean, default: true } },
        wednesday: { start: String, end: String, is_working: { type: Boolean, default: true } },
        thursday: { start: String, end: String, is_working: { type: Boolean, default: true } },
        friday: { start: String, end: String, is_working: { type: Boolean, default: true } },
        saturday: { start: String, end: String, is_working: { type: Boolean, default: true } },
        sunday: { start: String, end: String, is_working: { type: Boolean, default: false } }
    },
    sort_order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for efficient queries
barberSchema.index({ barber_id: 1 });
barberSchema.index({ shop_id: 1, active: 1 });
barberSchema.index({ shop_id: 1, sort_order: 1 });

module.exports = mongoose.model('Barber', barberSchema);
