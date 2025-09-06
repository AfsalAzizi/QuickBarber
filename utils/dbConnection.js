// utils/dbConnection.js
const mongoose = require('mongoose');

let isConnected = false;

async function connectToDatabase() {
    if (isConnected && mongoose.connection.readyState === 1) {
        console.log('Database already connected');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            bufferCommands: true, // Enable buffering for serverless
            maxIdleTimeMS: 10000,
            // Remove deprecated options: serverSelectionRetryDelayMS, bufferMaxEntries
        });

        isConnected = true;
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error);
        isConnected = false;
        throw error;
    }
}

// Add function to check connection status
function isDatabaseConnected() {
    return mongoose.connection.readyState === 1;
}

// Add function to ensure connection
async function ensureConnection() {
    if (!isDatabaseConnected()) {
        console.log('Database not connected, attempting to connect...');
        await connectToDatabase();
    }
}

module.exports = {
    connectToDatabase,
    isDatabaseConnected,
    ensureConnection
};
