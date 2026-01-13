/**
 * Configuration Management
 * Loads environment variables and provides centralized config
 */

require("dotenv").config();

const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || "development",
  port:
    parseInt(process.env.PORT) ||
    (process.env.NODE_ENV === "test" ? 3001 : 3000),
  host: process.env.HOST || "localhost",

  // Database
  database: {
    path: process.env.DATABASE_PATH || "./database/app.db",
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Storage
  storage: {
    path: process.env.STORAGE_PATH || "./storage",
    adapter: process.env.STORAGE_ADAPTER || "local",
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    filePath: process.env.LOG_FILE_PATH || "./logs/app.log",
  },

  // Quality scoring
  scoring: {
    thresholds: {
      alert: parseInt(process.env.SCORE_THRESHOLD_ALERT) || 50,
      good: parseInt(process.env.SCORE_THRESHOLD_GOOD) || 70,
      excellent: parseInt(process.env.SCORE_THRESHOLD_EXCELLENT) || 85,
    },
  },

  // Organization defaults
  organization: {
    defaultId: process.env.DEFAULT_ORG_ID || "default",
    defaultName: process.env.DEFAULT_ORG_NAME || "Default Organization",
  },

  // Exotel configuration
  // Note: API Key and Token are used for making API calls TO Exotel (Basic Auth)
  // Webhooks FROM Exotel do not support signature validation
  exotel: {
    accountSid: process.env.EXOTEL_ACCOUNT_SID,
    apiKey: process.env.EXOTEL_API_KEY,
    apiToken: process.env.EXOTEL_API_TOKEN,
    webhookUrl: process.env.EXOTEL_WEBHOOK_URL,
  },

  // Groq configuration (for Whisper transcription)
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "whisper-large-v3-turbo",
  },
};

// Validate required configuration
const validateConfig = () => {
  const required = [];

  if (!config.database.path) {
    required.push("DATABASE_PATH");
  }

  if (required.length > 0) {
    throw new Error(
      `Missing required environment variables: ${required.join(", ")}`
    );
  }

  // Log configuration summary
  console.log("🔧 Configuration loaded:");
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database.path}`);
  console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`   Storage: ${config.storage.path} (${config.storage.adapter})`);
  console.log(`   Log Level: ${config.logging.level}`);

  // Log Exotel configuration status
  if (config.exotel.accountSid) {
    console.log(`   Exotel: Configured (Account SID: ${config.exotel.accountSid.substring(0, 8)}...)`);
  } else {
    console.log(`   Exotel: Not configured (optional for mock testing)`);
  }
};

// Validate on load
validateConfig();

module.exports = config;
