const mongoose = require('mongoose');

const serviceCatalogSchema = new mongoose.Schema({
    service_key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    label: {
        type: String,
        required: true
    },
    duration_min: {
        type: Number,
        required: true,
        min: 5,
        max: 480 // 8 hours max
    },
    default_price: {
        type: Number,
        required: true,
        min: 0
    },
    // Additional fields for service management
    description: {
        type: String,
        default: null
    },
    category: {
        type: String,
        default: 'general'
    },
    is_active: {
        type: Boolean,
        default: true
    },
    sort_order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for efficient queries
serviceCatalogSchema.index({ service_key: 1 });
serviceCatalogSchema.index({ is_active: 1, sort_order: 1 });

module.exports = mongoose.model('ServiceCatalog', serviceCatalogSchema);
