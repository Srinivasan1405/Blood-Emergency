/**
 * BloodStock Model
 * Tracks blood inventory per hospital and blood group
 */

const mongoose = require('mongoose');

const bloodStockSchema = new mongoose.Schema(
    {
        hospital: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hospital',
            required: true,
        },
        bloodGroup: {
            type: String,
            required: true,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        },
        unitsAvailable: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        // Threshold below which an alert should be sent
        criticalThreshold: {
            type: Number,
            default: 5,
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

//  Compound index: one stock record per blood group per hospital 
bloodStockSchema.index({ hospital: 1, bloodGroup: 1 }, { unique: true });

//  Virtual: Is stock critically low? 
bloodStockSchema.virtual('isCritical').get(function () {
    return this.unitsAvailable <= this.criticalThreshold;
});

module.exports = mongoose.model('BloodStock', bloodStockSchema);
