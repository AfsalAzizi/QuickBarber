// MongoDB initialization script
db = db.getSiblingDB('quickbarber');

// Create collections with validation
db.createCollection('settings', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['shop_id', 'shop_name', 'time_zone', 'start_time', 'close_time'],
            properties: {
                shop_id: { bsonType: 'string' },
                shop_name: { bsonType: 'string' },
                time_zone: { bsonType: 'string' },
                start_time: { bsonType: 'string' },
                close_time: { bsonType: 'string' },
                slot_interval_min: { bsonType: 'int', minimum: 5, maximum: 60 },
                barbers_count: { bsonType: 'int', minimum: 1 }
            }
        }
    }
});

db.createCollection('sessions', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['user_phone', 'shop_id'],
            properties: {
                user_phone: { bsonType: 'string' },
                shop_id: { bsonType: 'string' },
                phase: {
                    bsonType: 'string',
                    enum: ['welcome', 'service_selection', 'barber_selection', 'time_selection', 'confirmation', 'completed']
                },
                intent: {
                    bsonType: 'string',
                    enum: ['book_appointment', 'check_availability', 'list_services', 'list_barbers', 'cancel_booking', 'reschedule', 'general_inquiry']
                }
            }
        }
    }
});

db.createCollection('wabanumbers');
db.createCollection('servicecatalogs');
db.createCollection('shopserviceoverrides');
db.createCollection('barbers');
db.createCollection('bookings');

// Create indexes for better performance
db.settings.createIndex({ shop_id: 1 }, { unique: true });
db.sessions.createIndex({ user_phone: 1, shop_id: 1 });
db.sessions.createIndex({ user_phone: 1, is_active: 1 });
db.wabanumbers.createIndex({ phone_number_id: 1 }, { unique: true });
db.wabanumbers.createIndex({ shop_id: 1 });
db.servicecatalogs.createIndex({ service_key: 1 }, { unique: true });
db.barbers.createIndex({ barber_id: 1 }, { unique: true });
db.barbers.createIndex({ shop_id: 1, active: 1 });
db.bookings.createIndex({ booking_id: 1 }, { unique: true });
db.bookings.createIndex({ booking_code: 1 }, { unique: true });
db.bookings.createIndex({ shop_id: 1, date: 1, status: 1 });
db.bookings.createIndex({ customer_phone: 1, status: 1 });

print('Database initialized successfully');
