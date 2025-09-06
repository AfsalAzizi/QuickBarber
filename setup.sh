#!/bin/bash

# QuickBarber Backend Setup Script
echo "🚀 QuickBarber Backend Setup"
echo "============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your actual credentials before running the application."
else
    echo "✅ .env file already exists"
fi

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    echo "✅ Docker is available"
    echo "🐳 You can use 'npm run docker:dev' to run with Docker"
else
    echo "ℹ️  Docker not found. You can install it for containerized development."
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your credentials"
echo "2. Set up MongoDB (local or Atlas)"
echo "3. Get WhatsApp Business API credentials"
echo "4. Run 'npm run dev' to start development server"
echo "5. Run 'npm run verify-webhook' to test webhook (after deployment)"
echo ""
echo "📚 For deployment instructions, see DEPLOYMENT.md"
