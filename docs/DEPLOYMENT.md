# Sales Call QC - Deployment Guide

This document provides instructions for deploying the Sales Call QC system in different environments.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Environment Configuration](#environment-configuration)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js** >= 20.0.0
- **Redis** >= 6.0 (for job queues)
- **npm** >= 9.0.0

### Required API Keys
- **ElevenLabs API Key** - For audio transcription
- **OpenRouter API Key** - For LLM analysis
- **Telegram Bot Token** (optional) - For notifications

---

## Quick Start (Local Development)

### 1. Clone and Install

```bash
git clone <repository-url>
cd gc-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Initialize Database

```bash
npm run db:init
```

### 4. Start Redis

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or using system Redis
redis-server
```

### 5. Start the Application

```bash
# Development mode (with hot reload)
npm run dev:all

# Production mode
npm start & npm run worker
```

### 6. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed
```

---

## Environment Configuration

### Required Variables

```bash
# Database
DATABASE_PATH=./database/app.db

# Redis (for job queues)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your-redis-password  # If using authentication

# Storage (for audio files)
STORAGE_PATH=./storage
```

### API Keys

```bash
# ElevenLabs (Transcription)
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# OpenRouter (LLM Analysis)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=deepseek/deepseek-chat  # or another model

# Telegram (Notifications) - Optional
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-default-chat-id
```

### Optional Configuration

```bash
# Server
PORT=3000
HOST=localhost
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# Scoring Thresholds
SCORE_THRESHOLD_ALERT=50
SCORE_THRESHOLD_GOOD=70
SCORE_THRESHOLD_EXCELLENT=85

# Notifications
NOTIFICATIONS_ENABLED=true
DAILY_DIGEST_ENABLED=true
DAILY_DIGEST_TIME=09:00

# Organization
DEFAULT_ORG_ID=default
DEFAULT_ORG_NAME=My Organization
```

---

## Production Deployment

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Storage | 10 GB | 50 GB |
| Node.js | 20.x | 20.x LTS |

### 1. Server Setup

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Create app user
sudo useradd -m -s /bin/bash callqc
sudo su - callqc
```

### 2. Application Setup

```bash
# Clone repository
git clone <repository-url> /home/callqc/app
cd /home/callqc/app

# Install dependencies
npm ci --production

# Create directories
mkdir -p database storage logs exports

# Initialize database
npm run db:init

# Set permissions
chmod 750 database storage logs exports
```

### 3. Environment Configuration

```bash
# Create production .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

DATABASE_PATH=/home/callqc/app/database/app.db
STORAGE_PATH=/home/callqc/app/storage
LOG_FILE_PATH=/home/callqc/app/logs/app.log
LOG_LEVEL=info

REDIS_HOST=localhost
REDIS_PORT=6379

ELEVENLABS_API_KEY=your-key
OPENROUTER_API_KEY=your-key
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_CHAT_ID=your-chat-id
EOF

# Secure the file
chmod 600 .env
```

### 4. Systemd Service (Recommended)

Create `/etc/systemd/system/callqc-api.service`:

```ini
[Unit]
Description=Sales Call QC API Server
After=network.target redis.service

[Service]
Type=simple
User=callqc
WorkingDirectory=/home/callqc/app
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/callqc-worker.service`:

```ini
[Unit]
Description=Sales Call QC Background Worker
After=network.target redis.service callqc-api.service

[Service]
Type=simple
User=callqc
WorkingDirectory=/home/callqc/app
ExecStart=/usr/bin/node src/workers/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable callqc-api callqc-worker
sudo systemctl start callqc-api callqc-worker

# Check status
sudo systemctl status callqc-api
sudo systemctl status callqc-worker
```

### 5. Nginx Reverse Proxy (Optional)

Install and configure Nginx:

```nginx
# /etc/nginx/sites-available/callqc
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/callqc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy source
COPY . .

# Create directories
RUN mkdir -p database storage logs exports

# Initialize database
RUN npm run db:init

EXPOSE 3000

CMD ["node", "src/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    env_file:
      - .env
    volumes:
      - ./database:/app/database
      - ./storage:/app/storage
      - ./logs:/app/logs
      - ./exports:/app/exports
    depends_on:
      - redis
    restart: unless-stopped

  worker:
    build: .
    command: node src/workers/index.js
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    env_file:
      - .env
    volumes:
      - ./database:/app/database
      - ./storage:/app/storage
      - ./logs:/app/logs
    depends_on:
      - redis
      - api
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Deploy with Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Basic health
curl http://localhost:3000/health

# Detailed health (includes service status)
curl http://localhost:3000/health/detailed
```

### Logs

```bash
# Application logs
tail -f /home/callqc/app/logs/app.log

# Systemd logs
journalctl -u callqc-api -f
journalctl -u callqc-worker -f
```

### Database Maintenance

```bash
# Backup database
cp database/app.db database/app.db.backup.$(date +%Y%m%d)

# Vacuum (optimize)
sqlite3 database/app.db "VACUUM;"
```

### Performance Benchmarks

```bash
# Run benchmarks
npm run benchmark

# With JSON output
OUTPUT_JSON=benchmark-results.json npm run benchmark
```

### Cleanup Old Data

```bash
# Remove old exports (older than 7 days)
find exports/ -type f -mtime +7 -delete

# Remove old audio files (older than 30 days)
find storage/ -type f -mtime +30 -delete
```

---

## Troubleshooting

### Common Issues

#### Redis Connection Failed
```
Error: Redis connection to localhost:6379 failed
```
**Solution:** Ensure Redis is running
```bash
sudo systemctl status redis-server
sudo systemctl start redis-server
```

#### Database Locked
```
Error: SQLITE_BUSY: database is locked
```
**Solution:** Only one process should write at a time. Check for multiple instances.

#### Transcription API Error
```
Error: ElevenLabs API error: 401 Unauthorized
```
**Solution:** Verify your `ELEVENLABS_API_KEY` is correct and has credits.

#### Analysis API Error
```
Error: OpenRouter API error: 401
```
**Solution:** Verify your `OPENROUTER_API_KEY` is correct.

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

### Reset Everything

```bash
# Reset database (WARNING: deletes all data)
npm run db:reset

# Clear Redis queues
redis-cli FLUSHALL
```

---

## Performance Tuning

### Worker Concurrency

In `src/config/queue.js`:
```javascript
concurrency: {
  download: 2,      // Increase for faster downloads
  transcription: 1, // Keep low (API rate limits)
  analysis: 1,      // Keep low (API rate limits)
  notification: 5,  // Can increase safely
}
```

### Database Optimization

For high-volume deployments:
```bash
# Enable WAL mode
sqlite3 database/app.db "PRAGMA journal_mode=WAL;"

# Increase cache
sqlite3 database/app.db "PRAGMA cache_size=10000;"
```

---

## Support

For issues and questions:
- Check the [API Documentation](/api-docs/api-docs.html)
- Review logs at `logs/app.log`
- Run health checks at `/health/detailed`
