// utils/dbConnection.js
const mongoose = require('mongoose');

let isConnected = false;

async function connectToDatabase() {
    if (isConnected && mongoose.connection.readyState === 1) {
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            bufferCommands: true,
            maxIdleTimeMS: 10000,
        });

        isConnected = true;
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error);
        isConnected = false;
        throw error;
    }
}

async function ensureConnection() {
    // Wait for connection to be fully ready
    if (mongoose.connection.readyState !== 1) {
        console.log('Database not ready, connecting...');
        await connectToDatabase();

        // Wait for connection to be fully established
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);

            mongoose.connection.once('connected', () => {
                clearTimeout(timeout);
                resolve();
            });

            mongoose.connection.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
}

module.exports = {
    connectToDatabase,
    ensureConnection
};
