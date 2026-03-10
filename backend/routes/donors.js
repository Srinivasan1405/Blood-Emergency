/**
 * Donor Routes
 * GET  /api/donors/search     - Search donors by blood group & city (public)
 * GET  /api/donors/stats      - Blood group availability statistics
 * GET  /api/donors/:id        - Get donor public profile
 * PUT  /api/donors/:id        - Update own donor profile (authenticated)
 * PUT  /api/donors/:id/availability - Toggle availability
 * GET  /api/donors/:id/history - Donation history
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');

const User = require('../models/User');
const DonationHistory = require('../models/DonationHistory');
const { protect, authorize } = require('../middleware/auth');
const { findMatchingDonors, getBloodGroupStats } = require('../services/matchService');

//  GET /api/donors/search 
router.get('/search', async (req, res) => {
  try {
      const { bloodGroup, city, page = 1, limit = 12 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

      const query = {
          role: 'donor',
          isAvailable: true,
          isActive: true,
      };

      if (bloodGroup) {
          if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodGroup)) {
              return res.status(400).json({ success: false, message: 'Invalid blood group.' });
          }
          query.bloodGroup = bloodGroup;
      }

      if (city) {
          query['location.city'] = new RegExp(city.trim(), 'i');
      }

      const skip = (pageNum - 1) * limitNum;
      const total = await User.countDocuments(query);
      const donors = await User.find(query)
          .select('name bloodGroup location phone totalDonations isAvailable lastDonationDate createdAt')
          .sort({ totalDonations: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum);

      res.json({
          success: true,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
          donors,
      });
  } catch (error) {
      console.error('Donor search error:', error);
      res.status(500).json({ success: false, message: 'Server error searching donors.' });
  }
});

//  GET /api/donors/stats 
router.get('/stats', async (req, res) => {
  try {
      const { city } = req.query;
      const stats = await getBloodGroupStats(city);
      res.json({ success: true, stats, city: city || 'all cities' });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching stats.' });
  }
});

//  GET /api/donors/:id 
router.get('/:id', async (req, res) => {
  try {
      const donor = await User.findOne({
          _id: req.params.id,
          role: 'donor',
          isActive: true,
      }).select('-password -email'); // Hide email for privacy on public profile

      if (!donor) {
          return res.status(404).json({ success: false, message: 'Donor not found.' });
      }

      res.json({ success: true, donor });
  } catch (error) {
      // Handle invalid MongoDB ObjectId
      if (error.name === 'CastError') {
          return res.status(400).json({ success: false, message: 'Invalid donor ID.' });
      }
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  PUT /api/donors/:id 
router.put(
  '/:id',
  protect,
  [
      body('name').optional().trim().notEmpty(),
      body('phone').optional().trim(),
      body('city').optional().trim(),
      body('state').optional().trim(),
      body('address').optional().trim(),
  ],
  async (req, res) => {
      // Users can only update their own profile; admins can update any
      if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Not authorized.' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      try {
          const allowedFields = ['name', 'phone'];
          const updateData = {};

          allowedFields.forEach((field) => {
              if (req.body[field] !== undefined) updateData[field] = req.body[field];
          });

          if (req.body.city) updateData['location.city'] = req.body.city.toLowerCase();
          if (req.body.state) updateData['location.state'] = req.body.state.toLowerCase();
          if (req.body.address) updateData['location.address'] = req.body.address;

          const updated = await User.findByIdAndUpdate(
              req.params.id,
              { $set: updateData },
              { new: true, runValidators: true }
          ).select('-password');

          if (!updated) {
              return res.status(404).json({ success: false, message: 'User not found.' });
          }

          res.json({ success: true, message: 'Profile updated.', user: updated });
      } catch (error) {
          console.error('Update donor error:', error);
          res.status(500).json({ success: false, message: 'Server error.' });
      }
  }
);

//  PUT /api/donors/:id/availability 
router.put('/:id/availability', protect, async (req, res) => {
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  try {
      const { isAvailable } = req.body;
      const user = await User.findByIdAndUpdate(
          req.params.id,
          { isAvailable: Boolean(isAvailable) },
          { new: true }
      ).select('-password');

      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      res.json({
          success: true,
          message: `Availability set to ${user.isAvailable ? 'available' : 'unavailable'}.`,
          isAvailable: user.isAvailable,
      });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  GET /api/donors/:id/history 
router.get('/:id/history', protect, async (req, res) => {
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
  }

  try {
      const history = await DonationHistory.find({ donor: req.params.id })
          .populate('request', 'patientName bloodGroup hospital urgency')
          .sort({ donationDate: -1 });

      res.json({ success: true, count: history.length, history });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
