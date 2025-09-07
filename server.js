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

// Connect to database with better error handling
async function connectToDatabase() {
    try {
        if (mongoose.connection.readyState === 1) {
            console.log('Using existing MongoDB connection');
            return;
        }

        console.log('Connecting to MongoDB...');
        console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 45000,
            maxPoolSize: 1, // Reduced for serverless
            bufferCommands: false, // Disable buffering
            maxIdleTimeMS: 10000,
        });

        console.log('MongoDB connected successfully');

        // Add connection event listeners
        mongoose.connection.on('connected', () => {
            console.log('Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('Mongoose disconnected from MongoDB');
        });

    } catch (error) {
        console.error('MongoDB connection failed:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });

        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    }
}

// Initialize database connection
connectToDatabase().catch(console.error);

// Routes
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/db-test', require('./routes/db-test'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
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

// Only start server if not in production or not on Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;