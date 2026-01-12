#!/bin/bash

# Quick Start Script for Testing with Exotel
# This script helps you start all required services

set -e  # Exit on error

echo "================================================"
echo "🚀 Starting Exotel Webhook Testing Environment"
echo "================================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Must run from project root directory${NC}"
  exit 1
fi

echo -e "${BLUE}📋 Pre-flight Checks${NC}"
echo "================================================"

# Check Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "${GREEN}✅ Node.js: ${NODE_VERSION}${NC}"
else
  echo -e "${RED}❌ Node.js not found. Please install Node.js 20+${NC}"
  exit 1
fi

# Check Docker
if command -v docker &> /dev/null; then
  echo -e "${GREEN}✅ Docker installed${NC}"
else
  echo -e "${RED}❌ Docker not found. Please install Docker${NC}"
  exit 1
fi

# Check ngrok
if command -v ngrok &> /dev/null; then
  echo -e "${GREEN}✅ ngrok installed${NC}"
else
  echo -e "${YELLOW}⚠️  ngrok not found. Install with: brew install ngrok${NC}"
fi

# Check if database exists
if [ -f "database/app.db" ]; then
  echo -e "${GREEN}✅ Database exists${NC}"
else
  echo -e "${YELLOW}⚠️  Database not found. Will create...${NC}"
  npm run db:init
  echo -e "${GREEN}✅ Database initialized${NC}"
fi

echo ""
echo -e "${BLUE}🐳 Starting Redis${NC}"
echo "================================================"

# Check if Redis container is already running
if docker ps | grep -q "sales-call-qc-redis"; then
  echo -e "${GREEN}✅ Redis already running${NC}"
else
  echo "Starting Redis container..."
  docker-compose up -d
  sleep 2

  # Verify Redis is running
  if docker ps | grep -q "sales-call-qc-redis"; then
    echo -e "${GREEN}✅ Redis started successfully${NC}"
  else
    echo -e "${RED}❌ Failed to start Redis${NC}"
    exit 1
  fi
fi

# Test Redis connection
if docker exec sales-call-qc-redis redis-cli ping &> /dev/null; then
  echo -e "${GREEN}✅ Redis responding to PING${NC}"
else
  echo -e "${RED}❌ Redis not responding${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}🔧 Environment Configuration${NC}"
echo "================================================"

# Check if .env exists
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  .env file not found. Copying from env.example...${NC}"
  cp env.example .env
  echo -e "${GREEN}✅ .env created. Please edit it with your Exotel credentials!${NC}"
  echo ""
  echo "Required variables:"
  echo "  - EXOTEL_ACCOUNT_SID"
  echo "  - EXOTEL_API_KEY"
  echo "  - EXOTEL_API_TOKEN"
  echo ""
  read -p "Press Enter after updating .env, or Ctrl+C to exit..."
fi

# Check if Exotel credentials are configured
if grep -q "your_exotel_account_sid" .env; then
  echo -e "${YELLOW}⚠️  Exotel credentials not configured in .env${NC}"
  echo -e "${YELLOW}   You can still test with mock webhooks!${NC}"
else
  echo -e "${GREEN}✅ Exotel credentials configured${NC}"
fi

echo ""
echo -e "${BLUE}📦 Installing Dependencies${NC}"
echo "================================================"

if [ ! -d "node_modules" ]; then
  echo "Installing npm packages..."
  npm install
else
  echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Starting Application${NC}"
echo "================================================"
echo ""
echo "Starting server and workers..."
echo "Press Ctrl+C to stop"
echo ""
echo -e "${GREEN}✨ Everything is ready!${NC}"
echo ""
echo "📍 Server will be at: http://localhost:3000"
echo "📍 Health check: http://localhost:3000/health"
echo "📍 API info: http://localhost:3000/api"
echo ""
echo "🔗 Next steps:"
echo "   1. Server will start below"
echo "   2. Open another terminal and run: ngrok http 3000"
echo "   3. Copy the ngrok HTTPS URL"
echo "   4. Configure it in Exotel dashboard"
echo "   5. Make a test call!"
echo ""
echo "📖 Full guide: cat TESTING_WITH_EXOTEL.md"
echo ""
echo "================================================"
echo ""
sleep 2

# Start the application
npm run dev:all
