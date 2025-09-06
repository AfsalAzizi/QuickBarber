# QuickBarber Backend Deployment Guide

## 🚀 Vercel Deployment

### Prerequisites

- Vercel account
- GitHub repository
- MongoDB Atlas account (for production database)
- WhatsApp Business API credentials

### Step 1: Prepare Your Repository

1. **Push your code to GitHub:**

   ```bash
   git add .
   git commit -m "Initial commit with Vercel configuration"
   git push origin main
   ```

2. **Set up MongoDB Atlas:**
   - Create a new cluster on [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a database user
   - Whitelist your IP addresses (or use 0.0.0.0/0 for Vercel)
   - Get your connection string

### Step 2: Deploy to Vercel

1. **Connect to Vercel:**

   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Environment Variables:**
   In Vercel dashboard, go to Settings → Environment Variables and add:

   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/quickbarber?retryWrites=true&w=majority
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
   WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
   META_GRAPH_API_URL=https://graph.facebook.com/v18.0
   NODE_ENV=production
   ```

3. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note your deployment URL (e.g., `https://your-app.vercel.app`)

### Step 3: Configure WhatsApp Webhook

1. **Go to Meta Developer Console:**

   - Visit [Facebook Developers](https://developers.facebook.com)
   - Select your WhatsApp Business app

2. **Configure Webhook:**

   - Go to WhatsApp → Configuration
   - Set Webhook URL: `https://your-app.vercel.app/api/webhook`
   - Set Verify Token: Use the same value as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to `messages` events

3. **Test Webhook:**
   - Click "Verify and Save"
   - You should see a success message

### Step 4: Test Your Deployment

1. **Health Check:**

   ```bash
   curl https://your-app.vercel.app/health
   ```

2. **Webhook Verification:**
   ```bash
   curl "https://your-app.vercel.app/api/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_verify_token"
   ```

## 🐳 Docker Deployment

### Local Development with Docker

1. **Start the application:**

   ```bash
   npm run docker:dev
   ```

2. **Access services:**

   - API: http://localhost:3000
   - MongoDB Express: http://localhost:8081 (admin/password)

3. **Stop services:**
   ```bash
   npm run docker:stop
   ```

### Production Docker Deployment

1. **Build the image:**

   ```bash
   npm run docker:build
   ```

2. **Run the container:**
   ```bash
   npm run docker:run
   ```

## 🔧 Environment Variables

### Required Variables

| Variable                       | Description                 | Example                                 |
| ------------------------------ | --------------------------- | --------------------------------------- |
| `MONGODB_URI`                  | MongoDB connection string   | `mongodb://localhost:27017/quickbarber` |
| `WHATSAPP_ACCESS_TOKEN`        | WhatsApp Business API token | `EAAxxxxxxxxxxxx`                       |
| `WHATSAPP_VERIFY_TOKEN`        | Webhook verification token  | `my_secure_verify_token`                |
| `WHATSAPP_PHONE_NUMBER_ID`     | WhatsApp phone number ID    | `123456789012345`                       |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Business account ID         | `987654321098765`                       |
| `META_GRAPH_API_URL`           | Meta Graph API base URL     | `https://graph.facebook.com/v18.0`      |

### Optional Variables

| Variable   | Description | Default       |
| ---------- | ----------- | ------------- |
| `PORT`     | Server port | `3000`        |
| `NODE_ENV` | Environment | `development` |

## 🧪 Testing Your Deployment

### 1. Health Check

```bash
curl https://your-app.vercel.app/health
```

Expected response:

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### 2. Webhook Verification

```bash
curl "https://your-app.vercel.app/api/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_verify_token"
```

Expected response: `test`

### 3. Test WhatsApp Message

Send a test message to your WhatsApp Business number and check the logs in Vercel dashboard.

## 📊 Monitoring

### Vercel Dashboard

- Monitor function executions
- Check error logs
- View performance metrics

### MongoDB Atlas

- Monitor database performance
- Check connection logs
- Set up alerts

## 🔒 Security Considerations

1. **Environment Variables:**

   - Never commit `.env` files
   - Use strong, unique tokens
   - Rotate tokens regularly

2. **Webhook Security:**

   - Verify webhook signatures
   - Use HTTPS only
   - Validate incoming data

3. **Database Security:**
   - Use strong passwords
   - Enable IP whitelisting
   - Enable encryption at rest

## 🚨 Troubleshooting

### Common Issues

1. **Webhook Verification Fails:**

   - Check verify token matches
   - Ensure URL is accessible
   - Check Vercel deployment status

2. **Database Connection Issues:**

   - Verify MongoDB URI
   - Check IP whitelist
   - Verify credentials

3. **WhatsApp API Errors:**
   - Check access token validity
   - Verify phone number ID
   - Check API rate limits

### Debug Commands

```bash
# Check Vercel deployment logs
vercel logs

# Test local webhook
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[]}'

# Check MongoDB connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(console.error)"
```

## 📈 Scaling Considerations

1. **Database:**

   - Use MongoDB Atlas for production
   - Set up read replicas if needed
   - Monitor connection limits

2. **API:**

   - Vercel automatically scales
   - Monitor function timeouts
   - Consider caching strategies

3. **WhatsApp API:**
   - Monitor rate limits
   - Implement retry logic
   - Use webhook efficiently
