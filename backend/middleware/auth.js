/**
 * JWT Authentication Middleware
 * Verifies tokens and enforces role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verifies JWT token
 * Attaches the authenticated user to req.user
 */
const protect = async (req, res, next) => {
    let token;

    // Check Authorization header for Bearer token
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Alternatively check cookie (for browser-based requests)
    if (!token && req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No authentication token provided.',
        });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch fresh user data from DB (ensures user still exists and is active)
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Token invalid. User no longer exists.',
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Contact support.',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please login again.',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication token.',
        });
    }
};

/**
 * Role-based access control middleware
 * Usage: authorize('admin') or authorize('donor', 'admin')
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated.',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
            });
        }

        next();
    };
};

/**
 * Optional authentication — doesn't fail if no token
 * Useful for routes accessible to both guests and logged-in users
 */
const optionalAuth = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
    } catch {
        req.user = null;
    }

    next();
};

module.exports = { protect, authorize, optionalAuth };
