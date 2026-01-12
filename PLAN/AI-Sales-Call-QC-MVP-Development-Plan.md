# AI Sales Call QC - MVP Development Plan
## Zero-Cost Local Development Guide

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Local Development Architecture](#2-local-development-architecture)
3. [Technology Stack (Local vs Production)](#3-technology-stack)
4. [Phase Breakdown](#4-phase-breakdown)
   - Phase 1: Foundation & Infrastructure
   - Phase 2: Call Ingestion Pipeline
   - Phase 3: Transcription Engine
   - Phase 4: AI Analysis Engine
   - Phase 5: Output & Notification Layer
   - Phase 6: Integration & End-to-End Testing
5. [Database Design](#5-database-design)
6. [API Specifications](#6-api-specifications)
7. [Testing Strategy](#7-testing-strategy)
8. [Migration Path to Production](#8-migration-path)

---

## 1. Executive Summary

### Objective
Build a fully functional AI-powered Sales Call QC system that runs **entirely on your local machine** with zero cloud costs during development and testing.

### Key Principles
- **Zero Cost**: All development and testing happens locally
- **Production Ready**: Code structure mirrors production deployment
- **Testable Phases**: Each phase has clear deliverables and test criteria
- **Exotel Ready**: Your existing Exotel account will be integrated from Phase 2

### Local Stack Overview

| Production Service | Local Replacement | Cost |
|-------------------|-------------------|------|
| AWS Lambda | Node.js Express Server | FREE |
| AWS S3 | Local File System (`./storage/`) | FREE |
| AWS RDS PostgreSQL | SQLite / Local PostgreSQL | FREE |
| AWS SQS | BullMQ + Redis (Docker) | FREE |
| Sarvam AI / Whisper | Groq Whisper API | ~$0.04/hour |
| OpenAI GPT | OpenRouter (Multiple LLMs) | Free tier available |
| WhatsApp BSP | Local Mock Server / Console | FREE |
| Google Sheets | Local SQLite + CSV Export | FREE |

---

## 2. Local Development Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOCAL DEVELOPMENT ENVIRONMENT                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────────────────────────────────────────┐ │
│  │   EXOTEL     │     │              YOUR PC (localhost)                  │ │
│  │  (Cloud)     │     │                                                   │ │
│  │              │     │  ┌─────────────┐    ┌─────────────────────────┐  │ │
│  │  Call        │────▶│  │   NGROK     │───▶│    EXPRESS SERVER       │  │ │
│  │  Recording   │     │  │  (Tunnel)   │    │    (Port 3000)          │  │ │
│  │  Webhook     │     │  └─────────────┘    │                         │  │ │
│  └──────────────┘     │                     │  ┌───────────────────┐  │  │ │
│                       │                     │  │ Webhook Handler   │  │  │ │
│                       │                     │  │ /webhook/exotel   │  │  │ │
│                       │                     │  └─────────┬─────────┘  │  │ │
│                       │                     │            │            │  │ │
│                       │                     │            ▼            │  │ │
│                       │                     │  ┌───────────────────┐  │  │ │
│                       │                     │  │   Job Queue       │  │  │ │
│                       │                     │  │   (BullMQ)        │  │  │ │
│                       │                     │  └─────────┬─────────┘  │  │ │
│                       │                     └────────────┼────────────┘  │ │
│                       │                                  │               │ │
│                       │     ┌────────────────────────────┼───────────┐   │ │
│                       │     │        PROCESSING WORKERS              │   │ │
│                       │     │                                        │   │ │
│                       │     │  ┌──────────┐  ┌──────────┐  ┌──────┐ │   │ │
│                       │     │  │Download  │  │Transcribe│  │Analyze│ │   │ │
│                       │     │  │Worker    │─▶│Worker    │─▶│Worker │ │   │ │
│                       │     │  │          │  │(Whisper) │  │(Ollama)│ │   │ │
│                       │     │  └──────────┘  └──────────┘  └──────┘ │   │ │
│                       │     └────────────────────────────────────────┘   │ │
│                       │                                                  │ │
│  ┌──────────────┐     │     ┌────────────────────────────────────────┐   │ │
│  │  LOCAL       │     │     │           DATA LAYER                   │   │ │
│  │  STORAGE     │     │     │                                        │   │ │
│  │              │     │     │  ┌──────────┐     ┌─────────────────┐  │   │ │
│  │  ./storage/  │◀────│─────│  │  SQLite  │     │  Redis (Docker) │  │   │ │
│  │  ├─ audio/   │     │     │  │  Database│     │  Queue Backend  │  │   │ │
│  │  ├─ transcripts│   │     │  └──────────┘     └─────────────────┘  │   │ │
│  │  └─ exports/ │     │     │                                        │   │ │
│  └──────────────┘     │     │  ┌──────────────────────────────────┐ │   │ │
│                       │     │  │ CLOUD APIs (Low-Cost Tier)       │ │   │ │
│                       │     │  │  - Groq Whisper ($0.04/hour)     │ │   │ │
│                       │     │  │  - OpenRouter (Free/Paid models) │ │   │ │
│                       │     │  └──────────────────────────────────┘ │   │ │
│                       │     └────────────────────────────────────────┘   │ │
│                       │                                                  │ │
│                       │     ┌────────────────────────────────────────┐   │ │
│                       │     │           OUTPUT LAYER                 │   │ │
│                       │     │                                        │   │ │
│                       │     │  ┌──────────┐     ┌─────────────────┐  │   │ │
│                       │     │  │  CSV     │     │  Console/Mock   │  │   │ │
│                       │     │  │  Export  │     │  WhatsApp       │  │   │ │
│                       │     │  └──────────┘     └─────────────────┘  │   │ │
│                       │     └────────────────────────────────────────┘   │ │
│                       └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CALL PROCESSING PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

     STEP 1              STEP 2              STEP 3              STEP 4
  ┌─────────┐        ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ INGEST  │        │ TRANSCRIBE  │     │  ANALYZE    │     │   OUTPUT    │
  │         │        │             │     │             │     │             │
  │ Exotel  │───────▶│ Groq Whisper│────▶│ OpenRouter  │────▶│ CSV/Excel   │
  │ Webhook │        │ API (Cloud) │     │ API (Cloud) │     │ WhatsApp    │
  │         │        │             │     │             │     │ Dashboard   │
  └────┬────┘        └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                   │                   │
       ▼                    ▼                   ▼                   ▼
  ┌─────────┐        ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ call    │        │ transcript  │     │  analysis   │     │notification │
  │ record  │        │  + segments │     │  + scores   │     │  record     │
  │ (DB)    │        │  (DB)       │     │  (DB)       │     │  (DB)       │
  └─────────┘        └─────────────┘     └─────────────┘     └─────────────┘
       │                    │                   │                   │
       └────────────────────┴───────────────────┴───────────────────┘
                                    │
                              ┌─────▼─────┐
                              │  SQLite   │
                              │  Database │
                              └───────────┘
```

---

## 3. Technology Stack

### Complete Stack Comparison

| Layer | Local Development | Production (AWS) | Migration Effort |
|-------|------------------|------------------|------------------|
| **Runtime** | Node.js 20 LTS | Node.js 20 LTS | None |
| **Framework** | Express.js | Express.js (Lambda) | Minimal |
| **Database** | SQLite3 | PostgreSQL (RDS) | Schema migration |
| **Queue** | BullMQ + Redis | AWS SQS | Queue abstraction |
| **Storage** | Local filesystem | AWS S3 | Storage abstraction |
| **STT** | Groq Whisper API | Groq Whisper API | None (same API) |
| **LLM** | OpenRouter API | OpenRouter API | None (same API) |
| **Tunnel** | ngrok (free tier) | API Gateway | N/A |
| **WhatsApp** | Mock console | Interakt/AiSensy | API integration |

### Required Software Installation

```bash
# Core Runtime
Node.js 20 LTS          # JavaScript runtime
npm / yarn              # Package manager

# Database & Queue
Docker Desktop          # For Redis container
SQLite3                 # Lightweight database (built into Node)

# Cloud API Credentials (Development)
Groq API Key            # For Whisper transcription
OpenRouter API Key      # For LLM analysis

# Development Tools
ngrok                   # Tunnel for webhooks
Postman / Insomnia      # API testing
VS Code                 # Code editor
```

---

## 4. Phase Breakdown

---

### PHASE 1: Foundation & Infrastructure
**Duration: 3-4 days | Complexity: Low**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 1 SCOPE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                     PROJECT STRUCTURE                              │    │
│   │                                                                    │    │
│   │   sales-call-qc/                                                   │    │
│   │   ├── src/                                                         │    │
│   │   │   ├── config/           # Configuration management             │    │
│   │   │   ├── controllers/      # Route handlers                       │    │
│   │   │   ├── services/         # Business logic                       │    │
│   │   │   ├── workers/          # Background job processors            │    │
│   │   │   ├── models/           # Database models                      │    │
│   │   │   ├── utils/            # Helper functions                     │    │
│   │   │   └── index.js          # Application entry point              │    │
│   │   ├── storage/              # Local file storage                   │    │
│   │   │   ├── audio/            # Call recordings                      │    │
│   │   │   ├── transcripts/      # JSON transcripts                     │    │
│   │   │   └── exports/          # CSV/Excel exports                    │    │
│   │   ├── database/             # SQLite database files                │    │
│   │   ├── tests/                # Test files                           │    │
│   │   ├── scripts/              # Utility scripts                      │    │
│   │   ├── docker-compose.yml    # Redis container                      │    │
│   │   ├── .env.example          # Environment template                 │    │
│   │   └── package.json          # Dependencies                         │    │
│   │                                                                    │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│   DELIVERABLES:                                                             │
│   ✓ Project scaffolding complete                                           │
│   ✓ SQLite database with all tables                                        │
│   ✓ Redis running in Docker                                                │
│   ✓ Express server with health check endpoint                              │
│   ✓ Environment configuration system                                       │
│   ✓ Basic logging setup                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 1.1 Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1.1.1 | Initialize Node.js project with TypeScript/JavaScript | 30 min |
| 1.1.2 | Set up folder structure | 30 min |
| 1.1.3 | Configure Docker Compose for Redis | 30 min |
| 1.1.4 | Create SQLite database schema | 2 hrs |
| 1.1.5 | Set up Express server with middleware | 1 hr |
| 1.1.6 | Configure environment variables system | 30 min |
| 1.1.7 | Set up BullMQ queue system | 1 hr |
| 1.1.8 | Create basic logging with Winston | 30 min |

#### 1.2 Database Schema (SQLite)

```sql
-- Organizations (multi-tenant ready)
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    settings TEXT DEFAULT '{}',  -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users (agents and managers)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT CHECK(role IN ('agent', 'manager', 'admin')) DEFAULT 'agent',
    whatsapp_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Calls
CREATE TABLE calls (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT,
    exotel_call_sid TEXT UNIQUE,
    recording_url TEXT,
    local_audio_path TEXT,
    duration_seconds INTEGER,
    call_type TEXT,
    caller_number TEXT,
    callee_number TEXT,
    direction TEXT CHECK(direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id),
    FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- Transcripts
CREATE TABLE transcripts (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL UNIQUE,
    content TEXT,  -- Full transcript text
    language TEXT,
    speaker_segments TEXT,  -- JSON array of segments
    word_count INTEGER,
    stt_provider TEXT,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES calls(id)
);

-- Analyses
CREATE TABLE analyses (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL UNIQUE,
    overall_score REAL,
    category_scores TEXT,  -- JSON
    issues TEXT,  -- JSON array
    recommendations TEXT,  -- JSON array
    summary TEXT,
    sentiment TEXT,
    llm_model TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES calls(id)
);

-- Notifications
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    call_id TEXT,
    user_id TEXT,
    channel TEXT CHECK(channel IN ('whatsapp', 'email', 'console')),
    message TEXT,
    status TEXT DEFAULT 'pending',
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES calls(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Job logs for debugging
CREATE TABLE job_logs (
    id TEXT PRIMARY KEY,
    job_type TEXT,
    job_id TEXT,
    status TEXT,
    input_data TEXT,
    output_data TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_calls_org_id ON calls(org_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created_at ON calls(created_at);
CREATE INDEX idx_transcripts_call_id ON transcripts(call_id);
CREATE INDEX idx_analyses_call_id ON analyses(call_id);
CREATE INDEX idx_analyses_overall_score ON analyses(overall_score);
```

#### 1.3 Test Criteria (Phase 1 Gate)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1 - TEST CHECKLIST                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  □ Server starts without errors on port 3000                               │
│  □ GET /health returns { status: "ok", timestamp: "..." }                  │
│  □ Redis connection successful (docker-compose up)                         │
│  □ SQLite database created with all tables                                 │
│  □ Can INSERT and SELECT from all tables                                   │
│  □ BullMQ can add and process a test job                                   │
│  □ Environment variables loading correctly                                 │
│  □ Logs writing to console and file                                        │
│                                                                             │
│  RUN: npm test:phase1                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 2: Call Ingestion Pipeline
**Duration: 4-5 days | Complexity: Medium**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 2 SCOPE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     EXOTEL WEBHOOK INTEGRATION                              │
│                                                                             │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                │
│   │   EXOTEL    │      │   NGROK     │      │  EXPRESS    │                │
│   │   Cloud     │─────▶│   Tunnel    │─────▶│  /webhook   │                │
│   │             │      │             │      │  /exotel    │                │
│   └─────────────┘      └─────────────┘      └──────┬──────┘                │
│                                                    │                        │
│                                                    ▼                        │
│                                           ┌───────────────┐                 │
│                                           │  Validate     │                 │
│                                           │  Signature    │                 │
│                                           └───────┬───────┘                 │
│                                                   │                         │
│                                                   ▼                         │
│                                           ┌───────────────┐                 │
│                                           │ Create Call   │                 │
│                                           │ Record (DB)   │                 │
│                                           └───────┬───────┘                 │
│                                                   │                         │
│                                                   ▼                         │
│                                           ┌───────────────┐                 │
│                                           │ Queue Download│                 │
│                                           │ Job (BullMQ)  │                 │
│                                           └───────┬───────┘                 │
│                                                   │                         │
│                                                   ▼                         │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                     DOWNLOAD WORKER                                │    │
│   │                                                                    │    │
│   │   1. Fetch audio from Exotel recording URL                        │    │
│   │   2. Save to ./storage/audio/{org_id}/{call_id}.wav               │    │
│   │   3. Update call record with local path                           │    │
│   │   4. Queue transcription job                                      │    │
│   │                                                                    │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│   DELIVERABLES:                                                             │
│   ✓ Exotel webhook endpoint with signature validation                      │
│   ✓ ngrok tunnel setup for local testing                                   │
│   ✓ Audio download worker                                                  │
│   ✓ Local file storage system                                              │
│   ✓ Mock webhook for testing without Exotel                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2.1 Exotel Webhook Payload (Reference)

```json
{
  "CallSid": "unique-call-id-from-exotel",
  "CallFrom": "09876543210",
  "CallTo": "08012345678",
  "Direction": "outbound",
  "Created": "2025-01-08T10:30:00Z",
  "Duration": 245,
  "RecordingUrl": "https://s3.exotel.com/recordings/...",
  "Status": "completed",
  "CustomField": "agent_123"
}
```

#### 2.2 Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| 2.2.1 | Create Exotel webhook controller | 2 hrs |
| 2.2.2 | Implement webhook signature validation | 1 hr |
| 2.2.3 | Set up ngrok tunnel with persistent URL | 30 min |
| 2.2.4 | Create download worker with retry logic | 3 hrs |
| 2.2.5 | Implement local file storage service | 2 hrs |
| 2.2.6 | Create mock webhook endpoint for testing | 1 hr |
| 2.2.7 | Configure Exotel webhook URL in dashboard | 30 min |
| 2.2.8 | Write integration tests | 2 hrs |

#### 2.3 Test Criteria (Phase 2 Gate)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2 - TEST CHECKLIST                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LOCAL TESTS (without Exotel):                                             │
│  □ POST /webhook/exotel/mock creates call record                           │
│  □ Download worker processes queued jobs                                   │
│  □ Audio files saved to ./storage/audio/                                   │
│  □ Invalid webhook signatures rejected (401)                               │
│  □ Duplicate CallSid handled gracefully                                    │
│                                                                             │
│  INTEGRATION TESTS (with Exotel):                                          │
│  □ ngrok tunnel accessible from internet                                   │
│  □ Exotel test call triggers webhook                                       │
│  □ Real recording downloaded successfully                                  │
│  □ Call record created with correct metadata                               │
│                                                                             │
│  RUN: npm test:phase2                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 3: Transcription Engine
**Duration: 2-3 days | Complexity: Medium** (Simplified with Groq API)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 3 SCOPE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     CLOUD SPEECH-TO-TEXT (GROQ WHISPER)                     │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    TRANSCRIPTION WORKER                              │  │
│   │                                                                      │  │
│   │   INPUT                      PROCESS                    OUTPUT       │  │
│   │   ┌─────────┐               ┌─────────┐               ┌─────────┐   │  │
│   │   │ Audio   │               │  Groq   │               │Transcript│   │  │
│   │   │ File    │──────────────▶│ Whisper │──────────────▶│  JSON    │   │  │
│   │   │ (.wav)  │               │ v3 Turbo│               │          │   │  │
│   │   └─────────┘               └─────────┘               └─────────┘   │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   GROQ WHISPER MODEL OPTIONS:                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   Model                 Speed        Accuracy    Cost/hour           │  │
│   │   ────────────────────────────────────────────────────────────      │  │
│   │   Distil-Whisper       240x RT      Good        $0.02 (English)     │  │
│   │   Whisper Large v3     ~150x RT     Best        $0.111              │  │
│   │   Whisper v3 Turbo     216x RT      Excellent   $0.04  ← RECOMMENDED│  │
│   │                                                                      │  │
│   │   RT = Real-time (216x means 1 min audio = 0.28 sec process)        │  │
│   │   All models support Hindi, English, and Hinglish                   │  │
│   │   No local resources required - runs in cloud                       │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   OUTPUT FORMAT:                                                            │
│   {                                                                         │
│     "text": "Full transcript...",                                          │
│     "language": "hi",                                                       │
│     "segments": [                                                           │
│       {                                                                     │
│         "start": 0.0,                                                       │
│         "end": 3.5,                                                         │
│         "text": "Hello, this is...",                                       │
│         "speaker": "agent"  // Added by diarization                        │
│       }                                                                     │
│     ]                                                                       │
│   }                                                                         │
│                                                                             │
│   DELIVERABLES:                                                             │
│   ✓ Groq API integration with Whisper v3 Turbo                             │
│   ✓ Transcription worker with queue processing                             │
│   ✓ Automatic language detection (Hindi/English/Hinglish)                  │
│   ✓ Speaker diarization via Groq API features                              │
│   ✓ Transcript storage in database                                         │
│   ✓ API endpoint to get transcript                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 Groq Whisper API Setup

**Getting Started with Groq:**

```bash
# 1. Sign up at https://console.groq.com/
# 2. Create API key from dashboard
# 3. Add to .env file

echo "GROQ_API_KEY=your_api_key_here" >> .env
```

**Example API Usage:**

```javascript
// Using Groq SDK
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function transcribeAudio(audioFilePath) {
  const transcription = await groq.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: 'whisper-large-v3-turbo',
    language: 'hi', // Auto-detects if omitted
    response_format: 'verbose_json', // Includes timestamps
  });

  return transcription;
}
```

**No local installation required - just API calls!**

#### 3.1.1 Complete Groq API Reference

**Official Documentation:**
- API Docs: https://console.groq.com/docs/api-reference
- Speech-to-Text: https://console.groq.com/docs/speech-to-text
- SDK GitHub: https://github.com/groq/groq-javascript
- Supported Models: https://console.groq.com/docs/models

**Installation:**
```bash
npm install groq-sdk
# or
yarn add groq-sdk
```

**Complete Integration Example:**

```javascript
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

class GroqTranscriptionService {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }

  /**
   * Transcribe audio file using Groq Whisper API
   * @param {string} audioFilePath - Absolute path to audio file
   * @param {object} options - Transcription options
   * @returns {Promise<object>} Transcription result
   */
  async transcribe(audioFilePath, options = {}) {
    try {
      const transcription = await this.groq.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: options.model || 'whisper-large-v3-turbo',

        // Optional parameters
        language: options.language, // 'en', 'hi', etc. (omit for auto-detect)
        prompt: options.prompt, // Context to improve accuracy
        response_format: options.responseFormat || 'verbose_json', // 'json', 'text', 'srt', 'vtt', 'verbose_json'
        temperature: options.temperature || 0, // 0-1, higher = more creative
        timestamp_granularities: options.timestampGranularities || ['segment'] // ['segment', 'word']
      });

      return this.parseTranscription(transcription);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Parse Groq transcription response
   */
  parseTranscription(transcription) {
    return {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments?.map(seg => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        tokens: seg.tokens,
        temperature: seg.temperature,
        avg_logprob: seg.avg_logprob,
        compression_ratio: seg.compression_ratio,
        no_speech_prob: seg.no_speech_prob
      })),
      words: transcription.words?.map(word => ({
        word: word.word,
        start: word.start,
        end: word.end
      }))
    };
  }

  /**
   * Handle Groq API errors
   */
  handleError(error) {
    if (error.status === 401) {
      return new Error('Invalid Groq API key');
    }
    if (error.status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.status === 400) {
      return new Error(`Bad request: ${error.message}`);
    }
    return new Error(`Groq API error: ${error.message}`);
  }

  /**
   * Check if audio file is supported
   */
  isSupportedFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedFormats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a',
                             '.wav', '.webm', '.flac', '.ogg'];
    return supportedFormats.includes(ext);
  }

  /**
   * Get estimated cost for transcription
   * @param {number} durationSeconds - Audio duration in seconds
   * @returns {object} Cost estimation
   */
  getEstimatedCost(durationSeconds, model = 'whisper-large-v3-turbo') {
    const costs = {
      'distil-whisper-large-v3-en': 0.02 / 3600, // per second
      'whisper-large-v3': 0.111 / 3600,
      'whisper-large-v3-turbo': 0.04 / 3600
    };

    const costPerSecond = costs[model] || costs['whisper-large-v3-turbo'];
    const estimatedCost = durationSeconds * costPerSecond;

    return {
      model,
      durationSeconds,
      durationMinutes: (durationSeconds / 60).toFixed(2),
      estimatedCostUSD: estimatedCost.toFixed(4),
      estimatedCostINR: (estimatedCost * 84).toFixed(2) // Approx conversion
    };
  }
}

module.exports = GroqTranscriptionService;
```

**Response Format Examples:**

1. **verbose_json** (Recommended - includes timestamps):
```json
{
  "task": "transcribe",
  "language": "hi",
  "duration": 245.6,
  "text": "नमस्ते, मैं XYZ कंपनी से बोल रहा हूं...",
  "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 0.0,
      "end": 3.5,
      "text": " नमस्ते, मैं XYZ कंपनी से बोल रहा हूं",
      "tokens": [50364, 1234, 5678, 50564],
      "temperature": 0.0,
      "avg_logprob": -0.25,
      "compression_ratio": 1.2,
      "no_speech_prob": 0.01
    }
  ],
  "words": [
    {"word": "नमस्ते", "start": 0.0, "end": 0.5},
    {"word": "मैं", "start": 0.6, "end": 0.8}
  ]
}
```

2. **json** (Simple):
```json
{
  "text": "नमस्ते, मैं XYZ कंपनी से बोल रहा हूं..."
}
```

**Error Handling:**

```javascript
async function transcribeWithRetry(filePath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await groqService.transcribe(filePath);
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

**Supported Audio Formats:**
- MP3, MP4, MPEG, MPGA, M4A
- WAV, WEBM
- FLAC, OGG

**File Size Limits:**
- Maximum: 25 MB per file
- For larger files, split or compress before sending

**Rate Limits:**
- Free tier: Check console.groq.com for current limits
- Paid tier: Higher limits based on plan

#### 3.2 Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| 3.2.1 | Set up Groq account and obtain API key | 15 min |
| 3.2.2 | Install Groq SDK and configure environment | 30 min |
| 3.2.3 | Create Groq Whisper service wrapper | 2 hrs |
| 3.2.4 | Implement transcription worker | 3 hrs |
| 3.2.5 | Add error handling and retry logic | 1 hr |
| 3.2.6 | Create transcript storage service | 2 hrs |
| 3.2.7 | Build GET /api/calls/:id/transcript endpoint | 1 hr |
| 3.2.8 | Test with Hindi, English, and Hinglish audio | 2 hrs |
| 3.2.9 | Write unit and integration tests | 2 hrs |

**Time Saved:** ~10 hours compared to local Whisper setup

#### 3.3 Speaker Diarization Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SPEAKER DIARIZATION APPROACH                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For MVP, use timestamp-based heuristics with Groq's segment data:         │
│                                                                             │
│  1. GROQ WHISPER TIMESTAMPS                                                 │
│     - Groq provides word-level timestamps in verbose_json mode             │
│     - Use pause detection to identify speaker turns                        │
│                                                                             │
│  2. TURN-BASED DETECTION                                                    │
│     - First speaker is usually Agent (outbound calls)                      │
│     - Alternate speakers on significant pauses (>1.5 sec)                  │
│                                                                             │
│  3. PATTERN MATCHING (Fallback)                                             │
│     - Agent patterns: "Hi, I'm calling from...", "How can I help..."       │
│     - Customer patterns: "Yes", "No", "Tell me more..."                    │
│                                                                             │
│  ADVANCED (Post-MVP):                                                       │
│  - Integrate Pyannote.audio or Deepgram diarization                        │
│  - Use AssemblyAI's speaker diarization API                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3.4 Test Criteria (Phase 3 Gate)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 3 - TEST CHECKLIST                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  UNIT TESTS:                                                               │
│  □ Groq API service returns transcript for English audio                   │
│  □ Groq API service returns transcript for Hindi audio                     │
│  □ Groq API service handles Hinglish (code-mixed) audio                    │
│  □ Speaker segments have start/end timestamps                              │
│  □ Error handling works for API failures                                   │
│                                                                             │
│  INTEGRATION TESTS:                                                        │
│  □ Audio file queued → Groq API called → transcript saved to DB            │
│  □ GET /api/calls/:id/transcript returns correct data                      │
│  □ Worker handles 10+ minute audio files                                   │
│  □ Worker retries on API failures                                          │
│                                                                             │
│  PERFORMANCE TESTS:                                                        │
│  □ 5-minute audio transcribed in < 10 seconds (Groq Turbo)                 │
│  □ API costs tracked and logged                                            │
│                                                                             │
│  RUN: npm test:phase3                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 4: AI Analysis Engine
**Duration: 2-3 days | Complexity: Medium** (Simplified with OpenRouter API)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 4 SCOPE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     CLOUD LLM ANALYSIS (OPENROUTER)                         │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                      ANALYSIS PIPELINE                               │  │
│   │                                                                      │  │
│   │   ┌───────────┐     ┌───────────────┐     ┌───────────────┐         │  │
│   │   │Transcript │────▶│ Prompt        │────▶│  OpenRouter   │         │  │
│   │   │  (JSON)   │     │ Builder       │     │  (Any LLM)    │         │  │
│   │   └───────────┘     └───────────────┘     └───────┬───────┘         │  │
│   │                                                   │                  │  │
│   │                                                   ▼                  │  │
│   │                                           ┌───────────────┐         │  │
│   │                                           │  JSON Parser  │         │  │
│   │                                           │  (Structured) │         │  │
│   │                                           └───────┬───────┘         │  │
│   │                                                   │                  │  │
│   │                                                   ▼                  │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │                    ANALYSIS OUTPUT                           │   │  │
│   │   │                                                              │   │  │
│   │   │   {                                                          │   │  │
│   │   │     "overall_score": 72,                                     │   │  │
│   │   │     "category_scores": {                                     │   │  │
│   │   │       "greeting": { "score": 85, "feedback": "..." },        │   │  │
│   │   │       "need_discovery": { "score": 65, "feedback": "..." },  │   │  │
│   │   │       "product_presentation": { "score": 70, "feedback": ".."}│   │  │
│   │   │       "objection_handling": { "score": 75, "feedback": "..." }│   │  │
│   │   │       "closing": { "score": 68, "feedback": "..." }          │   │  │
│   │   │     },                                                       │   │  │
│   │   │     "issues": [                                              │   │  │
│   │   │       { "type": "missed_opportunity", "detail": "..." }      │   │  │
│   │   │     ],                                                       │   │  │
│   │   │     "recommendations": [                                     │   │  │
│   │   │       "Ask more open-ended questions...",                    │   │  │
│   │   │       "Use customer's name more frequently..."               │   │  │
│   │   │     ],                                                       │   │  │
│   │   │     "summary": "The agent demonstrated..."                   │   │  │
│   │   │   }                                                          │   │  │
│   │   │                                                              │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   OPENROUTER MODEL OPTIONS:                                                 │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   Model              Cost/1M tokens  Quality     Speed              │  │
│   │   ──────────────────────────────────────────────────────────────   │  │
│   │   DeepSeek-V3        FREE           Very Good   Fast ← RECOMMENDED  │  │
│   │   Mistral 7B Free    FREE           Good        Fast                │  │
│   │   GPT-4o-mini        $0.15/$0.60    Excellent   Fast                │  │
│   │   Claude 3.5 Haiku   $1.00/$5.00    Excellent   Very Fast           │  │
│   │   Llama 3.1 70B      $0.18/$0.18    Very Good   Medium              │  │
│   │   GPT-4o             $2.50/$10.00   Best        Medium              │  │
│   │                                                                      │  │
│   │   No local resources required - switch models anytime via API       │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   DELIVERABLES:                                                             │
│   ✓ OpenRouter API integration with configurable models                    │
│   ✓ Scoring prompt template (configurable)                                 │
│   ✓ Analysis worker with structured output parsing                         │
│   ✓ Score threshold alerting logic                                         │
│   ✓ API endpoint for analysis results                                      │
│   ✓ Re-analysis capability with different models/prompts                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1 OpenRouter API Setup

**Getting Started with OpenRouter:**

```bash
# 1. Sign up at https://openrouter.ai/
# 2. Add credits (or use free tier models)
# 3. Get API key from https://openrouter.ai/keys
# 4. Add to .env file

echo "OPENROUTER_API_KEY=your_api_key_here" >> .env
```

**Example API Usage:**

```javascript
// Using OpenRouter SDK
const fetch = require('node-fetch');

async function analyzeTranscript(transcript) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000', // Optional
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat', // Free tier model
      messages: [
        { role: 'system', content: 'You are a sales call quality analyst.' },
        { role: 'user', content: `Analyze this call:\n${transcript}` }
      ],
      response_format: { type: 'json_object' } // For structured output
    })
  });

  return await response.json();
}
```

**No local installation required - just API calls!**

#### 4.1.1 Complete OpenRouter API Reference

**Official Documentation:**
- API Docs: https://openrouter.ai/docs/api-reference
- Models List: https://openrouter.ai/models
- Quick Start: https://openrouter.ai/docs/quickstart
- Provider Routing: https://openrouter.ai/docs/provider-routing
- Pricing: https://openrouter.ai/pricing

**Installation:**
```bash
# OpenRouter uses OpenAI-compatible API, so you can use:
npm install openai
# or use fetch/axios directly (no SDK required)
npm install node-fetch
```

**Complete Integration Example:**

```javascript
const fetch = require('node-fetch');

class OpenRouterAnalysisService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.defaultModel = 'deepseek/deepseek-chat'; // Free tier
  }

  /**
   * Analyze transcript using OpenRouter
   * @param {string} transcript - Call transcript text
   * @param {object} options - Analysis options
   * @returns {Promise<object>} Analysis result
   */
  async analyzeTranscript(transcript, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': options.referer || 'http://localhost:3000',
          'X-Title': options.appTitle || 'Sales Call QC System'
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: this.buildAnalysisPrompt(transcript)
            }
          ],

          // Optional parameters
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0,

          // OpenRouter-specific
          response_format: { type: 'json_object' }, // Force JSON output
          provider: options.provider, // Optional: force specific provider
          route: options.route || 'fallback' // 'fallback' or 'none'
        })
      });

      if (!response.ok) {
        throw await this.handleHttpError(response);
      }

      const data = await response.json();
      return this.parseAnalysisResponse(data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get system prompt for analysis
   */
  getSystemPrompt() {
    return `You are a professional sales call quality analyst. Analyze sales calls and provide structured feedback in JSON format. Focus on:
1. Communication quality
2. Sales technique effectiveness
3. Customer engagement
4. Objection handling
5. Closing effectiveness

Always respond with valid JSON matching the expected schema.`;
  }

  /**
   * Build analysis prompt with transcript
   */
  buildAnalysisPrompt(transcript) {
    return `Analyze this sales call transcript and provide a quality assessment.

TRANSCRIPT:
${transcript}

Respond with a JSON object containing:
{
  "overall_score": <number 0-100>,
  "category_scores": {
    "greeting": {"score": <0-100>, "feedback": "<string>"},
    "need_discovery": {"score": <0-100>, "feedback": "<string>"},
    "product_presentation": {"score": <0-100>, "feedback": "<string>"},
    "objection_handling": {"score": <0-100>, "feedback": "<string>"},
    "closing": {"score": <0-100>, "feedback": "<string>"}
  },
  "issues": [
    {"type": "<string>", "severity": "<low|medium|high>", "detail": "<string>"}
  ],
  "recommendations": ["<string>", "<string>"],
  "summary": "<2-3 sentence summary>",
  "sentiment": "<positive|neutral|negative>",
  "customer_satisfaction_prediction": "<low|medium|high>"
}`;
  }

  /**
   * Parse OpenRouter response
   */
  parseAnalysisResponse(data) {
    const content = data.choices[0].message.content;
    const analysis = JSON.parse(content);

    // Add metadata from OpenRouter response
    return {
      ...analysis,
      metadata: {
        model: data.model,
        provider: data.provider,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens
        },
        cost: this.calculateCost(data)
      }
    };
  }

  /**
   * Calculate cost based on usage
   */
  calculateCost(data) {
    // Costs per 1M tokens (approximate, check openrouter.ai/models for exact)
    const modelCosts = {
      'deepseek/deepseek-chat': { prompt: 0, completion: 0 }, // Free
      'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
      'anthropic/claude-3.5-haiku': { prompt: 1.00, completion: 5.00 },
      'openai/gpt-4o': { prompt: 2.50, completion: 10.00 }
    };

    const costs = modelCosts[data.model] || { prompt: 0, completion: 0 };
    const promptCost = (data.usage?.prompt_tokens / 1000000) * costs.prompt;
    const completionCost = (data.usage?.completion_tokens / 1000000) * costs.completion;

    return {
      promptCostUSD: promptCost.toFixed(6),
      completionCostUSD: completionCost.toFixed(6),
      totalCostUSD: (promptCost + completionCost).toFixed(6),
      totalCostINR: ((promptCost + completionCost) * 84).toFixed(4)
    };
  }

  /**
   * Handle HTTP errors
   */
  async handleHttpError(response) {
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return new Error('Invalid OpenRouter API key');
    }
    if (response.status === 402) {
      return new Error('Insufficient credits. Add credits at openrouter.ai');
    }
    if (response.status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 400) {
      return new Error(`Bad request: ${errorData.error?.message || 'Unknown error'}`);
    }

    return new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
  }

  /**
   * Handle general errors
   */
  handleError(error) {
    if (error.code === 'ECONNREFUSED') {
      return new Error('Cannot connect to OpenRouter API. Check internet connection.');
    }
    return error;
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      return data.data.map(model => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing,
        context_length: model.context_length
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Stream response (for real-time analysis)
   */
  async analyzeTranscriptStream(transcript, onChunk, options = {}) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': options.referer || 'http://localhost:3000'
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: this.buildAnalysisPrompt(transcript) }
        ],
        stream: true
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

module.exports = OpenRouterAnalysisService;
```

**Example Usage:**

```javascript
const service = new OpenRouterAnalysisService();

// Basic analysis
const result = await service.analyzeTranscript(transcriptText, {
  model: 'openai/gpt-4o-mini', // or 'deepseek/deepseek-chat' for free
  temperature: 0.7
});

console.log('Overall Score:', result.overall_score);
console.log('Cost:', result.metadata.cost.totalCostUSD);

// Streaming analysis (for real-time feedback)
await service.analyzeTranscriptStream(
  transcriptText,
  (chunk) => console.log('Received:', chunk),
  { model: 'openai/gpt-4o-mini' }
);
```

**Available Models (Popular Choices):**

```javascript
const recommendedModels = {
  // FREE TIER
  free: {
    'deepseek/deepseek-chat': 'Fast, good quality, FREE',
    'mistralai/mistral-7b-instruct:free': 'Decent quality, FREE',
    'nousresearch/hermes-3-llama-3.1-405b:free': 'High quality, FREE'
  },

  // BUDGET TIER ($0.10-0.50 per 1M tokens)
  budget: {
    'openai/gpt-4o-mini': 'Excellent value, $0.15/$0.60',
    'anthropic/claude-3-haiku': 'Fast and cheap, $0.25/$1.25',
    'meta-llama/llama-3.1-70b-instruct': 'Good quality, $0.18/$0.18'
  },

  // PREMIUM TIER ($1-10 per 1M tokens)
  premium: {
    'openai/gpt-4o': 'Best quality, $2.50/$10.00',
    'anthropic/claude-3.5-sonnet': 'Excellent reasoning, $3.00/$15.00',
    'anthropic/claude-3-opus': 'Top tier, $15.00/$75.00'
  }
};
```

**Error Handling with Retry:**

```javascript
async function analyzeWithRetry(transcript, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await service.analyzeTranscript(transcript);
    } catch (error) {
      if (error.message.includes('Rate limit') && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (error.message.includes('Insufficient credits')) {
        // Switch to free model
        return await service.analyzeTranscript(transcript, {
          model: 'deepseek/deepseek-chat'
        });
      }

      throw error;
    }
  }
}
```

**Provider Routing:**

```javascript
// OpenRouter can route to multiple providers for redundancy
const options = {
  route: 'fallback', // Try fallback providers if primary fails
  models: [
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-haiku',
    'deepseek/deepseek-chat' // Free fallback
  ]
};
```

**Token Limits:**
- Check each model's context length at openrouter.ai/models
- Most models: 4K-128K tokens
- Plan accordingly for long transcripts

**Cost Optimization Tips:**
1. Start with free models (DeepSeek) for development
2. Use GPT-4o-mini for production (good balance)
3. Reserve premium models for complex cases
4. Monitor costs via OpenRouter dashboard
5. Implement caching for repeated analyses

#### 4.2 Scoring Prompt Template

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUALITY SCORING PROMPT                               │
├─────────────────────────────────────────────────────────────────────────────┤

You are a sales call quality analyst. Analyze the following sales call 
transcript and provide a detailed quality assessment.

TRANSCRIPT:
{transcript}

SCORING RUBRIC:
1. Greeting & Introduction (15%): Professional greeting, self-introduction, 
   company introduction, rapport building
2. Need Discovery (25%): Open-ended questions, active listening, pain point 
   identification, qualification questions
3. Product Presentation (20%): Feature-benefit mapping, customization to needs, 
   clarity of explanation, handling of technical details
4. Objection Handling (20%): Acknowledgment of concerns, empathy, effective 
   reframing, persistence without aggression
5. Closing & Next Steps (20%): Clear call-to-action, urgency creation, 
   follow-up commitment, documentation of outcomes

OUTPUT FORMAT (JSON only, no other text):
{
  "overall_score": <0-100>,
  "category_scores": {
    "greeting": { "score": <0-100>, "feedback": "<specific feedback>" },
    "need_discovery": { "score": <0-100>, "feedback": "<specific feedback>" },
    "product_presentation": { "score": <0-100>, "feedback": "<specific feedback>" },
    "objection_handling": { "score": <0-100>, "feedback": "<specific feedback>" },
    "closing": { "score": <0-100>, "feedback": "<specific feedback>" }
  },
  "issues": [
    { "type": "<issue_type>", "severity": "<low|medium|high>", "detail": "<description>" }
  ],
  "recommendations": ["<actionable recommendation 1>", "<recommendation 2>"],
  "summary": "<2-3 sentence overall assessment>",
  "sentiment": "<positive|neutral|negative>",
  "customer_satisfaction_prediction": "<low|medium|high>"
}

└─────────────────────────────────────────────────────────────────────────────┘
```

#### 4.3 Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| 4.3.1 | Set up OpenRouter account and obtain API key | 15 min |
| 4.3.2 | Test free tier models (DeepSeek, Mistral) | 30 min |
| 4.3.3 | Create OpenRouter service wrapper | 2 hrs |
| 4.3.4 | Design scoring prompt template | 3 hrs |
| 4.3.5 | Implement analysis worker | 3 hrs |
| 4.3.6 | Build JSON output parser with validation | 2 hrs |
| 4.3.7 | Create analysis storage service | 1 hr |
| 4.3.8 | Build GET /api/calls/:id/analysis endpoint | 1 hr |
| 4.3.9 | Implement POST /api/calls/:id/reanalyze | 2 hrs |
| 4.3.10 | Add configurable model selection | 1 hr |
| 4.3.11 | Write tests with sample transcripts | 2 hrs |

**Time Saved:** ~8 hours compared to local Ollama setup

#### 4.4 Test Criteria (Phase 4 Gate)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 4 - TEST CHECKLIST                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  UNIT TESTS:                                                               │
│  □ OpenRouter API service connects and responds                            │
│  □ Free tier models (DeepSeek) work correctly                              │
│  □ Prompt builder correctly inserts transcript                             │
│  □ JSON parser handles valid and invalid responses                         │
│  □ Score calculations are correct (weighted average)                       │
│                                                                             │
│  INTEGRATION TESTS:                                                        │
│  □ Transcript → OpenRouter API → Analysis saved to DB works                │
│  □ GET /api/calls/:id/analysis returns correct JSON                        │
│  □ POST /api/calls/:id/reanalyze creates new analysis                      │
│  □ Worker handles API timeouts and errors gracefully                       │
│  □ Model switching works (DeepSeek → GPT-4o-mini)                          │
│                                                                             │
│  QUALITY TESTS:                                                            │
│  □ Good call transcript scores > 70                                        │
│  □ Poor call transcript scores < 50                                        │
│  □ Recommendations are actionable and specific                             │
│  □ Issues identified match obvious problems                                │
│  □ API costs tracked and logged                                            │
│                                                                             │
│  RUN: npm test:phase4                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 5: Output & Notification Layer
**Duration: 4-5 days | Complexity: Medium**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 5 SCOPE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     OUTPUT CHANNELS                                         │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   ┌───────────────┐                                                  │  │
│   │   │   Analysis    │                                                  │  │
│   │   │   Complete    │                                                  │  │
│   │   └───────┬───────┘                                                  │  │
│   │           │                                                          │  │
│   │           ▼                                                          │  │
│   │   ┌───────────────────────────────────────────────────────────────┐ │  │
│   │   │              NOTIFICATION ROUTER                               │ │  │
│   │   │                                                                │ │  │
│   │   │   IF score < threshold OR critical_issue:                      │ │  │
│   │   │      → Send immediate alert                                    │ │  │
│   │   │                                                                │ │  │
│   │   │   ALWAYS:                                                      │ │  │
│   │   │      → Update CSV/Excel export                                 │ │  │
│   │   │      → Log to console (dev mode)                               │ │  │
│   │   │                                                                │ │  │
│   │   └───────────────────────────────────────────────────────────────┘ │  │
│   │           │                                                          │  │
│   │           ├──────────────────┬─────────────────────┐                │  │
│   │           ▼                  ▼                     ▼                │  │
│   │   ┌─────────────┐    ┌─────────────┐       ┌─────────────┐         │  │
│   │   │  CSV/Excel  │    │  WhatsApp   │       │  Console    │         │  │
│   │   │  Export     │    │  (Mock/Real)│       │  Log        │         │  │
│   │   │             │    │             │       │             │         │  │
│   │   └─────────────┘    └─────────────┘       └─────────────┘         │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   CSV EXPORT FORMAT:                                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   call_id | date | agent | duration | overall_score | greeting |... │  │
│   │   ─────────────────────────────────────────────────────────────────│  │
│   │   abc123  | 2025-01-08 | John | 5:32 | 72 | 85 | 65 | 70 | 75 | 68 │  │
│   │   def456  | 2025-01-08 | Jane | 8:15 | 45 | 60 | 35 | 50 | 40 | 55 │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   WHATSAPP MESSAGE TEMPLATE (Mock):                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   🚨 Low Score Alert                                                 │  │
│   │   ────────────────────                                               │  │
│   │   Agent: John Doe                                                    │  │
│   │   Call ID: abc123                                                    │  │
│   │   Score: 45/100 ⚠️                                                   │  │
│   │                                                                      │  │
│   │   Issues:                                                            │  │
│   │   • Poor objection handling                                          │  │
│   │   • No closing attempt                                               │  │
│   │                                                                      │  │
│   │   View Details: http://localhost:3000/calls/abc123                   │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   DELIVERABLES:                                                             │
│   ✓ CSV export service                                                     │
│   ✓ Excel export with formatting (xlsx)                                    │
│   ✓ WhatsApp mock notification service                                     │
│   ✓ Console notification for development                                   │
│   ✓ Daily digest report generation                                         │
│   ✓ Threshold-based alerting                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 5.1 Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| 5.1.1 | Create CSV export service | 2 hrs |
| 5.1.2 | Create Excel (xlsx) export with styling | 3 hrs |
| 5.1.3 | Build WhatsApp mock notification service | 2 hrs |
| 5.1.4 | Implement notification router logic | 2 hrs |
| 5.1.5 | Create threshold configuration system | 1 hr |
| 5.1.6 | Build daily digest report generator | 3 hrs |
| 5.1.7 | Create GET /api/reports/daily endpoint | 1 hr |
| 5.1.8 | Create POST /api/export/excel endpoint | 1 hr |
| 5.1.9 | Add notification preferences per user | 2 hrs |
| 5.1.10 | Write tests | 2 hrs |

#### 5.2 Test Criteria (Phase 5 Gate)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 5 - TEST CHECKLIST                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EXPORT TESTS:                                                             │
│  □ CSV export contains all required columns                                │
│  □ Excel export opens correctly in Excel/Sheets                            │
│  □ Date filtering works for exports                                        │
│  □ Large exports (1000+ rows) complete without memory issues               │
│                                                                             │
│  NOTIFICATION TESTS:                                                       │
│  □ Low score triggers alert (console log in dev)                           │
│  □ High score does NOT trigger alert                                       │
│  □ Critical issues trigger immediate alert                                 │
│  □ WhatsApp mock logs correct message format                               │
│                                                                             │
│  REPORT TESTS:                                                             │
│  □ Daily digest includes correct date range                                │
│  □ Agent performance metrics calculated correctly                          │
│  □ Top issues list is accurate                                             │
│                                                                             │
│  RUN: npm test:phase5                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 6: Integration & End-to-End Testing
**Duration: 4-5 days | Complexity: Medium**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 6 SCOPE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                     END-TO-END PIPELINE TEST                                │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   STEP 1          STEP 2          STEP 3          STEP 4            │  │
│   │   ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐              │  │
│   │   │CALL │───────▶│TRANS│───────▶│ANALY│───────▶│NOTIF│              │  │
│   │   │RECV │        │CRIBE│        │ZE   │        │Y    │              │  │
│   │   └─────┘        └─────┘        └─────┘        └─────┘              │  │
│   │      │              │              │              │                  │  │
│   │      ▼              ▼              ▼              ▼                  │  │
│   │   ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐              │  │
│   │   │ DB  │        │ DB  │        │ DB  │        │ CSV │              │  │
│   │   │call │        │trans│        │analy│        │+LOG │              │  │
│   │   └─────┘        └─────┘        └─────┘        └─────┘              │  │
│   │                                                                      │  │
│   │   Time: ~2-5 minutes for 10-minute call (local processing)          │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   SIMPLE DASHBOARD (CLI/Web):                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   ┌───────────────────────────────────────────────────────────────┐ │  │
│   │   │  SALES CALL QC DASHBOARD                            [Refresh] │ │  │
│   │   ├───────────────────────────────────────────────────────────────┤ │  │
│   │   │                                                               │ │  │
│   │   │  Today's Stats                                                │ │  │
│   │   │  ─────────────────────────────────────────────────────────── │ │  │
│   │   │  Calls Processed: 12     Avg Score: 68     Alerts: 3         │ │  │
│   │   │                                                               │ │  │
│   │   │  Recent Calls                                                 │ │  │
│   │   │  ─────────────────────────────────────────────────────────── │ │  │
│   │   │  ID      | Agent  | Duration | Score | Status                │ │  │
│   │   │  abc123  | John   | 5:32     | 72 ✓  | Complete               │ │  │
│   │   │  def456  | Jane   | 8:15     | 45 ⚠  | Complete               │ │  │
│   │   │  ghi789  | Mike   | 3:45     | --    | Transcribing...        │ │  │
│   │   │                                                               │ │  │
│   │   └───────────────────────────────────────────────────────────────┘ │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   DELIVERABLES:                                                             │
│   ✓ Full pipeline tested end-to-end                                        │
│   ✓ Simple web dashboard (React or plain HTML)                             │
│   ✓ API documentation                                                       │
│   ✓ Error handling and retry logic                                         │
│   ✓ Performance benchmarks documented                                      │
│   ✓ Sample data for demos                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 6.1 Tasks

| Task | Description | Est. Time |
|------|-------------|-----------|
| 6.1.1 | Create end-to-end test suite | 3 hrs |
| 6.1.2 | Build simple web dashboard (HTML/React) | 4 hrs |
| 6.1.3 | Create API documentation (Swagger/OpenAPI) | 2 hrs |
| 6.1.4 | Implement global error handling | 2 hrs |
| 6.1.5 | Add retry logic for failed jobs | 2 hrs |
| 6.1.6 | Create sample test data generator | 2 hrs |
| 6.1.7 | Run performance benchmarks | 2 hrs |
| 6.1.8 | Create deployment documentation | 2 hrs |
| 6.1.9 | Record demo video | 1 hr |

#### 6.2 Final Test Criteria (MVP Complete)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 6 - FINAL TEST CHECKLIST                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  END-TO-END TESTS:                                                         │
│  □ Webhook → Download → Transcribe → Analyze → Notify pipeline works       │
│  □ Process 5 calls concurrently without errors                             │
│  □ System recovers from simulated failures                                 │
│  □ All data correctly stored in database                                   │
│                                                                             │
│  DASHBOARD TESTS:                                                          │
│  □ Dashboard loads and displays recent calls                               │
│  □ Call detail view shows transcript and analysis                          │
│  □ Export button generates Excel file                                      │
│  □ Refresh updates data correctly                                          │
│                                                                             │
│  PERFORMANCE:                                                              │
│  □ 10-min call processed in < 5 minutes total                              │
│  □ API response times < 500ms for list endpoints                           │
│  □ System handles 100+ calls in database smoothly                          │
│                                                                             │
│  INTEGRATION WITH EXOTEL:                                                  │
│  □ Real Exotel webhook received via ngrok                                  │
│  □ Real call recording downloaded and processed                            │
│  □ End-to-end flow works with production Exotel                            │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│  ✅ MVP COMPLETE - Ready for Production Migration                          │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Design

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTITY RELATIONSHIP DIAGRAM                          │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌───────────────────┐
  │   organizations   │
  ├───────────────────┤
  │ PK id             │
  │    name           │
  │    settings (JSON)│
  │    created_at     │
  └─────────┬─────────┘
            │
            │ 1:N
            ▼
  ┌───────────────────┐         ┌───────────────────┐
  │      users        │         │      calls        │
  ├───────────────────┤         ├───────────────────┤
  │ PK id             │◀────────│ FK agent_id       │
  │ FK org_id         │         │ PK id             │
  │    name           │    1:N  │ FK org_id         │
  │    email          │         │    exotel_call_sid│
  │    role           │         │    recording_url  │
  │    whatsapp_number│         │    duration_seconds│
  └───────────────────┘         │    status         │
            │                   │    created_at     │
            │                   └─────────┬─────────┘
            │                             │
            │                             │ 1:1
            │                             ▼
            │                   ┌───────────────────┐
            │                   │   transcripts     │
            │                   ├───────────────────┤
            │                   │ PK id             │
            │                   │ FK call_id (UNIQUE)│
            │                   │    content        │
            │                   │    language       │
            │                   │    speaker_segments│
            │                   │    stt_provider   │
            │                   └─────────┬─────────┘
            │                             │
            │                             │ (call_id links)
            │                             ▼
            │                   ┌───────────────────┐
            │                   │    analyses       │
            │                   ├───────────────────┤
            │                   │ PK id             │
            │                   │ FK call_id (UNIQUE)│
            │                   │    overall_score  │
            │                   │    category_scores│
            │                   │    issues         │
            │                   │    recommendations│
            │                   │    llm_model      │
            │                   └─────────┬─────────┘
            │                             │
            │                             │ (call_id links)
            │                             ▼
            │                   ┌───────────────────┐
            └──────────────────▶│  notifications    │
                                ├───────────────────┤
                                │ PK id             │
                                │ FK call_id        │
                                │ FK user_id        │
                                │    channel        │
                                │    message        │
                                │    status         │
                                │    sent_at        │
                                └───────────────────┘
```

---

## 6. API Specifications

### API Endpoints Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ENDPOINTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WEBHOOKS                                                                   │
│  ─────────────────────────────────────────────────────────────────────     │
│  POST /webhook/exotel/recording     Receive call recording from Exotel     │
│  POST /webhook/exotel/mock          Mock webhook for testing               │
│                                                                             │
│  CALLS                                                                      │
│  ─────────────────────────────────────────────────────────────────────     │
│  GET  /api/calls                    List calls (paginated, filterable)     │
│  GET  /api/calls/:id                Get call details                       │
│  GET  /api/calls/:id/transcript     Get transcript                         │
│  GET  /api/calls/:id/analysis       Get analysis                           │
│  POST /api/calls/:id/reanalyze      Re-run analysis                        │
│                                                                             │
│  REPORTS                                                                    │
│  ─────────────────────────────────────────────────────────────────────     │
│  GET  /api/reports/daily            Daily summary report                   │
│  GET  /api/reports/agent/:id        Agent performance report               │
│  GET  /api/reports/trends           Score trends over time                 │
│                                                                             │
│  EXPORTS                                                                    │
│  ─────────────────────────────────────────────────────────────────────     │
│  POST /api/export/csv               Export calls to CSV                    │
│  POST /api/export/excel             Export calls to Excel                  │
│                                                                             │
│  ADMIN                                                                      │
│  ─────────────────────────────────────────────────────────────────────     │
│  GET  /api/users                    List users                             │
│  POST /api/users                    Create user                            │
│  GET  /api/settings                 Get system settings                    │
│  PUT  /api/settings                 Update settings                        │
│                                                                             │
│  HEALTH                                                                     │
│  ─────────────────────────────────────────────────────────────────────     │
│  GET  /health                       Health check                           │
│  GET  /health/detailed              Detailed health (DB, Queue, etc.)      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sample API Responses

```json
// GET /api/calls/:id
{
  "id": "call_abc123",
  "agent": {
    "id": "user_xyz",
    "name": "John Doe"
  },
  "duration_seconds": 332,
  "direction": "outbound",
  "status": "analyzed",
  "created_at": "2025-01-08T10:30:00Z",
  "transcript": {
    "id": "trans_def456",
    "language": "hi",
    "word_count": 1245
  },
  "analysis": {
    "id": "analysis_ghi789",
    "overall_score": 72,
    "category_scores": {
      "greeting": 85,
      "need_discovery": 65,
      "product_presentation": 70,
      "objection_handling": 75,
      "closing": 68
    }
  }
}
```

---

## 7. Testing Strategy

### Test Pyramid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TESTING STRATEGY                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                             /│    E2E      │\
                            / │   Tests     │ \
                           /  │  (5-10%)    │  \
                          /   └─────────────┘   \
                         /                       \
                        /    ┌─────────────────┐  \
                       /     │  Integration    │   \
                      /      │    Tests        │    \
                     /       │   (20-30%)      │     \
                    /        └─────────────────┘      \
                   /                                   \
                  /         ┌─────────────────────┐    \
                 /          │     Unit Tests      │     \
                /           │     (60-70%)        │      \
               /            └─────────────────────┘       \
              └───────────────────────────────────────────┘

  TEST CATEGORIES:
  ────────────────────────────────────────────────────────────────────────────
  
  UNIT TESTS (npm test:unit)
  • Services: Storage, Database, Queue
  • Utils: Date formatting, Score calculation
  • Parsers: JSON output, Transcript formatting
  
  INTEGRATION TESTS (npm test:integration)
  • Webhook → Database flow
  • Worker → Service interactions
  • API endpoint responses
  
  E2E TESTS (npm test:e2e)
  • Full pipeline: Webhook → Export
  • Dashboard user flows
  • Real Exotel integration
```

---

## 8. Migration Path to Production

### Local to AWS Migration Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION MIGRATION PATH                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LOCAL                           PRODUCTION (AWS Mumbai)                   │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
│   Express Server ──────────────▶  AWS Lambda + API Gateway                 │
│   (Port 3000)                     (Serverless)                             │
│                                                                             │
│   SQLite ────────────────────▶  PostgreSQL (RDS)                           │
│   (./database/app.db)             (db.t3.micro to start)                   │
│                                                                             │
│   BullMQ + Redis ────────────▶  AWS SQS                                    │
│   (Docker)                        (Standard queues)                        │
│                                                                             │
│   Local Filesystem ───────────▶  AWS S3                                    │
│   (./storage/)                    (ap-south-1)                             │
│                                                                             │
│   Groq Whisper API ───────────▶  Groq Whisper API                          │
│   (v3 Turbo)                      (Same - No migration!)                   │
│                                                                             │
│   OpenRouter API ─────────────▶  OpenRouter API                            │
│   (DeepSeek/GPT-4o-mini)          (Same - No migration!)                   │
│                                                                             │
│   ngrok ──────────────────────▶  API Gateway                               │
│   (Webhook tunnel)                (Public endpoint)                        │
│                                                                             │
│   Console Logs ───────────────▶  WhatsApp BSP                              │
│   (Mock notifications)            (Interakt/AiSensy)                       │
│                                                                             │
│   CSV Files ──────────────────▶  Google Sheets API                         │
│   (Local export)                  (Real-time sync)                         │
│                                                                             │
│   ESTIMATED MIGRATION TIME: 3-5 days (Much faster with cloud APIs!)        │
│   ESTIMATED PRODUCTION COST: ₹2,500-8,000/month (500-1000 calls)           │
│                                                                             │
│   COST BREAKDOWN (1000 calls/month, avg 5 min each):                       │
│   - Groq Whisper: ~₹1,400/month ($0.04/hour × 83 hours)                    │
│   - OpenRouter (DeepSeek free or GPT-4o-mini): ₹0-2,500/month              │
│   - AWS Infrastructure: ₹2,500-4,000/month                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Abstraction Layer Design

To make migration seamless, we'll use adapter patterns:

```javascript
// storage/index.js
const adapter = process.env.STORAGE_ADAPTER || 'local';

module.exports = adapter === 's3' 
  ? require('./s3-adapter')
  : require('./local-adapter');

// Both adapters implement:
// - saveFile(path, buffer)
// - getFile(path)
// - deleteFile(path)
// - getSignedUrl(path)
```

---

## Summary Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MVP TIMELINE OVERVIEW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WEEK 1                                                                     │
│  ├── Phase 1: Foundation (Days 1-4)                                        │
│  └── Phase 2: Call Ingestion (Days 4-7)                                    │
│                                                                             │
│  WEEK 2                                                                     │
│  ├── Phase 2: Call Ingestion (Days 8-9)                                    │
│  ├── Phase 3: Transcription with Groq API (Days 10-11) ⚡ FASTER           │
│  └── Phase 4: AI Analysis with OpenRouter (Days 12-14) ⚡ FASTER           │
│                                                                             │
│  WEEK 3                                                                     │
│  ├── Phase 5: Output Layer (Days 15-19)                                    │
│  └── Phase 6: Integration (Days 20-21)                                     │
│                                                                             │
│  TOTAL: ~3 weeks for complete MVP (vs 4-5 weeks with local models)         │
│                                                                             │
│  TIME SAVED: ~10-14 days by using cloud APIs instead of local setup        │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  KEY MILESTONES:                                                            │
│  ✓ End of Week 1: First call recorded and stored                           │
│  ✓ End of Week 2: Calls transcribed + analyzed with AI                     │
│  ✓ End of Week 3: Full pipeline with exports and dashboard working         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Questions Before We Proceed

Before starting development, I need clarification on a few items:

1. **API Keys**: You'll need to sign up for:
   - Groq API (for transcription): https://console.groq.com/
   - OpenRouter API (for AI analysis): https://openrouter.ai/

2. **Exotel Plan**: Which Exotel plan do you have (Dabbler/Believer/Influencer)? This affects API access.

3. **Language Priority**: Should we focus on Hindi/Hinglish first, or English-only for initial testing?

4. **Scoring Rubric**: Do you have a specific sales scoring rubric, or should we use the generic one from the document?

5. **Dashboard Preference**: Do you want a simple HTML dashboard or a React-based one?

**Note**: With cloud APIs, your PC specs no longer matter - everything runs in the cloud!

---

*Document Version: 1.0 | Created: January 2025*
