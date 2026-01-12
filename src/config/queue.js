/**
 * Queue Configuration
 * BullMQ configuration for background job processing
 */

const config = require("./index");

const queueConfig = {
  // Connection settings
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  },

  // Default job options
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2 second delay
    },
  },

  // Queue names
  queues: {
    download: "audio-download",
    transcription: "speech-transcription",
    analysis: "call-analysis",
    notification: "send-notification",
  },

  // Worker concurrency
  concurrency: {
    download: 2, // Download 2 files at a time
    transcription: 1, // Process 1 transcription at a time (CPU intensive)
    analysis: 1, // Process 1 analysis at a time (GPU/CPU intensive)
    notification: 5, // Send 5 notifications at a time
  },

  // Job timeouts (in milliseconds)
  timeouts: {
    download: 5 * 60 * 1000, // 5 minutes
    transcription: 30 * 60 * 1000, // 30 minutes (for long calls)
    analysis: 10 * 60 * 1000, // 10 minutes
    notification: 2 * 60 * 1000, // 2 minutes
  },
};

module.exports = queueConfig;
