# Project Structure

```
sales-call-qc/
│
├── 📁 src/                          # Source code
│   ├── 📁 config/                   # Configuration management
│   │   ├── index.js                 # Main config loader
│   │   ├── database.js              # Database config
│   │   ├── queue.js                 # BullMQ/Redis config
│   │   └── scoring.js               # Scoring rubric config
│   │
│   ├── 📁 controllers/              # Route handlers (Express)
│   │   ├── webhook.controller.js    # Exotel webhook handlers
│   │   ├── calls.controller.js      # Calls CRUD endpoints
│   │   ├── reports.controller.js    # Reports endpoints
│   │   └── export.controller.js     # Export endpoints
│   │
│   ├── 📁 services/                 # Business logic layer
│   │   ├── storage.service.js       # File storage (local/S3 adapter)
│   │   ├── transcription.service.js # Whisper/STT wrapper
│   │   ├── analysis.service.js      # Ollama/LLM wrapper
│   │   ├── notification.service.js  # WhatsApp/Console notifications
│   │   ├── export.service.js        # CSV/Excel export
│   │   └── report.service.js        # Report generation
│   │
│   ├── 📁 workers/                  # Background job processors
│   │   ├── index.js                 # Worker orchestrator
│   │   ├── download.worker.js       # Download audio from Exotel
│   │   ├── transcription.worker.js  # Transcribe audio
│   │   ├── analysis.worker.js       # Analyze transcript
│   │   └── notification.worker.js   # Send notifications
│   │
│   ├── 📁 models/                   # Database models
│   │   ├── index.js                 # Model exports
│   │   ├── organization.model.js
│   │   ├── user.model.js
│   │   ├── call.model.js
│   │   ├── transcript.model.js
│   │   ├── analysis.model.js
│   │   └── notification.model.js
│   │
│   ├── 📁 routes/                   # Express route definitions
│   │   ├── index.js                 # Route aggregator
│   │   ├── webhook.routes.js
│   │   ├── calls.routes.js
│   │   ├── reports.routes.js
│   │   └── export.routes.js
│   │
│   ├── 📁 middleware/               # Express middleware
│   │   ├── error.middleware.js      # Global error handler
│   │   ├── auth.middleware.js       # Authentication (future)
│   │   ├── validate.middleware.js   # Request validation
│   │   └── exotel.middleware.js     # Exotel signature validation
│   │
│   ├── 📁 utils/                    # Helper utilities
│   │   ├── logger.js                # Winston logger setup
│   │   ├── validators.js            # Joi validation schemas
│   │   ├── formatters.js            # Date/text formatters
│   │   └── score-calculator.js      # Weighted score calculation
│   │
│   ├── 📁 prompts/                  # LLM prompt templates
│   │   ├── scoring.prompt.js        # Main scoring prompt
│   │   └── summary.prompt.js        # Summary generation prompt
│   │
│   └── index.js                     # Application entry point
│
├── 📁 storage/                      # Local file storage
│   ├── 📁 audio/                    # Call recordings (.wav/.mp3)
│   ├── 📁 transcripts/              # Transcript files (.json)
│   └── 📁 exports/                  # Generated exports (.csv/.xlsx)
│
├── 📁 database/                     # SQLite database files
│   └── app.db                       # Main database
│
├── 📁 logs/                         # Application logs
│   └── app.log
│
├── 📁 models/                       # AI model files
│   └── ggml-medium.bin              # Whisper model
│
├── 📁 scripts/                      # Utility scripts
│   ├── init-database.js             # Initialize DB schema
│   ├── seed-database.js             # Seed test data
│   ├── reset-database.js            # Reset DB
│   ├── test-whisper.js              # Test Whisper setup
│   ├── test-ollama.js               # Test Ollama setup
│   └── generate-sample-data.js      # Generate demo data
│
├── 📁 tests/                        # Test files
│   ├── 📁 unit/                     # Unit tests
│   │   ├── services/
│   │   └── utils/
│   ├── 📁 integration/              # Integration tests
│   │   ├── webhook.test.js
│   │   └── pipeline.test.js
│   ├── 📁 e2e/                      # End-to-end tests
│   │   └── full-flow.test.js
│   ├── 📁 phase1/                   # Phase 1 specific tests
│   ├── 📁 phase2/                   # Phase 2 specific tests
│   ├── 📁 phase3/                   # Phase 3 specific tests
│   ├── 📁 phase4/                   # Phase 4 specific tests
│   ├── 📁 phase5/                   # Phase 5 specific tests
│   ├── 📁 phase6/                   # Phase 6 specific tests
│   └── 📁 fixtures/                 # Test data
│       ├── sample-audio/
│       └── sample-transcripts/
│
├── 📁 public/                       # Static files (dashboard)
│   ├── index.html
│   ├── css/
│   └── js/
│
├── 📁 docs/                         # Documentation
│   ├── api.md                       # API documentation
│   ├── setup.md                     # Setup guide
│   └── exotel-setup.md              # Exotel configuration guide
│
├── .env.example                     # Environment template
├── .env                             # Local environment (gitignored)
├── .gitignore
├── docker-compose.yml               # Redis container
├── package.json
├── package-lock.json
└── README.md
```

## Key Files Description

### Entry Points
- `src/index.js` - Main Express server
- `src/workers/index.js` - Background worker processes

### Configuration
- `.env` - Environment variables (copy from `.env.example`)
- `src/config/` - Configuration modules

### Data Flow
1. `controllers/` - Receive HTTP requests
2. `services/` - Execute business logic
3. `models/` - Database operations
4. `workers/` - Async job processing

### Storage
- `storage/audio/` - Downloaded call recordings
- `storage/transcripts/` - Generated transcripts
- `storage/exports/` - CSV/Excel exports
- `database/app.db` - SQLite database

## Creating the Structure

Run this command to create all directories:

```bash
mkdir -p src/{config,controllers,services,workers,models,routes,middleware,utils,prompts}
mkdir -p storage/{audio,transcripts,exports}
mkdir -p database logs models scripts
mkdir -p tests/{unit,integration,e2e,fixtures}/{services,utils,sample-audio,sample-transcripts}
mkdir -p tests/{phase1,phase2,phase3,phase4,phase5,phase6}
mkdir -p public/{css,js}
mkdir -p docs
touch src/index.js
touch src/workers/index.js
```
