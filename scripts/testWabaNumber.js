// scripts/searchWabaNumber.js
const mongoose = require('mongoose');
const WabaNumber = require('../models/WabaNumber');
require('dotenv').config();

async function searchWabaNumber() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB successfully');

        const phoneNumberId = '790270954150020';
        console.log(`\n🔍 Searching for phone_number_id: ${phoneNumberId}`);

        // Method 1: Using Mongoose model
        console.log('\n--- Method 1: Mongoose Model Query ---');
        try {
            const wabaNumber = await WabaNumber.findOne({ phone_number_id: phoneNumberId });
            console.log('Mongoose query result:', wabaNumber);
        } catch (error) {
            console.error('Mongoose query error:', error.message);
        }

        // Method 2: Using raw MongoDB query
        console.log('\n--- Method 2: Raw MongoDB Query ---');
        try {
            const { MongoClient } = require('mongodb');
            const client = new MongoClient(process.env.MONGODB_URI);

            await client.connect();
            const db = client.db('barber');
            const collection = db.collection('wabanumbers');

            const rawResult = await collection.findOne({ phone_number_id: phoneNumberId });
            console.log('Raw MongoDB query result:', rawResult);

            await client.close();
        } catch (error) {
            console.error('Raw MongoDB query error:', error.message);
        }

        // Method 3: List all documents in the collection
        console.log('\n--- Method 3: List All Documents in wabanumbers Collection ---');
        try {
            const allDocuments = await WabaNumber.find({});
            console.log('All documents in wabanumbers collection:');
            allDocuments.forEach((doc, index) => {
                console.log(`Document ${index + 1}:`, {
                    _id: doc._id,
                    phone_number_id: doc.phone_number_id,
                    display_phone_number: doc.display_phone_number,
                    shop_id: doc.shop_id
                });
            });
        } catch (error) {
            console.error('List all documents error:', error.message);
        }

        // Method 4: Test different query variations
        console.log('\n--- Method 4: Test Different Query Variations ---');
        const queryVariations = [
            { phone_number_id: phoneNumberId },
            { phone_number_id: parseInt(phoneNumberId) },
            { phone_number_id: { $eq: phoneNumberId } },
            { phone_number_id: { $regex: phoneNumberId, $options: 'i' } }
        ];

        for (let i = 0; i < queryVariations.length; i++) {
            try {
                console.log(`\nQuery variation ${i + 1}:`, queryVariations[i]);
                const result = await WabaNumber.findOne(queryVariations[i]);
                console.log(`Result:`, result ? 'Found' : 'Not found');
                if (result) {
                    console.log('Document:', result);
                }
            } catch (error) {
                console.error(`Query variation ${i + 1} error:`, error.message);
            }
        }

        // Method 5: Check collection stats
        console.log('\n--- Method 5: Collection Statistics ---');
        try {
            const count = await WabaNumber.countDocuments();
            console.log(`Total documents in wabanumbers collection: ${count}`);

            const distinctPhoneNumbers = await WabaNumber.distinct('phone_number_id');
            console.log('All phone_number_id values in collection:', distinctPhoneNumbers);
        } catch (error) {
            console.error('Collection stats error:', error.message);
        }

        console.log('\n✅ Search completed');
        process.exit(0);

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}

// Run the script
searchWabaNumber();