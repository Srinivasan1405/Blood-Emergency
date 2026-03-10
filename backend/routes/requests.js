/**
 * Blood Request Routes
 * POST /api/requests         - Submit a new blood request (public)
 * GET  /api/requests         - List all requests (admin)
 * GET  /api/requests/open    - List open requests (public)
 * GET  /api/requests/:id     - Get single request
 * PUT  /api/requests/:id     - Update request status (admin)
 * POST /api/requests/:id/respond - Donor responds to a request
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const BloodRequest = require('../models/BloodRequest');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { sendEmergencyAlerts } = require('../services/alertService');
const { findMatchingDonors } = require('../services/matchService');

//  POST /api/requests 
router.post(
  '/',
  optionalAuth, // Works for both guest and logged-in users
  [
      body('patientName').trim().notEmpty().withMessage('Patient name is required'),
      body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Valid blood group required'),
      body('unitsRequired').isInt({ min: 1, max: 20 }).withMessage('Units must be between 1 and 20'),
      body('urgency').optional().isIn(['critical', 'urgent', 'normal']),
      body('hospitalName').trim().notEmpty().withMessage('Hospital name is required'),
      body('hospitalCity').trim().notEmpty().withMessage('Hospital city is required'),
      body('contactPhone').trim()
          .matches(/^[+]?[\d\s-]{10,15}$/)
          .withMessage('Valid contact phone number is required'),
  ],
  async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const {
          patientName, bloodGroup, unitsRequired, urgency,
          hospitalName, hospitalAddress, hospitalCity,
          contactPhone, contactEmail, notes,
      } = req.body;

      try {
          // Check if hospital exists and is verified (optional check - still allows if not found)
          const hospital = await Hospital.findOne({
              name: { $regex: new RegExp('^' + hospitalName + '$', 'i') },
              city: hospitalCity.toLowerCase(),
              isActive: true,
          });

          if (hospital && !hospital.hasBloodBank) {
              console.log(`⚠️  Warning: Hospital "${hospitalName}" does not have a blood bank on record.`);
          }

          const bloodRequest = await BloodRequest.create({
              patientName,
              bloodGroup,
              unitsRequired,
              urgency: urgency || 'normal',
              hospital: {
                  name: hospitalName,
                  address: hospitalAddress,
                  city: hospitalCity.toLowerCase(),
              },
              contactPhone,
              contactEmail,
              notes,
              requestedBy: req.user?._id || null,
          });

          // Find matching donors and send alerts (async — don't wait for completion)
          const matchingDonors = await findMatchingDonors(bloodGroup, hospitalCity, { limit: 30 });

          if (matchingDonors.length > 0) {
              sendEmergencyAlerts(matchingDonors, bloodRequest)
                  .then(async (results) => {
                      await BloodRequest.findByIdAndUpdate(bloodRequest._id, { alertsSent: true });
                      console.log(`✅ Alerts dispatched for request ${bloodRequest._id}: ${results.emailsSent} emails, ${results.smsSent} SMS`);
                  })
                  .catch((err) => console.error('Alert send error:', err));
          }

          res.status(201).json({
              success: true,
              message: 'Blood request submitted successfully. Compatible donors have been alerted.',
              request: bloodRequest,
              matchingDonorsFound: matchingDonors.length,
          });
      } catch (error) {
          console.error('Create request error:', error);
          res.status(500).json({ success: false, message: 'Server error creating request.' });
      }
  }
);

//  GET /api/requests/open 
router.get('/open', async (req, res) => {
  try {
      const { bloodGroup, city, urgency } = req.query;
      const query = { status: { $in: ['pending', 'in-progress'] } };

      if (bloodGroup) query.bloodGroup = bloodGroup;
      if (city) query['hospital.city'] = new RegExp(city.trim(), 'i');
      if (urgency) query.urgency = urgency;

      const requests = await BloodRequest.find(query)
          .sort({ urgency: 1, createdAt: -1 }) // critical first
          .limit(50)
          .populate('requestedBy', 'name');

      // Sort urgency manually: critical > urgent > normal
      const urgencyOrder = { critical: 0, urgent: 1, normal: 2 };
      requests.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

      res.json({ success: true, count: requests.length, requests });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  GET /api/requests 
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
      const { status, bloodGroup, page = 1, limit = 20 } = req.query;
      const query = {};

      if (status) query.status = status;
      if (bloodGroup) query.bloodGroup = bloodGroup;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await BloodRequest.countDocuments(query);
      const requests = await BloodRequest.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('requestedBy', 'name email');

      res.json({ success: true, total, page: parseInt(page), requests });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  GET /api/requests/:id 
router.get('/:id', async (req, res) => {
  try {
      const request = await BloodRequest.findById(req.params.id)
          .populate('requestedBy', 'name email')
          .populate('respondedDonors.donor', 'name bloodGroup phone');

      if (!request) {
          return res.status(404).json({ success: false, message: 'Request not found.' });
      }

      res.json({ success: true, request });
  } catch (error) {
      if (error.name === 'CastError') {
          return res.status(400).json({ success: false, message: 'Invalid request ID.' });
      }
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  PUT /api/requests/:id 
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
      const { status, unitsFulfilled, notes } = req.body;

      const updateData = {};
      if (status) updateData.status = status;
      if (unitsFulfilled !== undefined) updateData.unitsFulfilled = unitsFulfilled;
      if (notes) updateData.notes = notes;
      if (status === 'fulfilled') updateData.fulfilledAt = new Date();

      const request = await BloodRequest.findByIdAndUpdate(
          req.params.id,
          { $set: updateData },
          { new: true, runValidators: true }
      );

      if (!request) {
          return res.status(404).json({ success: false, message: 'Request not found.' });
      }

      res.json({ success: true, message: 'Request updated.', request });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  POST /api/requests/:id/respond 
router.post('/:id/respond', protect, authorize('donor'), async (req, res) => {
  try {
      const request = await BloodRequest.findById(req.params.id);

      if (!request) {
          return res.status(404).json({ success: false, message: 'Request not found.' });
      }

      if (!['pending', 'in-progress'].includes(request.status)) {
          return res.status(400).json({ success: false, message: 'This request is no longer active.' });
      }

      // Check if donor already responded
      const alreadyResponded = request.respondedDonors.some(
          (r) => r.donor.toString() === req.user._id.toString()
      );

      if (alreadyResponded) {
          return res.status(400).json({ success: false, message: 'You have already responded to this request.' });
      }

      // Check donation eligibility (3-month rule)
      if (req.user.lastDonationDate) {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          
          if (req.user.lastDonationDate > threeMonthsAgo) {
              return res.status(400).json({ 
                  success: false, 
                  message: 'You must wait 3 months after your last donation to donate again.' 
              });
          }
      }

      // Add donor to responded list and update status
      request.respondedDonors.push({ donor: req.user._id });
      if (request.status === 'pending') request.status = 'in-progress';
      await request.save();

      res.json({
          success: true,
          message: 'Thank you for responding! Please contact the hospital directly.',
          hospitalPhone: request.contactPhone,
          hospitalName: request.hospital.name,
      });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
