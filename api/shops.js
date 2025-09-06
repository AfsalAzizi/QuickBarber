export const runtime = 'nodejs';

const express = require('express');
const { connectToDatabase } = require('../utils/dbConnection');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// Define models
const Settings = mongoose.models.Settings || require('../models/Settings');
const WabaNumber = mongoose.models.WabaNumber || require('../models/WabaNumber');
const Barber = mongoose.models.Barber || require('../models/Barber');
const ServiceCatalog = mongoose.models.ServiceCatalog || require('../models/ServiceCatalog');

// Get all shops
app.get('/', async (req, res) => {
    try {
        await connectToDatabase();
        const shops = await Settings.find().select('shop_id shop_name timezone start_time close_time');
        res.json(shops);
    } catch (error) {
        console.error('Error fetching shops:', error);
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
});

// Get shop by ID
app.get('/:id', async (req, res) => {
    try {
        await connectToDatabase();
        const shop = await Settings.findOne({ shop_id: req.params.id });
        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        res.json(shop);
    } catch (error) {
        console.error('Error fetching shop:', error);
        res.status(500).json({ error: 'Failed to fetch shop' });
    }
});

// Get shop barbers
app.get('/:id/barbers', async (req, res) => {
    try {
        await connectToDatabase();
        const barbers = await Barber.find({ shop_id: req.params.id, active: true });
        res.json(barbers);
    } catch (error) {
        console.error('Error fetching shop barbers:', error);
        res.status(500).json({ error: 'Failed to fetch shop barbers' });
    }
});

// Get shop services
app.get('/:id/services', async (req, res) => {
    try {
        await connectToDatabase();
        const services = await ServiceCatalog.find({ shop_id: req.params.id });
        res.json(services);
    } catch (error) {
        console.error('Error fetching shop services:', error);
        res.status(500).json({ error: 'Failed to fetch shop services' });
    }
});

export default app;
