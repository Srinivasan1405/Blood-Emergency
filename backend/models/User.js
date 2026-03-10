/**
 * User Model (Donors & Admins)
 * Handles authentication and donor profile information
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false,
            validate: {
                validator: function(v) {
                    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(v);
                },
                message: 'Password must contain uppercase, lowercase, number and special character'
            }
        },
        role: {
            type: String,
            enum: ['donor', 'admin'],
            default: 'donor',
        },
        bloodGroup: {
            type: String,
            enum: BLOOD_GROUPS,
            required: function () {
                return this.role === 'donor';
            },
        },
        phone: {
            type: String,
            trim: true,
        },
        location: {
            city: {
                type: String,
                trim: true,
                lowercase: true,
            },
            state: {
                type: String,
                trim: true,
                lowercase: true,
            },
            address: {
                type: String,
                trim: true,
            },
        },
        // Whether the donor is currently available to donate
        isAvailable: {
            type: Boolean,
            default: true,
        },
        // Date of last donation (helps enforce 3-month gap rule)
        lastDonationDate: {
            type: Date,
            default: null,
        },
        totalDonations: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Profile completion percentage
        profileComplete: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
    }
);

// Indexes
userSchema.index({ bloodGroup: 1, 'location.city': 1 });
userSchema.index({ email: 1 });
userSchema.index({ isAvailable: 1, isActive: 1 });
userSchema.index({ role: 1 });

// Pre-save: hash password
userSchema.pre('save', async function (next) {
    // Only hash if password was modified
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);

        // Check if profile is complete
        this.profileComplete = !!(
            this.name &&
            this.email &&
            this.bloodGroup &&
            this.phone &&
            this.location?.city
        );

        next();
    } catch (error) {
        next(error);
    }
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Check if donor can donate
userSchema.methods.canDonate = function () {
    if (!this.lastDonationDate) return true;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return this.lastDonationDate <= threeMonthsAgo;
};

// Virtual: full location
userSchema.virtual('fullLocation').get(function () {
    const parts = [this.location?.city, this.location?.state].filter(Boolean);
    return parts.join(', ');
});

// Find compatible donors
userSchema.statics.findCompatibleDonors = async function (bloodGroup, city) {
    // Blood group compatibility mapping (who can receive from whom)
    const compatibility = {
        'O-': ['O-'],
        'O+': ['O-', 'O+'],
        'A-': ['O-', 'A-'],
        'A+': ['O-', 'O+', 'A-', 'A+'],
        'B-': ['O-', 'B-'],
        'B+': ['O-', 'O+', 'B-', 'B+'],
        'AB-': ['O-', 'A-', 'B-', 'AB-'],
        'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    };

    const compatibleGroups = compatibility[bloodGroup] || [bloodGroup];

    const query = {
        role: 'donor',
        isAvailable: true,
        isActive: true,
        bloodGroup: { $in: compatibleGroups },
    };

    if (city) {
        query['location.city'] = new RegExp(city, 'i');
    }

    return this.find(query)
        .select('-password')
        .sort({ lastDonationDate: 1, totalDonations: -1 });
};

module.exports = mongoose.model('User', userSchema);
