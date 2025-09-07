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

// Global connection state
let isConnecting = false;
let connectionPromise = null;

// Connect to database with better error handling
async function connectToDatabase() {
    try {
        // If already connected, return
        if (mongoose.connection.readyState === 1) {
            console.log('Using existing MongoDB connection');
            return mongoose.connection;
        }

        // If already connecting, wait for that connection
        if (isConnecting && connectionPromise) {
            console.log('Already connecting, waiting for connection...');
            return await connectionPromise;
        }

        // Start new connection
        isConnecting = true;
        console.log('Connecting to MongoDB...');
        console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        // Create connection promise
        connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 1, // Single connection for serverless
            bufferCommands: true, // Enable buffering for serverless
            bufferMaxEntries: 0, // Unlimited buffering
            maxIdleTimeMS: 10000,
        });

        await connectionPromise;
        console.log('MongoDB connected successfully');
        isConnecting = false;

        // Add connection event listeners
        mongoose.connection.on('connected', () => {
            console.log('Mongoose connected to MongoDB');
            isConnecting = false;
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnecting = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('Mongoose disconnected from MongoDB');
            isConnecting = false;
        });

        return mongoose.connection;

    } catch (error) {
        isConnecting = false;
        connectionPromise = null;
        console.error('MongoDB connection failed:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });

        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
        throw error;
    }
}

// Ensure database connection is ready
async function ensureDatabaseConnection() {
    try {
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected, establishing connection...');
            await connectToDatabase();
        }
        return mongoose.connection;
    } catch (error) {
        console.error('Failed to ensure database connection:', error);
        throw error;
    }
}

// Initialize database connection
connectToDatabase().catch(console.error);

// Routes
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/db-test', require('./routes/db-test'));

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await ensureDatabaseConnection();
        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            dbStatus: 'connection_failed',
            error: error.message
        });
    }
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

// Only start server if not in production or not on Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export both the app and the connection function
module.exports = app;
module.exports.connectToDatabase = connectToDatabase;
module.exports.ensureDatabaseConnection = ensureDatabaseConnection;