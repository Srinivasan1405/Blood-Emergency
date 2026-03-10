/**
 * Admin Seed Script
 * Run once to create the initial admin user
 * Usage: node utils/seedAdmin.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });

        if (existingAdmin) {
            console.log(`ℹ️  Admin already exists: ${existingAdmin.email}`);
            process.exit(0);
        }

        const admin = await User.create({
            name: process.env.ADMIN_NAME || 'System Admin',
            email: process.env.ADMIN_EMAIL || 'admin@bloodemergency.com',
            password: process.env.ADMIN_PASSWORD || 'Admin@1234',
            role: 'admin',
            isActive: true,
        });

        console.log(`✅ Admin created successfully!`);
        console.log(`   Email:    ${admin.email}`);
        console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@1234'}`);
        console.log(`   ID:       ${admin._id}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error.message);
        process.exit(1);
    }
};

seedAdmin();
