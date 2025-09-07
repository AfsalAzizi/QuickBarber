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

// Database connection function with timeout and fallback
async function connectToDatabase() {
    try {
        console.log('🔍 Starting database connection process...');
        console.log(' Environment check:');
        console.log('  - NODE_ENV:', process.env.NODE_ENV);
        console.log('  - VERCEL:', process.env.VERCEL);
        console.log('  - MONGODB_URI exists:', !!process.env.MONGODB_URI);

        if (process.env.MONGODB_URI) {
            // Log URI structure without exposing credentials
            const uri = process.env.MONGODB_URI;
            const uriParts = uri.split('@');
            if (uriParts.length > 1) {
                console.log('  - URI format: mongodb+srv://[credentials]@' + uriParts[1].split('/')[0]);
                console.log('  - Database name:', uriParts[1].split('/')[1]?.split('?')[0] || 'not specified');
            } else {
                console.log('  - URI format: Invalid format detected');
            }
        }

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        console.log('🔍 Current mongoose connection state:', mongoose.connection.readyState);
        console.log('  - 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting');

        if (mongoose.connection.readyState === 1) {
            console.log('✅ Already connected to MongoDB');
            return mongoose.connection;
        }

        console.log('🔍 Attempting to connect to MongoDB...');
        console.log(' Connection options:');

        // Remove deprecated options and use modern connection options
        const connectionOptions = {
            serverSelectionTimeoutMS: 10000, // Reduced timeout
            socketTimeoutMS: 45000,
            maxPoolSize: 1,
            bufferCommands: true,
            retryWrites: true,
            w: 'majority',
            // Removed deprecated options: useNewUrlParser, useUnifiedTopology
        };

        console.log('  - serverSelectionTimeoutMS:', connectionOptions.serverSelectionTimeoutMS);
        console.log('  - socketTimeoutMS:', connectionOptions.socketTimeoutMS);
        console.log('  - maxPoolSize:', connectionOptions.maxPoolSize);
        console.log('  - bufferCommands:', connectionOptions.bufferCommands);

        const startTime = Date.now();

        // Add timeout wrapper to prevent hanging
        const connectionPromise = mongoose.connect(process.env.MONGODB_URI, connectionOptions);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000);
        });

        await Promise.race([connectionPromise, timeoutPromise]);
        const connectionTime = Date.now() - startTime;

        console.log('✅ MongoDB connected successfully');
        console.log('  - Connection time:', connectionTime + 'ms');
        console.log('  - Connection state:', mongoose.connection.readyState);
        console.log('  - Host:', mongoose.connection.host);
        console.log('  - Port:', mongoose.connection.port);
        console.log('  - Name:', mongoose.connection.name);

        return mongoose.connection;

    } catch (error) {
        console.error('❌ MongoDB connection failed:');
        console.error('  - Error name:', error.name);
        console.error('  - Error message:', error.message);
        console.error('  - Error code:', error.code);

        if (error.name === 'MongoServerSelectionError') {
            console.error('🔍 Server selection error details:');
            console.error('  - This usually means:');
            console.error('    1. Network connectivity issues');
            console.error('    2. IP address not whitelisted in Atlas');
            console.error('    3. Incorrect connection string');
            console.error('    4. Atlas cluster is paused or unavailable');
        }

        if (error.name === 'MongoParseError') {
            console.error('🔍 Parse error details:');
            console.error('  - This usually means:');
            console.error('    1. Invalid connection string format');
            console.error('    2. Unsupported connection options');
            console.error('    3. Malformed URI parameters');
        }

        throw error;
    }
}

// Connection event listeners with detailed logging
mongoose.connection.on('connecting', () => {
    console.log('🔄 Mongoose is connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
    console.log('  - Host:', mongoose.connection.host);
    console.log('  - Port:', mongoose.connection.port);
    console.log('  - Database:', mongoose.connection.name);
});

mongoose.connection.on('open', () => {
    console.log('🔓 Mongoose connection is open and ready to use');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
    console.error('  - Error name:', err.name);
    console.error('  - Error message:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected from MongoDB');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 Mongoose reconnected to MongoDB');
});

// Initialize server with fallback for database connection
async function startServer() {
    try {
        console.log('🚀 Starting server initialization...');

        // Try to connect to database with timeout
        try {
            await connectToDatabase();
            console.log('✅ Database connection successful');
        } catch (dbError) {
            console.error('⚠️ Database connection failed, starting server anyway...');
            console.error('Database operations will fail until connection is established');
        }

        console.log(' Registering routes...');

        // Routes - always register these
        app.use('/api/webhook', require('./routes/webhook'));
        app.use('/api/db-test', require('./routes/db-test'));

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                dbHost: mongoose.connection.host,
                dbName: mongoose.connection.name
            });
        });

        // Root endpoint
        app.get('/', (req, res) => {
            res.status(200).json({
                message: 'QuickBarber WhatsApp API',
                status: 'running',
                timestamp: new Date().toISOString(),
                dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                dbHost: mongoose.connection.host,
                dbName: mongoose.connection.name
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