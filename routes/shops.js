const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const WabaNumber = require('../models/WabaNumber');
const ServiceCatalog = require('../models/ServiceCatalog');
const Barber = require('../models/Barber');

// Get all shops
router.get('/', async (req, res) => {
    try {
        const shops = await Settings.find({}).select('shop_id shop_name time_zone');
        res.json(shops);
    } catch (error) {
        console.error('Error fetching shops:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get shop details by ID
router.get('/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        const shop = await Settings.findOne({ shop_id: shopId });

        if (!shop) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        res.json(shop);
    } catch (error) {
        console.error('Error fetching shop details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get shop services
router.get('/:shopId/services', async (req, res) => {
    try {
        const { shopId } = req.params;

        // Get all active services from catalog
        const services = await ServiceCatalog.find({ is_active: true }).sort({ sort_order: 1 });

        res.json(services);
    } catch (error) {
        console.error('Error fetching shop services:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get shop barbers
router.get('/:shopId/barbers', async (req, res) => {
    try {
        const { shopId } = req.params;
        const barbers = await Barber.find({
            shop_id: shopId,
            active: true
        }).sort({ sort_order: 1 });

        res.json(barbers);
    } catch (error) {
        console.error('Error fetching shop barbers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get shop WhatsApp numbers
router.get('/:shopId/phone-numbers', async (req, res) => {
    try {
        const { shopId } = req.params;
        const phoneNumbers = await WabaNumber.find({
            shop_id: shopId,
            is_active: true
        });

        res.json(phoneNumbers);
    } catch (error) {
        console.error('Error fetching shop phone numbers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create or update shop settings
router.post('/:shopId/settings', async (req, res) => {
    try {
        const { shopId } = req.params;
        const settingsData = req.body;

        const shop = await Settings.findOneAndUpdate(
            { shop_id: shopId },
            { ...settingsData, shop_id: shopId },
            { upsert: true, new: true }
        );

        res.json(shop);
    } catch (error) {
        console.error('Error updating shop settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
