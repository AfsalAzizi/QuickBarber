export const runtime = 'nodejs';

const express = require('express');
const { connectToDatabase } = require('../utils/dbConnection');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// Define models
const Session = mongoose.models.Session || require('../models/Session');
const WabaNumber = mongoose.models.WabaNumber || require('../models/WabaNumber');
const Settings = mongoose.models.Settings || require('../models/Settings');
const ServiceCatalog = mongoose.models.ServiceCatalog || require('../models/ServiceCatalog');
const Barber = mongoose.models.Barber || require('../models/Barber');
const Booking = mongoose.models.Booking || require('../models/Booking');

// Clear all sessions
app.delete('/sessions', async (req, res) => {
    try {
        await connectToDatabase();
        const result = await Session.deleteMany({});
        res.json({ 
            message: 'All sessions cleared', 
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Error clearing sessions:', error);
        res.status(500).json({ error: 'Failed to clear sessions' });
    }
});

// Clear sessions for specific user
app.delete('/sessions/:userPhone', async (req, res) => {
    try {
        await connectToDatabase();
        const { userPhone } = req.params;
        const result = await Session.deleteMany({ user_phone: userPhone });
        res.json({ 
            message: `Sessions cleared for user ${userPhone}`, 
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Error clearing user sessions:', error);
        res.status(500).json({ error: 'Failed to clear user sessions' });
    }
});

// Clear sessions for specific shop
app.delete('/sessions/shop/:shopId', async (req, res) => {
    try {
        await connectToDatabase();
        const { shopId } = req.params;
        const result = await Session.deleteMany({ shop_id: shopId });
        res.json({ 
            message: `Sessions cleared for shop ${shopId}`, 
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Error clearing shop sessions:', error);
        res.status(500).json({ error: 'Failed to clear shop sessions' });
    }
});

// Get session statistics
app.get('/sessions/stats', async (req, res) => {
    try {
        await connectToDatabase();
        const stats = await Session.aggregate([
            {
                $group: {
                    _id: null,
                    totalSessions: { $sum: 1 },
                    activeSessions: { $sum: { $cond: ['$is_active', 1, 0] } },
                    uniqueUsers: { $addToSet: '$user_phone' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSessions: 1,
                    activeSessions: 1,
                    uniqueUsers: { $size: '$uniqueUsers' }
                }
            }
        ]);
        
        res.json(stats[0] || { totalSessions: 0, activeSessions: 0, uniqueUsers: 0 });
    } catch (error) {
        console.error('Error getting session stats:', error);
        res.status(500).json({ error: 'Failed to get session stats' });
    }
});

// Clear all data (nuclear option)
app.delete('/clear-all', async (req, res) => {
    try {
        await connectToDatabase();
        
        const results = await Promise.all([
            Session.deleteMany({}),
            WabaNumber.deleteMany({}),
            Settings.deleteMany({}),
            ServiceCatalog.deleteMany({}),
            Barber.deleteMany({}),
            Booking.deleteMany({})
        ]);
        
        res.json({ 
            message: 'All data cleared',
            results: {
                sessions: results[0].deletedCount,
                wabaNumbers: results[1].deletedCount,
                settings: results[2].deletedCount,
                serviceCatalog: results[3].deletedCount,
                barbers: results[4].deletedCount,
                bookings: results[5].deletedCount
            }
        });
    } catch (error) {
        console.error('Error clearing all data:', error);
        res.status(500).json({ error: 'Failed to clear all data' });
    }
});

export default app;
