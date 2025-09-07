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

// Simple database connection function - like your working TypeScript example
async function connectToDatabase() {
    try {
        console.log('🔍 Connecting to MongoDB...');
        console.log('  - MONGODB_URI exists:', !!process.env.MONGODB_URI);

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        // Simple connection - just like your working example
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

// Initialize server only after database connection
async function startServer() {
    try {
        console.log('🚀 Starting server initialization...');

        // Connect to database first
        await connectToDatabase();
        console.log('✅ Database connection successful, registering routes...');

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