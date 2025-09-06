export const runtime = 'nodejs';

const express = require('express');
const { connectToDatabase } = require('../utils/dbConnection');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// Define models
const Booking = mongoose.models.Booking || require('../models/Booking');
const Barber = mongoose.models.Barber || require('../models/Barber');
const ServiceCatalog = mongoose.models.ServiceCatalog || require('../models/ServiceCatalog');

// Get all bookings
app.get('/', async (req, res) => {
    try {
        await connectToDatabase();
        const bookings = await Booking.find().sort({ created_at: -1 });
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Get booking by ID
app.get('/:id', async (req, res) => {
    try {
        await connectToDatabase();
        const booking = await Booking.findOne({ booking_id: req.params.id });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json(booking);
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
});

// Create new booking
app.post('/', async (req, res) => {
    try {
        await connectToDatabase();
        const booking = new Booking(req.body);
        await booking.save();
        res.status(201).json(booking);
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Update booking
app.put('/:id', async (req, res) => {
    try {
        await connectToDatabase();
        const booking = await Booking.findOneAndUpdate(
            { booking_id: req.params.id },
            req.body,
            { new: true }
        );
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json(booking);
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

// Delete booking
app.delete('/:id', async (req, res) => {
    try {
        await connectToDatabase();
        const booking = await Booking.findOneAndDelete({ booking_id: req.params.id });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Failed to delete booking' });
    }
});

export default app;
