const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Test database connection
router.get('/', async (req, res) => {
    try {
        console.log('Testing database connection...');

        // Check connection state
        const connectionState = mongoose.connection.readyState;
        console.log('Mongoose connection state:', connectionState);

        // Connection states: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        const stateNames = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        const response = {
            timestamp: new Date().toISOString(),
            mongooseState: connectionState,
            mongooseStateName: stateNames[connectionState],
            isConnected: connectionState === 1,
            environment: process.env.NODE_ENV || 'development'
        };

        if (connectionState === 1) {
            // Test a simple query
            console.log('Testing simple query...');
            const testResult = await mongoose.connection.db.admin().ping();
            console.log('Ping result:', testResult);

            response.pingTest = testResult;
            response.status = 'success';
            response.message = 'Database connection is working';
        } else {
            response.status = 'error';
            response.message = `Database is ${stateNames[connectionState]}`;
        }

        console.log('Database test response:', response);
        res.status(200).json(response);

    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'error',
            message: 'Database test failed',
            error: error.message,
            mongooseState: mongoose.connection.readyState,
            environment: process.env.NODE_ENV || 'development'
        });
    }
});

// Test specific collections
router.get('/collections', async (req, res) => {
    try {
        console.log('Testing database collections...');

        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({
                status: 'error',
                message: 'Database not connected',
                state: mongoose.connection.readyState
            });
        }

        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Found collections:', collections.length);

        // Test each collection with a count
        const collectionTests = {};
        for (const collection of collections) {
            try {
                const count = await mongoose.connection.db.collection(collection.name).countDocuments();
                collectionTests[collection.name] = {
                    exists: true,
                    count: count
                };
            } catch (error) {
                collectionTests[collection.name] = {
                    exists: true,
                    error: error.message
                };
            }
        }

        res.status(200).json({
            timestamp: new Date().toISOString(),
            status: 'success',
            totalCollections: collections.length,
            collections: collectionTests,
            environment: process.env.NODE_ENV || 'development'
        });

    } catch (error) {
        console.error('Collections test error:', error);
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'error',
            message: 'Collections test failed',
            error: error.message
        });
    }
});

// Test specific models
router.get('/models', async (req, res) => {
    try {
        console.log('Testing database models...');

        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({
                status: 'error',
                message: 'Database not connected',
                state: mongoose.connection.readyState
            });
        }

        // Import models
        const Session = require('../models/Session');
        const WabaNumber = require('../models/WabaNumber');
        const Settings = require('../models/Settings');
        const ServiceCatalog = require('../models/ServiceCatalog');
        const Barber = require('../models/Barber');
        const Booking = require('../models/Booking');

        const models = [
            { name: 'Session', model: Session },
            { name: 'WabaNumber', model: WabaNumber },
            { name: 'Settings', model: Settings },
            { name: 'ServiceCatalog', model: ServiceCatalog },
            { name: 'Barber', model: Barber },
            { name: 'Booking', model: Booking }
        ];

        const modelTests = {};

        for (const { name, model } of models) {
            try {
                const count = await model.countDocuments();
                modelTests[name] = {
                    exists: true,
                    count: count,
                    collectionName: model.collection.name
                };
                console.log(`${name}: ${count} documents`);
            } catch (error) {
                modelTests[name] = {
                    exists: true,
                    error: error.message,
                    collectionName: model.collection.name
                };
                console.error(`${name} error:`, error.message);
            }
        }

        res.status(200).json({
            timestamp: new Date().toISOString(),
            status: 'success',
            models: modelTests,
            environment: process.env.NODE_ENV || 'development'
        });

    } catch (error) {
        console.error('Models test error:', error);
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'error',
            message: 'Models test failed',
            error: error.message
        });
    }
});

module.exports = router;