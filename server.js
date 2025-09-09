const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel compatibility
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection function with proper serverless configuration
async function connectToDatabase() {
    try {
        console.log('🔍 Connecting to MongoDB...');
        console.log('  - MONGODB_URI exists:', !!process.env.MONGODB_URI);

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        // Add connection event listeners for debugging
        mongoose.connection.on('connecting', () => {
            console.log('🔄 Mongoose connecting...');
        });

        mongoose.connection.on('connected', () => {
            console.log('✅ Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ Mongoose connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ Mongoose disconnected');
        });

        // Connection with aggressive timeouts for Vercel
        const connectionOptions = {
            serverSelectionTimeoutMS: 3000, // 3 second timeout
            connectTimeoutMS: 3000, // 3 second connection timeout
            socketTimeoutMS: 3000, // 3 second socket timeout
            maxPoolSize: 1, // Limit connection pool for serverless
            minPoolSize: 0, // No minimum pool size
            maxIdleTimeMS: 10000, // Close connections after 10 seconds
        };

        // Add serverless-specific options if on Vercel
        if (process.env.VERCEL) {
            connectionOptions.bufferCommands = false;
            console.log('🔧 Using Vercel-specific connection options');
        }

        console.log('🔗 Attempting MongoDB connection with options:', connectionOptions);

        // Add a timeout wrapper to prevent hanging
        const connectionPromise = mongoose.connect(process.env.MONGODB_URI, connectionOptions);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000);
        });

        await Promise.race([connectionPromise, timeoutPromise]);

        console.log('✅ Connected to MongoDB successfully');

    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        console.error('  - Error name:', error.name);
        console.error('  - Error message:', error.message);
        throw error;
    }
}

// Initialize server only after database connection
async function startServer() {
    try {
        console.log('🚀 Starting server initialization...');

        // Try to connect to database, but don't fail if it doesn't work
        try {
            await connectToDatabase();
            console.log('✅ Database connection successful, registering routes...');
        } catch (dbError) {
            console.error('⚠️ Database connection failed, but continuing with server startup...');
            console.error('Database error:', dbError.message);
        }

        // Routes
        app.use('/api/webhook', require('./routes/webhook'));
        app.use('/api/db-test', require('./routes/db-test'));

        // Simple test endpoint (no DB required)
        app.get('/api/test', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                message: 'API is working without database',
                environment: process.env.NODE_ENV || 'development'
            });
        });

        // Simple health check endpoint
        app.get('/health', (req, res) => {
            const dbState = mongoose.connection.readyState;
            const stateNames = {
                0: 'disconnected',
                1: 'connected',
                2: 'connecting',
                3: 'disconnecting'
            };

            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                database: {
                    state: dbState,
                    stateName: stateNames[dbState],
                    connected: dbState === 1
                },
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        });

        // Root endpoint
        app.get('/', (req, res) => {
            res.status(200).json({
                message: 'QuickBarber WhatsApp API',
                status: 'running',
                timestamp: new Date().toISOString(),
                dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
            });
        });

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
        });

        console.log('✅ Routes registered successfully');

        // Only start server if not in production or not on Vercel
        if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
            app.listen(PORT, () => {
                console.log(`🚀 Server running on port ${PORT}`);
                console.log(`📊 Database status: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);
            });
        } else {
            console.log('✅ Server ready for Vercel deployment');
            console.log(`📊 Database status: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);
        }

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error('  - Error name:', error.name);
        console.error('  - Error message:', error.message);

        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    }
}

// Start the server
startServer();

module.exports = app;