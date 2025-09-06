const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectToDatabase } = require('./utils/dbConnection');
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

// Connect to database
connectToDatabase()
    .then(() => {
        console.log('MongoDB connection established');
    })
    .catch((error) => {
        console.error('Failed to connect to MongoDB:', error);
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    });

// Routes
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
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
