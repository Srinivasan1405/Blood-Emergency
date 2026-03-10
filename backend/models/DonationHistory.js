/**
 * DonationHistory Model
 * Tracks completed and ongoing blood donations
 */

const mongoose = require('mongoose');

const donationHistorySchema = new mongoose.Schema(
    {
        donor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Donor reference is required'],
        },
        request: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BloodRequest',
            default: null, // Can be null for voluntary donations not tied to a request
        },
        donationDate: {
            type: Date,
            required: [true, 'Donation date is required'],
            default: Date.now,
        },
        bloodGroup: {
            type: String,
            required: true,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        },
        unitsDoanted: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            default: 1,
        },
        hospital: {
            name: { type: String, required: true, trim: true },
            city: { type: String, trim: true, lowercase: true },
        },
        status: {
            type: String,
            enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
            default: 'scheduled',
        },
        // Certificate or acknowledgement ID
        certificateId: {
            type: String,
            unique: true,
            sparse: true, // Only unique when not null
        },
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

//  Indexes 
donationHistorySchema.index({ donor: 1, donationDate: -1 });
donationHistorySchema.index({ status: 1 });

//  Pre-save: Generate certificate ID on completion 
donationHistorySchema.pre('save', function (next) {
    if (this.status === 'completed' && !this.certificateId) {
        // Format: CERT-YYYYMMDD-RANDOM6CHARS
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.certificateId = `CERT-${date}-${random}`;
    }
    next();
});

module.exports = mongoose.model('DonationHistory', donationHistorySchema);
