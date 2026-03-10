/**
 * BloodRequest Model
 * Tracks blood donation requests with urgency levels and status
 */

const mongoose = require('mongoose');

const bloodRequestSchema = new mongoose.Schema(
    {
        patientName: {
            type: String,
            required: [true, 'Patient name is required'],
            trim: true,
        },
        bloodGroup: {
            type: String,
            required: [true, 'Blood group is required'],
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        },
        unitsRequired: {
            type: Number,
            required: [true, 'Units required is required'],
            min: [1, 'At least 1 unit is required'],
            max: [20, 'Cannot request more than 20 units at once'],
        },
        urgency: {
            type: String,
            enum: ['critical', 'urgent', 'normal'],
            default: 'normal',
            required: true,
        },
        hospital: {
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
                required: [true, 'City is required'],
                trim: true,
                lowercase: true,
            },
        },
        contactPhone: {
            type: String,
            required: [true, 'Contact phone is required'],
            trim: true,
        },
        contactEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },
        status: {
            type: String,
            enum: ['pending', 'in-progress', 'fulfilled', 'cancelled'],
            default: 'pending',
        },
        // The user who made the request (can be null for anonymous requests)
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        // Donors who responded to this request
        respondedDonors: [
            {
                donor: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                respondedAt: {
                    type: Date,
                    default: Date.now,
                },
                confirmed: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        // Additional notes
        notes: {
            type: String,
            trim: true,
            maxlength: [500, 'Notes cannot exceed 500 characters'],
        },
        // When the request was fulfilled
        fulfilledAt: {
            type: Date,
            default: null,
        },
        // How many units have been fulfilled so far
        unitsFulfilled: {
            type: Number,
            default: 0,
        },
        // Whether alerts were sent for this request
        alertsSent: {
            type: Boolean,
            default: false,
        },
        // Auto-expire requests after 7 days
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    },
    {
        timestamps: true,
    }
);

//  Indexes 
bloodRequestSchema.index({ status: 1, urgency: 1 });
bloodRequestSchema.index({ bloodGroup: 1, 'hospital.city': 1 });
bloodRequestSchema.index({ createdAt: -1 });
bloodRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

//  Virtual: Is this request still open? 
bloodRequestSchema.virtual('isOpen').get(function () {
    return ['pending', 'in-progress'].includes(this.status);
});

//  Virtual: Units remaining 
bloodRequestSchema.virtual('unitsRemaining').get(function () {
    return Math.max(0, this.unitsRequired - this.unitsFulfilled);
});

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
