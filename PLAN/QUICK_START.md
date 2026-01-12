# 🚀 Quick Start Guide

## Prerequisites Checklist

Before starting, ensure you have the following installed:

### Required Software

| Software | Version | Check Command | Installation |
|----------|---------|---------------|--------------|
| Node.js | 20+ | `node --version` | [nodejs.org](https://nodejs.org) |
| npm | 10+ | `npm --version` | Comes with Node.js |
| Docker Desktop | Latest | `docker --version` | [docker.com](https://docker.com) |
| Git | Latest | `git --version` | [git-scm.com](https://git-scm.com) |

### Required API Keys (Phase 3-4)

| Service | Purpose | Sign Up |
|----------|---------|---------|
| Groq API | Speech-to-text | [console.groq.com](https://console.groq.com) |
| OpenRouter API | LLM inference | [openrouter.ai](https://openrouter.ai) |

### Required for Webhook Testing (Phase 2)

| Software | Purpose | Installation |
|----------|---------|--------------|
| ngrok | Tunnel webhooks | [ngrok.com](https://ngrok.com) |

---

## Step-by-Step Setup

### 1. Clone/Create Project (5 mins)

```bash
# Create project directory
mkdir sales-call-qc
cd sales-call-qc

# Initialize project
npm init -y

# Copy package.json from starter files
# (or copy the provided package.json)

# Install dependencies
npm install
```

### 2. Set Up Environment (5 mins)

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Exotel credentials
nano .env
```

**Required .env values:**
```env
# Server
NODE_ENV=development
PORT=3000

# Database & Queue
DATABASE_PATH=./database/app.db
REDIS_HOST=localhost
REDIS_PORT=6379

# Cloud APIs (Get these from Phase 3-4)
GROQ_API_KEY=your_groq_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### 3. Start Redis (2 mins)

```bash
# Start Redis container
docker-compose up -d

# Verify Redis is running
docker ps

# Test connection
docker exec -it sales-call-qc-redis redis-cli ping
# Should return: PONG
```

### 4. Initialize Database (2 mins)

```bash
# Create database and tables
npm run db:init

# (Optional) Seed with test data
npm run db:seed
```

### 5. Start the Server (1 min)

```bash
# Start in development mode (with auto-reload)
npm run dev

# Or start server and workers together
npm run dev:all
```

**Expected output:**
```
[INFO] Server running on http://localhost:3000
[INFO] Connected to SQLite database
[INFO] Connected to Redis
[INFO] Workers started
```

### 6. Verify Setup

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-08T...","services":{"database":"ok","redis":"ok"}}
```

---

## Setting Up Groq API (Phase 3)

```bash
# 1. Sign up at https://console.groq.com/
# 2. Navigate to API Keys section
# 3. Create a new API key
# 4. Add to your .env file

echo "GROQ_API_KEY=gsk_your_actual_api_key_here" >> .env

# 5. Install Groq SDK
npm install groq-sdk

# 6. Test the API (optional)
node -e "
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
console.log('Groq API configured successfully!');
"
```

**Pricing**: Groq Whisper Large v3 Turbo costs $0.04/hour (~₹3.36/hour)
- For 100 calls/day (5 min avg): ~₹28/day or ~₹830/month

---

## Setting Up OpenRouter API (Phase 4)

```bash
# 1. Sign up at https://openrouter.ai/
# 2. Go to https://openrouter.ai/keys
# 3. Create a new API key
# 4. (Optional) Add credits for paid models, or use free tier

echo "OPENROUTER_API_KEY=sk-or-v1-your_actual_api_key_here" >> .env

# 5. Test the API (optional)
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

**Recommended Models**:
- **DeepSeek V3** (FREE) - Great for development and testing
- **GPT-4o-mini** ($0.15/$0.60 per 1M tokens) - Production quality
- **Claude 3.5 Haiku** ($1.00/$5.00 per 1M tokens) - Best quality

---

## Setting Up ngrok (Phase 2)

```bash
# Sign up at ngrok.com and get auth token

# Install ngrok
# On macOS:
brew install ngrok

# On Linux:
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Authenticate
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this URL in Exotel webhook configuration
```

---

## Exotel Configuration

### 1. Log into Exotel Dashboard

1. Go to [my.exotel.com](https://my.exotel.com)
2. Navigate to **App Bazaar** → **Create App**
3. Set up a new "Voice" app

### 2. Configure Webhook

1. In app settings, find **Status Callback URL**
2. Set URL to: `https://YOUR_NGROK_URL/webhook/exotel/recording`
3. Enable **Call Recording**
4. Save settings

### 3. Get API Credentials

1. Go to **Settings** → **API Settings**
2. Copy:
   - API Key
   - API Token
   - Account SID
3. Add to `.env` file

---

## Quick Test Workflow

### Phase 1 Test

```bash
# Run Phase 1 tests
npm run test:phase1

# Manual verification
curl http://localhost:3000/health
```

### Phase 2 Test (with ngrok)

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000

# Terminal 3: Send test webhook
curl -X POST http://localhost:3000/webhook/exotel/mock \
  -H "Content-Type: application/json" \
  -d '{
    "CallSid": "test_123",
    "CallFrom": "9876543210",
    "CallTo": "8012345678",
    "Direction": "outbound",
    "Duration": 120,
    "RecordingUrl": "https://example.com/test.wav",
    "Status": "completed"
  }'
```

---

## Troubleshooting

### Redis Connection Failed

```bash
# Check if Redis is running
docker ps | grep redis

# Restart Redis
docker-compose restart redis

# Check Redis logs
docker logs sales-call-qc-redis
```

### Database Errors

```bash
# Reset database
npm run db:reset

# Reinitialize
npm run db:init
```

### Groq API Not Working

```bash
# Verify API key is set
echo $GROQ_API_KEY

# Test API directly
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"

# Check for errors in application logs
tail -f logs/app.log | grep -i groq
```

### OpenRouter API Not Working

```bash
# Verify API key is set
echo $OPENROUTER_API_KEY

# Test API directly
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Check rate limits and credits at https://openrouter.ai/activity
```

---

## Next Steps

After completing setup:

1. ✅ Read the full [MVP Development Plan](./AI-Sales-Call-QC-MVP-Development-Plan.md)
2. ✅ Start with Phase 1 implementation
3. ✅ Run phase tests after each phase
4. ✅ Integrate with real Exotel calls in Phase 2

---

## Support

If you encounter issues:

1. Check the error logs: `cat logs/app.log`
2. Verify all services are running: `npm run health:check`
3. Review the troubleshooting section above
