// utils/db.js
const mongoose = require('mongoose');

// Reuse the connection across hot-reloads and serverless warm starts
let cached = global.__mongoose;
if (!cached) {
    cached = global.__mongoose = { conn: null, promise: null };
}

/**
 * Call this once at the start of any request that touches the DB:
 *   await connectToDatabase();
 */
async function connectToDatabase() {
    // Check for MONGODB_URI at runtime, not at module load
    const { MONGODB_URI } = process.env;
    if (!MONGODB_URI) {
        throw new Error('Missing MONGODB_URI env var');
    }

    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        // Optional: align with your preferences
        mongoose.set('strictQuery', true);

        // IMPORTANT: rely on the driver's pool; don't open per-request connections
        cached.promise = mongoose.connect(MONGODB_URI, {
            // Pooling (driver handles socket reuse per lambda instance)
            maxPoolSize: 10,        // tune as needed (Atlas free/shared: keep modest)
            minPoolSize: 0,
            maxIdleTimeMS: 60000,   // keep connections alive for warm invocations
            // Timeouts
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            // Mongoose tweaks
            bufferCommands: false,  // prefer false in prod; fail fast if disconnected
        }).then((m) => m);
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

module.exports = { connectToDatabase };
