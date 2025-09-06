// scripts/addMissingData.js
const mongoose = require('mongoose');
const ServiceCatalog = require('../models/ServiceCatalog');
const Barber = require('../models/Barber');
require('dotenv').config();

async function addMissingData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Add sample services
        const services = [
            {
                service_key: 'haircut',
                label: 'Hair Cut',
                duration_min: 30,
                default_price: 500,
                is_active: true,
                sort_order: 1
            },
            {
                service_key: 'beard_trim',
                label: 'Beard Trim',
                duration_min: 20,
                default_price: 300,
                is_active: true,
                sort_order: 2
            },
            {
                service_key: 'cut_beard',
                label: 'Cut + Beard',
                duration_min: 45,
                default_price: 700,
                is_active: true,
                sort_order: 3
            }
        ];

        for (const service of services) {
            await ServiceCatalog.findOneAndUpdate(
                { service_key: service.service_key },
                service,
                { upsert: true, new: true }
            );
        }
        console.log('Services added/updated');

        // Add sample barbers
        const barbers = [
            {
                barber_id: 'barber_001',
                shop_id: 'QS001',
                name: 'John Smith',
                active: true,
                sort_order: 1
            },
            {
                barber_id: 'barber_002',
                shop_id: 'QS001',
                name: 'Mike Johnson',
                active: true,
                sort_order: 2
            },
            {
                barber_id: 'barber_003',
                shop_id: 'QS001',
                name: 'David Wilson',
                active: true,
                sort_order: 3
            }
        ];

        for (const barber of barbers) {
            await Barber.findOneAndUpdate(
                { barber_id: barber.barber_id },
                barber,
                { upsert: true, new: true }
            );
        }
        console.log('Barbers added/updated');

        console.log('Missing data added successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Error adding missing data:', error);
        process.exit(1);
    }
}

addMissingData();