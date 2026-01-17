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

  // OpenRouter configuration (for LLM analysis)
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
    fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || "deepseek/deepseek-chat",
    baseUrl: "https://openrouter.ai/api/v1",
  },

  // LLM parameters
  llm: {
    provider: process.env.LLM_PROVIDER || "openrouter",
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.3,
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2000,
  },

  // Telegram configuration (for notifications)
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    defaultChatId: process.env.TELEGRAM_CHAT_ID,
  },

  // Notification settings
  notifications: {
    enabled: process.env.NOTIFICATIONS_ENABLED !== "false",
    channels: {
      telegram: process.env.TELEGRAM_NOTIFICATIONS !== "false",
      console: process.env.CONSOLE_NOTIFICATIONS !== "false",
    },
    alerts: {
      lowScore: process.env.ALERT_LOW_SCORE !== "false",
      criticalIssue: process.env.ALERT_CRITICAL_ISSUE !== "false",
    },
    digest: {
      enabled: process.env.DAILY_DIGEST_ENABLED !== "false",
      time: process.env.DAILY_DIGEST_TIME || "09:00", // 24hr format
    },
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

  // Log OpenRouter configuration status
  if (config.openrouter.apiKey) {
    console.log(`   OpenRouter: Configured (Model: ${config.openrouter.model})`);
  } else {
    console.log(`   OpenRouter: Not configured (required for analysis)`);
  }

  // Log Telegram configuration status
  if (config.telegram.botToken) {
    console.log(`   Telegram: Configured (Chat ID: ${config.telegram.defaultChatId || "not set"})`);
  } else {
    console.log(`   Telegram: Not configured (will use mock mode for notifications)`);
  }
};

// Validate on load
validateConfig();

module.exports = config;
