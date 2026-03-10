/**
 * Hospital Model
 * Stores hospital information including blood bank availability
 */

const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Hospital name is required'],
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        state: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        hasBloodBank: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // GPS coordinates for location-based matching
        coordinates: {
            lat: Number,
            lng: Number,
        },
    },
    {
        timestamps: true,
    }
);

hospitalSchema.index({ city: 1 });

module.exports = mongoose.model('Hospital', hospitalSchema);
