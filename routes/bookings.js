export const runtime = 'nodejs';

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Session = require('../models/Session');

// Get all bookings for a shop
router.get('/shop/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        const { date, status } = req.query;

        const filter = { shop_id: shopId };
        if (date) filter.date = new Date(date);
        if (status) filter.status = status;

        const bookings = await Booking.find(filter)
            .sort({ date: 1, start_time: 1 })
            .limit(100);

        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get bookings for a specific customer
router.get('/customer/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const { status } = req.query;

        const filter = { customer_phone: phone };
        if (status) filter.status = status;

        const bookings = await Booking.find(filter)
            .sort({ date: -1, start_time: 1 })
            .limit(50);

        res.json(bookings);
    } catch (error) {
        console.error('Error fetching customer bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get booking by booking code
router.get('/code/:bookingCode', async (req, res) => {
    try {
        const { bookingCode } = req.params;
        const booking = await Booking.findOne({ booking_code: bookingCode });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(booking);
    } catch (error) {
        console.error('Error fetching booking by code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new booking
router.post('/', async (req, res) => {
    try {
        const bookingData = req.body;

        // Validate required fields
        const requiredFields = ['shop_id', 'date', 'start_time', 'end_time', 'service_key', 'customer_phone', 'barber_id'];
        for (const field of requiredFields) {
            if (!bookingData[field]) {
                return res.status(400).json({ error: `Missing required field: ${field}` });
            }
        }

        const booking = new Booking(bookingData);
        await booking.save();

        res.status(201).json(booking);
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update booking status
router.patch('/:bookingId/status', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const booking = await Booking.findOneAndUpdate(
            { booking_id: bookingId },
            { status },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(booking);
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel a booking
router.patch('/:bookingId/cancel', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;

        const booking = await Booking.findOneAndUpdate(
            { booking_id: bookingId },
            {
                status: 'cancelled',
                notes: reason ? `Cancelled: ${reason}` : 'Cancelled by customer'
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(booking);
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
