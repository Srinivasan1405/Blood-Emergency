/**
 * Donor Matching Service
 * Location-based and blood group compatible donor matching
 */

const User = require('../models/User');

//  Blood group compatibility chart 
// Maps recipient blood group → compatible donor blood groups
const COMPATIBILITY = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

/**
 * Find matching donors for a blood request
 * @param {string} bloodGroup - Required blood group
 * @param {string} city - City to search in
 * @param {Object} options - { limit, includeNearby, excludeIds }
 * @returns {Array} Sorted list of matching donors
 */
const findMatchingDonors = async (bloodGroup, city, options = {}) => {
    const { limit = 20, excludeIds = [] } = options;

    const compatibleGroups = COMPATIBILITY[bloodGroup] || [bloodGroup];

    const query = {
        role: 'donor',
        isAvailable: true,
        isActive: true,
        bloodGroup: { $in: compatibleGroups },
    };

    if (excludeIds.length > 0) {
        query._id = { $nin: excludeIds };
    }

    // Filter by city if provided
    if (city) {
        query['location.city'] = new RegExp(city.trim(), 'i');
    }

    const donors = await User.find(query)
        .select('name email phone bloodGroup location lastDonationDate totalDonations isAvailable')
        .sort({
            // Prioritize: O- (universal donors) first, then by most available
            bloodGroup: 1,
            totalDonations: 1,       // Prefer donors who have donated fewer times (spread load)
            lastDonationDate: 1,     // Prefer donors who haven't donated recently
        })
        .limit(limit);

    // Enrich with eligibility info
    const enrichedDonors = donors.map((donor) => {
        const donorObj = donor.toObject();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        donorObj.isEligible = !donor.lastDonationDate || donor.lastDonationDate <= threeMonthsAgo;
        donorObj.priority = donor.bloodGroup === 'O-' ? 'universal' :
            compatibleGroups[0] === bloodGroup ? 'exact' : 'compatible';
        return donorObj;
    });

    return enrichedDonors;
};

/**
 * Get blood group statistics for a city
 * @param {string} city
 * @returns {Object} Counts by blood group
 */
const getBloodGroupStats = async (city) => {
    const matchQuery = {
        role: 'donor',
        isActive: true,
        isAvailable: true,
    };

    if (city) {
        matchQuery['location.city'] = new RegExp(city.trim(), 'i');
    }

    const stats = await User.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$bloodGroup', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    // Format into map
    const result = {};
    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].forEach((g) => {
        result[g] = 0;
    });
    stats.forEach((s) => {
        result[s._id] = s.count;
    });

    return result;
};

module.exports = { findMatchingDonors, getBloodGroupStats, COMPATIBILITY };
