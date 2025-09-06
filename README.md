# QuickBarber Backend API

A Node.js API for managing barber appointments via WhatsApp Business API, built with Express.js and MongoDB.

## Features

- WhatsApp webhook integration for receiving messages
- MongoDB-based data storage for appointments, sessions, and shop management
- Intent detection for natural language processing
- Booking management system
- Multi-shop support
- Session management for conversation flow

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- WhatsApp Business API access token
- Meta Developer Account

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd QuickBarber/Backend
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp env.example .env
```

4. Configure your environment variables in `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/quickbarber

# WhatsApp Business API Configuration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here

# Meta Graph API
META_GRAPH_API_URL=https://graph.facebook.com/v18.0
```

## Database Schema

The application uses the following MongoDB collections:

### Settings

- `shop_id`: Unique shop identifier
- `shop_name`: Shop name
- `time_zone`: Shop timezone
- `start_time`, `close_time`: Operating hours
- `lunch_start`, `lunch_end`: Lunch break hours
- `evening_start`: Evening shift start time
- `slot_interval_min`: Time slot interval in minutes
- `barbers_count`: Number of barbers

### Sessions

- `user_phone`: Customer phone number
- `shop_id`: Associated shop
- `selected_service`: Chosen service
- `phase`: Current conversation phase
- `intent`: Detected user intent
- `selected_barber_id`: Chosen barber
- `booking_id`: Associated booking

### WabaNumbers

- `phone_number_id`: WhatsApp phone number ID
- `display_phone_number`: Display phone number
- `shop_id`: Associated shop
- `timezone`: Phone number timezone

### ServiceCatalog

- `service_key`: Unique service identifier
- `label`: Service name
- `duration_min`: Service duration
- `default_price`: Service price

### Barbers

- `barber_id`: Unique barber identifier
- `shop_id`: Associated shop
- `name`: Barber name
- `active`: Availability status
- `specialties`: Service specialties

### Bookings

- `booking_id`: Unique booking identifier
- `booking_code`: Human-readable booking code
- `shop_id`: Associated shop
- `date`, `start_time`, `end_time`: Appointment details
- `service_key`: Chosen service
- `customer_phone`: Customer contact
- `barber_id`: Assigned barber
- `status`: Booking status

## API Endpoints

### Webhook

- `GET /api/webhook` - WhatsApp webhook verification
- `POST /api/webhook` - Receive WhatsApp messages

### Bookings

- `GET /api/bookings/shop/:shopId` - Get shop bookings
- `GET /api/bookings/customer/:phone` - Get customer bookings
- `GET /api/bookings/code/:bookingCode` - Get booking by code
- `POST /api/bookings` - Create new booking
- `PATCH /api/bookings/:bookingId/status` - Update booking status
- `PATCH /api/bookings/:bookingId/cancel` - Cancel booking

### Shops

- `GET /api/shops` - Get all shops
- `GET /api/shops/:shopId` - Get shop details
- `GET /api/shops/:shopId/services` - Get shop services
- `GET /api/shops/:shopId/barbers` - Get shop barbers
- `GET /api/shops/:shopId/phone-numbers` - Get shop phone numbers
- `POST /api/shops/:shopId/settings` - Update shop settings

### Health Check

- `GET /health` - Server health status

## WhatsApp Integration

### Webhook Setup

1. Set up your webhook URL in Meta Developer Console:

   ```
   https://yourdomain.com/api/webhook
   ```

2. Configure the verify token in your environment variables

3. The webhook will automatically verify and process incoming messages

### Message Processing

The system processes different types of WhatsApp messages:

- Text messages
- Interactive button responses
- List selections
- Media messages

### Intent Detection

The system automatically detects user intents:

- `book_appointment` - Booking requests
- `check_availability` - Availability inquiries
- `list_services` - Service catalog requests
- `list_barbers` - Barber information requests
- `cancel_booking` - Cancellation requests
- `reschedule` - Rescheduling requests
- `general_inquiry` - General questions

## Running the Application

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## Testing

Run the test suite:

```bash
npm test
```

## Deployment

1. Set up MongoDB Atlas or local MongoDB instance
2. Configure environment variables for production
3. Deploy to your preferred platform (Heroku, AWS, DigitalOcean, etc.)
4. Set up SSL certificate for webhook endpoint
5. Configure webhook URL in Meta Developer Console

## Security Considerations

- Webhook signature verification is implemented
- Environment variables for sensitive data
- Input validation and sanitization
- Rate limiting (recommended for production)
- CORS configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please contact the development team or create an issue in the repository.
