// utils/dbConnection.js
const mongoose = require('mongoose');

// one cache per process (reused on warm invocations / hot reloads)
const cached = global.__mongoose || (global.__mongoose = {
    conn: null,
    promise: null,
    listenersAttached: false,
});

async function connectToDatabase() {
    const { MONGODB_URI, MONGO_DEBUG } = process.env;
    if (!MONGODB_URI) throw new Error('Missing MONGODB_URI env var');

    // 1 = connected, 2 = connecting
    if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
    if (cached.promise && mongoose.connection.readyState === 2) {
        cached.conn = await cached.promise;
        return cached.conn;
    }

    // attach listeners once per process
    if (!cached.listenersAttached) {
        cached.listenersAttached = true;
        mongoose.connection.on('connected', () => {
            cached.conn = mongoose.connection;
            if (MONGO_DEBUG) console.log('[mongo] connected');
        });
        mongoose.connection.on('error', (err) => {
            if (MONGO_DEBUG) console.error('[mongo] error:', err?.message || err);
        });
        mongoose.connection.on('disconnected', () => {
            // allow a clean reconnect on next call
            cached.conn = null;
            cached.promise = null;
            if (MONGO_DEBUG) console.warn('[mongo] disconnected');
        });
    }

    mongoose.set('strictQuery', true);
    if (process.env.MONGO_DEBUG) mongoose.set('debug', true);

    // start a single connect() per cold start; everyone awaits the same promise
    cached.promise = mongoose.connect(MONGODB_URI, {
        // Pooling (per process)
        maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE ?? 10),
        minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE ?? 0),
        maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_MS ?? 60_000),

        // Timeouts
        serverSelectionTimeoutMS: Number(process.env.MONGO_SST_MS ?? 5000),
        socketTimeoutMS: Number(process.env.MONGO_SOCKET_MS ?? 45_000),

        // Behavior
        bufferCommands: false,

        // With mongodb+srv TLS is default; keep explicit for clarity
        tls: true,
        directConnection: false,

        // Optional: uncomment if your platform has IPv6 DNS quirks
        // family: 4,
    }).then((m) => m).catch((err) => {
        // allow retry on the next call
        cached.promise = null;
        throw err;
    });

    cached.conn = await cached.promise;
    return cached.conn;
}

module.exports = { connectToDatabase };
