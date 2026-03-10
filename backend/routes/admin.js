/**
 * Admin Routes
 * GET  /api/admin/dashboard   - Dashboard statistics
 * GET  /api/admin/users       - List all users (with filters)
 * PUT  /api/admin/users/:id   - Update user role or active status
 * DELETE /api/admin/users/:id - Deactivate a user account
 * POST /api/admin/alerts      - Send broadcast emergency alert
 * GET  /api/admin/donations   - All donation history records
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
const DonationHistory = require('../models/DonationHistory');
const BloodStock = require('../models/BloodStock');
const { protect, authorize } = require('../middleware/auth');
const { sendEmailAlert, sendSMSAlert } = require('../services/alertService');

// All admin routes require authentication + admin role
router.use(protect, authorize('admin'));

//  GET /api/admin/dashboard 
router.get('/dashboard', async (req, res) => {
  try {
      const [
          totalDonors,
          activeDonors,
          totalAdmins,
          totalRequests,
          pendingRequests,
          fulfilledRequests,
          criticalRequests,
          totalDonations,
      ] = await Promise.all([
          User.countDocuments({ role: 'donor', isActive: true }),
          User.countDocuments({ role: 'donor', isActive: true, isAvailable: true }),
          User.countDocuments({ role: 'admin' }),
          BloodRequest.countDocuments(),
          BloodRequest.countDocuments({ status: 'pending' }),
          BloodRequest.countDocuments({ status: 'fulfilled' }),
          BloodRequest.countDocuments({ status: { $in: ['pending', 'in-progress'] }, urgency: 'critical' }),
          DonationHistory.countDocuments({ status: 'completed' }),
      ]);

      // Blood group distribution among donors
      const bloodGroupStats = await User.aggregate([
          { $match: { role: 'donor', isActive: true } },
          { $group: { _id: '$bloodGroup', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
      ]);

      // Recent activity
      const recentRequests = await BloodRequest.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select('patientName bloodGroup urgency status hospital createdAt');

      const recentDonors = await User.find({ role: 'donor' })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('name bloodGroup location createdAt');

      res.json({
          success: true,
          stats: {
              donors: { total: totalDonors, active: activeDonors },
              admins: totalAdmins,
              requests: {
                  total: totalRequests,
                  pending: pendingRequests,
                  fulfilled: fulfilledRequests,
                  critical: criticalRequests,
              },
              donations: totalDonations,
              fulfillmentRate: totalRequests > 0
                  ? Math.round((fulfilledRequests / totalRequests) * 100)
                  : 0,
          },
          bloodGroupStats,
          recentRequests,
          recentDonors,
      });
  } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  GET /api/admin/users 
router.get('/users', async (req, res) => {
  try {
      const { role, bloodGroup, city, isActive, page = 1, limit = 20, search } = req.query;

      const query = {};
      if (role) query.role = role;
      if (bloodGroup) query.bloodGroup = bloodGroup;
      if (city) query['location.city'] = new RegExp(city.trim(), 'i');
      if (isActive !== undefined) query.isActive = isActive === 'true';
      if (search) {
          query.$or = [
              { name: new RegExp(search, 'i') },
              { email: new RegExp(search, 'i') },
          ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await User.countDocuments(query);
      const users = await User.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit));

      res.json({ success: true, total, page: parseInt(page), users });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  PUT /api/admin/users/:id 
router.put('/users/:id', async (req, res) => {
  try {
      const { role, isActive, isAvailable } = req.body;

      // Prevent admin from demoting themselves
      if (req.params.id === req.user._id.toString() && role && role !== 'admin') {
          return res.status(400).json({ success: false, message: 'Cannot change your own admin role.' });
      }

      const updateData = {};
      if (role && ['donor', 'admin'].includes(role)) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);

      const user = await User.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true }).select('-password');

      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      res.json({ success: true, message: 'User updated.', user });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  DELETE /api/admin/users/:id 
router.delete('/users/:id', async (req, res) => {
  try {
      if (req.params.id === req.user._id.toString()) {
          return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' });
      }

      const user = await User.findByIdAndUpdate(
          req.params.id,
          { isActive: false },
          { new: true }
      ).select('-password');

      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      res.json({ success: true, message: `User "${user.name}" deactivated.` });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  POST /api/admin/alerts 
router.post(
  '/alerts',
  [
      body('subject').trim().notEmpty().withMessage('Alert subject is required'),
      body('message').trim().notEmpty().withMessage('Alert message is required'),
      body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
      body('city').optional().trim(),
  ],
  async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { subject, message, bloodGroup, city, sendSMS } = req.body;

      try {
          // Find target donors
          const query = { role: 'donor', isActive: true };
          if (bloodGroup) query.bloodGroup = bloodGroup;
          if (city) query['location.city'] = new RegExp(city.trim(), 'i');

          const donors = await User.find(query).select('name email phone');

          if (donors.length === 0) {
              return res.status(404).json({ success: false, message: 'No donors found matching criteria.' });
          }

          let emailsSent = 0;
          let smsSent = 0;
          const errors_list = [];

          for (const donor of donors) {
              try {
                  if (donor.email) {
                      await sendEmailAlert({
                          to: donor.email,
                          subject,
                          text: message,
                          html: `<div style="font-family: Arial; padding: 20px; background: #fff8f8; border-left: 4px solid #e53e3e;">
              <h2 style="color: #e53e3e;">🩸 ${subject}</h2>
              <p>Dear ${donor.name},</p>
              <p>${message}</p>
              <hr>
              <p style="font-size: 12px; color: #888;">Blood Emergency Website</p>
            </div>`,
                      });
                      emailsSent++;
                  }

                  if (sendSMS && donor.phone) {
                      await sendSMSAlert(donor.phone, `${subject}: ${message}`);
                      smsSent++;
                  }
              } catch (err) {
                  errors_list.push({ donor: donor.email, error: err.message });
              }
          }

          res.json({
              success: true,
              message: `Alerts sent to ${donors.length} donors.`,
              emailsSent,
              smsSent,
              targetDonors: donors.length,
              errors: errors_list,
          });
      } catch (error) {
          res.status(500).json({ success: false, message: 'Server error sending alerts.' });
      }
  }
);

//  GET /api/admin/donations 
router.get('/donations', async (req, res) => {
  try {
      const { status, page = 1, limit = 20 } = req.query;
      const query = {};
      if (status) query.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await DonationHistory.countDocuments(query);
      const donations = await DonationHistory.find(query)
          .populate('donor', 'name email bloodGroup')
          .populate('request', 'patientName bloodGroup hospital')
          .sort({ donationDate: -1 })
          .skip(skip)
          .limit(parseInt(limit));

      res.json({ success: true, total, donations });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
