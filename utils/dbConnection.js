// utils/dbConnection.js
const mongoose = require('mongoose');

let isConnected = false;

async function connectToDatabase() {
    if (isConnected) {
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            serverSelectionRetryDelayMS: 5000,
            bufferMaxEntries: 0,
            bufferCommands: false,
        });

        isConnected = true;
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
    }
}

module.exports = { connectToDatabase };
