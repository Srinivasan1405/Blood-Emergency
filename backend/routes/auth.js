/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user._id);

  // Remove password from output
  const userObj = user.toObject();
  delete userObj.password;

  res.status(statusCode).json({
      success: true,
      message,
      token,
      user: userObj,
  });
};

// POST /api/auth/register 
router.post(
  '/register',
  [
      body('name').trim().notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
      body('password')
          .isLength({ min: 8 })
          .withMessage('Password must be at least 8 characters')
          .matches(/[A-Z]/)
          .withMessage('Password must contain at least one uppercase letter')
          .matches(/[a-z]/)
          .withMessage('Password must contain at least one lowercase letter')
          .matches(/[0-9]/)
          .withMessage('Password must contain at least one number')
          .matches(/[!@#$%^&*]/)
          .withMessage('Password must contain at least one special character (!@#$%^&*)'),
      body('bloodGroup')
          .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
          .withMessage('Valid blood group is required'),
      body('phone')
          .optional()
          .matches(/^[+]?[\d\s-]{10,15}$/)
          .withMessage('Please enter a valid phone number'),
      body('city').optional().trim(),
  ],
  async (req, res) => {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({
              success: false,
              message: 'Validation failed',
              errors: errors.array(),
          });
      }

      const { name, email, password, bloodGroup, phone, city, state } = req.body;

      try {
          // Check if email already exists
          const existingUser = await User.findOne({ email: email.toLowerCase() });
          if (existingUser) {
              return res.status(409).json({
                  success: false,
                  message: 'An account with this email already exists.',
              });
          }

          // Create new donor
          const user = await User.create({
              name,
              email,
              password,
              bloodGroup,
              phone,
              location: {
                  city: city?.toLowerCase(),
                  state: state?.toLowerCase(),
              },
              role: 'donor',
          });

          sendTokenResponse(user, 201, res, 'Registration successful! Welcome to Blood Emergency.');
      } catch (error) {
          console.error('Register error:', error);
          res.status(500).json({
              success: false,
              message: 'Server error during registration.',
              error: process.env.NODE_ENV === 'development' ? error.message : undefined,
          });
      }
  }
);

//  POST /api/auth/login 
router.post(
  '/login',
  [
      body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
      body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({
              success: false,
              message: 'Validation failed',
              errors: errors.array(),
          });
      }

      const { email, password } = req.body;

      try {
          // Find user and include password for comparison
          const user = await User.findOne({ email }).select('+password');

          if (!user) {
              return res.status(401).json({
                  success: false,
                  message: 'Invalid email or password.',
              });
          }

          if (!user.isActive) {
              return res.status(403).json({
                  success: false,
                  message: 'Account deactivated. Contact support.',
              });
          }

          // Compare passwords
          const isMatch = await user.comparePassword(password);
          if (!isMatch) {
              return res.status(401).json({
                  success: false,
                  message: 'Invalid email or password.',
              });
          }

          sendTokenResponse(user, 200, res, `Welcome back, ${user.name}!`);
      } catch (error) {
          console.error('Login error:', error);
          res.status(500).json({
              success: false,
              message: 'Server error during login.',
          });
      }
  }
);

//  GET /api/auth/me 
router.get('/me', protect, async (req, res) => {
  try {
      const user = await User.findById(req.user._id);
      res.json({
          success: true,
          user,
      });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Server error.' });
  }
});

//  POST /api/auth/logout 
// JWT is stateless — logout is handled client-side (delete token from storage)
// This endpoint serves as a confirmation
router.post('/logout', protect, (req, res) => {
  res.json({
      success: true,
      message: 'Logged out successfully. Please remove your token.',
  });
});

module.exports = router;
