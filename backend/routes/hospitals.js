/**
 * Hospital Routes
 * GET  /api/hospitals          - List hospitals
 * GET  /api/hospitals/:id      - Get single hospital
 * POST /api/hospitals          - Add hospital (admin only)
 * GET  /api/hospitals/:id/stock - Get blood stock for hospital
 * PUT  /api/hospitals/:id/stock - Update blood stock (admin only)
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const Hospital = require('../models/Hospital');
const BloodStock = require('../models/BloodStock');
const { protect, authorize } = require('../middleware/auth');

//  GET /api/hospitals 
router.get('/', async (req, res) => {
  try {
      const { city, hasBloodBank } = req.query;
      const query = { isActive: true };

      if (city) query.city = new RegExp(city.trim(), 'i');
      if (hasBloodBank !== undefined) query.hasBloodBank = hasBloodBank === 'true';

      const hospitals = await Hospital.find(query).sort({ name: 1 });
      res.json({ success: true, count: hospitals.length, hospitals });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  GET /api/hospitals/:id 
router.get('/:id', async (req, res) => {
  try {
      const hospital = await Hospital.findById(req.params.id);
      if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found.' });
      res.json({ success: true, hospital });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  POST /api/hospitals 
router.post(
  '/',
  protect,
  authorize('admin'),
  [
      body('name').trim().notEmpty().withMessage('Hospital name required'),
      body('city').trim().notEmpty().withMessage('City required'),
  ],
  async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
          const hospital = await Hospital.create(req.body);
          res.status(201).json({ success: true, hospital });
      } catch (error) {
          res.status(500).json({ success: false, message: 'Server error.' });
      }
  }
);

//  GET /api/hospitals/:id/stock 
router.get('/:id/stock', async (req, res) => {
  try {
      const stock = await BloodStock.find({ hospital: req.params.id }).sort({ bloodGroup: 1 });
      res.json({ success: true, hospitalId: req.params.id, stock });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  PUT /api/hospitals/:id/stock 
router.put('/:id/stock', protect, authorize('admin'), async (req, res) => {
  try {
      const { bloodGroup, unitsAvailable } = req.body;

      if (!bloodGroup || unitsAvailable === undefined) {
          return res.status(400).json({ success: false, message: 'bloodGroup and unitsAvailable are required.' });
      }

      const stock = await BloodStock.findOneAndUpdate(
          { hospital: req.params.id, bloodGroup },
          { unitsAvailable, lastUpdated: new Date(), updatedBy: req.user._id },
          { new: true, upsert: true } // Create if doesn't exist
      );

      res.json({ success: true, message: 'Blood stock updated.', stock });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
