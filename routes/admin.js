const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const WabaNumber = require('../models/WabaNumber');
const Settings = require('../models/Settings');
const ServiceCatalog = require('../models/ServiceCatalog');
const Barber = require('../models/Barber');
const Booking = require('../models/Booking');

// Clear all sessions
router.delete('/sessions', async (req, res) => {
    try {
        console.log('Clearing all sessions...');
        const result = await Session.deleteMany({});

        res.status(200).json({
            success: true,
            message: `Successfully cleared ${result.deletedCount} sessions`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error clearing sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear sessions',
            message: error.message
        });
    }
});

// Clear sessions for specific user
router.delete('/sessions/:userPhone', async (req, res) => {
    try {
        const { userPhone } = req.params;
        console.log(`Clearing sessions for user: ${userPhone}`);

        const result = await Session.deleteMany({ user_phone: userPhone });

        res.status(200).json({
            success: true,
            message: `Successfully cleared ${result.deletedCount} sessions for user ${userPhone}`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error clearing user sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear user sessions',
            message: error.message
        });
    }
});

// Clear sessions for specific shop
router.delete('/sessions/shop/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log(`Clearing sessions for shop: ${shopId}`);

        const result = await Session.deleteMany({ shop_id: shopId });

        res.status(200).json({
            success: true,
            message: `Successfully cleared ${result.deletedCount} sessions for shop ${shopId}`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error clearing shop sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear shop sessions',
            message: error.message
        });
    }
});

// Get session statistics
router.get('/sessions/stats', async (req, res) => {
    try {
        const totalSessions = await Session.countDocuments();
        const activeSessions = await Session.countDocuments({ is_active: true });
        const sessionsByShop = await Session.aggregate([
            {
                $group: {
                    _id: '$shop_id',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalSessions,
                activeSessions,
                inactiveSessions: totalSessions - activeSessions,
                sessionsByShop
            }
        });
    } catch (error) {
        console.error('Error getting session stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session statistics',
            message: error.message
        });
    }
});

// Clear all data (nuclear option)
router.delete('/clear-all', async (req, res) => {
    try {
        console.log('Clearing all data...');

        const results = await Promise.all([
            Session.deleteMany({}),
            Booking.deleteMany({}),
            // Don't delete WabaNumber, Settings, ServiceCatalog, Barber as they're configuration data
        ]);

        const [sessionsResult, bookingsResult] = results;

        res.status(200).json({
            success: true,
            message: 'Successfully cleared all session and booking data',
            deletedCounts: {
                sessions: sessionsResult.deletedCount,
                bookings: bookingsResult.deletedCount
            }
        });
    } catch (error) {
        console.error('Error clearing all data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear all data',
            message: error.message
        });
    }
});

module.exports = router;