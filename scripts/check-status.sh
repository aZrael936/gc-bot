#!/bin/bash

# Status Checker Script
# Quickly check the status of your QC Automation system

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}================================================"
echo "📊 QC Automation System Status"
echo "================================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Must run from project root directory${NC}"
  exit 1
fi

# 1. Server Status
echo -e "${BLUE}🚀 Server Status${NC}"
echo "------------------------------------------------"
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Server is running${NC}"
  HEALTH=$(curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health)
  echo "$HEALTH"
else
  echo -e "${RED}❌ Server is not running${NC}"
  echo "   Start with: npm run dev:all"
fi
echo ""

# 2. Redis Status
echo -e "${BLUE}🔴 Redis Status${NC}"
echo "------------------------------------------------"
if docker ps | grep -q "sales-call-qc-redis"; then
  echo -e "${GREEN}✅ Redis container is running${NC}"
  if docker exec sales-call-qc-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is responding${NC}"
  else
    echo -e "${RED}❌ Redis is not responding${NC}"
  fi
else
  echo -e "${RED}❌ Redis container is not running${NC}"
  echo "   Start with: docker-compose up -d"
fi
echo ""

# 3. Database Status
echo -e "${BLUE}💾 Database Status${NC}"
echo "------------------------------------------------"
if [ -f "database/app.db" ]; then
  echo -e "${GREEN}✅ Database exists${NC}"

  # Count calls by status
  TOTAL_CALLS=$(sqlite3 database/app.db "SELECT COUNT(*) FROM calls;" 2>/dev/null || echo "0")
  echo "   Total calls: $TOTAL_CALLS"

  if [ "$TOTAL_CALLS" -gt 0 ]; then
    echo ""
    echo "   Breakdown by status:"
    sqlite3 database/app.db "
      SELECT '   ' || status || ': ' || COUNT(*)
      FROM calls
      GROUP BY status;
    " 2>/dev/null || echo "   Error reading database"

    echo ""
    echo "   Latest call:"
    sqlite3 database/app.db "
      SELECT '   ID: ' || id || '\n   Status: ' || status || '\n   Created: ' || created_at
      FROM calls
      ORDER BY created_at DESC
      LIMIT 1;
    " 2>/dev/null || echo "   No calls found"
  fi
else
  echo -e "${RED}❌ Database not found${NC}"
  echo "   Initialize with: npm run db:init"
fi
echo ""

# 4. Storage Status
echo -e "${BLUE}📁 Storage Status${NC}"
echo "------------------------------------------------"
if [ -d "storage/audio" ]; then
  echo -e "${GREEN}✅ Storage directory exists${NC}"

  AUDIO_COUNT=$(find storage/audio -type f \( -name "*.wav" -o -name "*.mp3" \) 2>/dev/null | wc -l | xargs)
  echo "   Audio files: $AUDIO_COUNT"

  if [ "$AUDIO_COUNT" -gt 0 ]; then
    STORAGE_SIZE=$(du -sh storage/audio 2>/dev/null | awk '{print $1}')
    echo "   Total size: $STORAGE_SIZE"

    echo ""
    echo "   Latest files:"
    find storage/audio -type f \( -name "*.wav" -o -name "*.mp3" \) -exec ls -lh {} \; 2>/dev/null | tail -3 | awk '{print "   " $9 " (" $5 ")"}'
  fi
else
  echo -e "${YELLOW}⚠️  Storage directory not found${NC}"
  echo "   Creating..."
  mkdir -p storage/audio/default
  echo -e "${GREEN}✅ Created storage directories${NC}"
fi
echo ""

# 5. ngrok Status
echo -e "${BLUE}🔗 ngrok Status${NC}"
echo "------------------------------------------------"
if command -v ngrok &> /dev/null; then
  echo -e "${GREEN}✅ ngrok is installed${NC}"

  # Try to get ngrok status
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null || echo "")

  if [ -n "$NGROK_URL" ]; then
    echo -e "${GREEN}✅ ngrok tunnel is active${NC}"
    echo "   Public URL: $NGROK_URL"
    echo "   Webhook URL: $NGROK_URL/webhook/exotel"
    echo "   Dashboard: http://localhost:4040"
  else
    echo -e "${YELLOW}⚠️  ngrok is not running${NC}"
    echo "   Start with: ngrok http 3000"
  fi
else
  echo -e "${YELLOW}⚠️  ngrok is not installed${NC}"
  echo "   Install with: brew install ngrok"
fi
echo ""

# 6. Queue Status
echo -e "${BLUE}📋 Queue Status (BullMQ)${NC}"
echo "------------------------------------------------"
if docker ps | grep -q "sales-call-qc-redis"; then
  QUEUE_COUNT=$(docker exec sales-call-qc-redis redis-cli KEYS "bull:*" 2>/dev/null | wc -l | xargs)
  echo "   Queue keys: $QUEUE_COUNT"

  if [ "$QUEUE_COUNT" -gt 0 ]; then
    echo ""
    echo "   Active queues:"
    docker exec sales-call-qc-redis redis-cli KEYS "bull:audio-download*" 2>/dev/null | head -3 | awk '{print "   - " $0}'
    docker exec sales-call-qc-redis redis-cli KEYS "bull:transcription*" 2>/dev/null | head -3 | awk '{print "   - " $0}'
  fi
else
  echo -e "${YELLOW}⚠️  Cannot check queues (Redis not running)${NC}"
fi
echo ""

# 7. Recent Logs
echo -e "${BLUE}📝 Recent Activity (Last 5 entries)${NC}"
echo "------------------------------------------------"
if [ -f "logs/app.log" ]; then
  tail -5 logs/app.log | awk '{print "   " $0}'
else
  echo -e "${YELLOW}⚠️  No log file found${NC}"
fi
echo ""

# 8. Exotel Configuration
echo -e "${BLUE}🔧 Exotel Configuration${NC}"
echo "------------------------------------------------"
if [ -f ".env" ]; then
  if grep -q "your_exotel_account_sid" .env 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Exotel credentials not configured${NC}"
    echo "   Edit .env file with your Exotel credentials"
  else
    ACCOUNT_SID=$(grep "EXOTEL_ACCOUNT_SID=" .env | cut -d'=' -f2)
    if [ -n "$ACCOUNT_SID" ] && [ "$ACCOUNT_SID" != "your_exotel_account_sid" ]; then
      echo -e "${GREEN}✅ Exotel credentials configured${NC}"
      echo "   Account SID: ${ACCOUNT_SID:0:10}..."
    else
      echo -e "${YELLOW}⚠️  Exotel credentials not set${NC}"
    fi
  fi
else
  echo -e "${RED}❌ .env file not found${NC}"
  echo "   Copy from: cp env.example .env"
fi
echo ""

# Summary
echo -e "${CYAN}================================================"
echo "📊 Summary"
echo "================================================${NC}"

ISSUES=0

# Check critical services
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "${RED}❌ Server not running${NC}"
  ((ISSUES++))
fi

if ! docker ps | grep -q "sales-call-qc-redis"; then
  echo -e "${RED}❌ Redis not running${NC}"
  ((ISSUES++))
fi

if [ ! -f "database/app.db" ]; then
  echo -e "${RED}❌ Database not initialized${NC}"
  ((ISSUES++))
fi

if [ "$ISSUES" -eq 0 ]; then
  echo -e "${GREEN}✅ All systems operational!${NC}"
  echo ""
  echo "🎯 Ready to receive webhooks!"
  echo ""
  if [ -z "$NGROK_URL" ]; then
    echo "💡 Next step: Start ngrok"
    echo "   Run: ngrok http 3000"
  else
    echo "💡 Next step: Make a test call"
    echo "   Configure webhook in Exotel: $NGROK_URL/webhook/exotel"
  fi
else
  echo -e "${RED}⚠️  Found $ISSUES issue(s) - see details above${NC}"
  echo ""
  echo "📖 Quick fixes:"
  echo "   - Start server: npm run dev:all"
  echo "   - Start Redis: docker-compose up -d"
  echo "   - Init database: npm run db:init"
fi

echo ""
echo -e "${CYAN}================================================${NC}"
echo ""
echo "📖 Documentation:"
echo "   - Quick Guide: cat QUICK_TEST_GUIDE.md"
echo "   - Full Guide: cat TESTING_WITH_EXOTEL.md"
echo "   - Recent fixes: cat PHASE2_FIXES.md"
echo ""
echo "🔧 Useful commands:"
echo "   - Test webhook: ./scripts/test-webhook.sh"
echo "   - View logs: tail -f logs/app.log"
echo "   - Check DB: sqlite3 database/app.db \"SELECT * FROM calls;\""
echo ""
