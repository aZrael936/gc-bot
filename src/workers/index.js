#!/usr/bin/env node

/**
 * Background Workers Orchestrator
 * Manages BullMQ queues and workers
 */

const { Queue, Worker } = require("bullmq");
const queueConfig = require("../config/queue");
const logger = require("../utils/logger");

// Queue instances
const queues = {};

// Initialize queues
const initializeQueues = () => {
  Object.entries(queueConfig.queues).forEach(([name, queueName]) => {
    queues[name] = new Queue(queueName, {
      connection: queueConfig.connection,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });

    logger.info(`📋 Queue initialized: ${queueName}`);
  });
};

// Placeholder worker processors (will be implemented in later phases)
const createWorkers = () => {
  // Download worker (Phase 2)
  const downloadWorker = new Worker(
    queueConfig.queues.download,
    async (job) => {
      const { callId } = job.data;
      logger.info(`📥 Processing download job: ${job.id}`, { callId });

      try {
        // Get call details
        const { Call, Storage } = require("../services");
        const call = await Call.getCallById(callId);

        if (!call) {
          throw new Error(`Call not found: ${callId}`);
        }

        if (!call.recording_url) {
          throw new Error(`No recording URL for call: ${callId}`);
        }

        // Download the recording
        const localPath = await Storage.downloadCallRecording(
          call.recording_url,
          call.org_id,
          callId
        );

        // Update call record with local path
        await Call.setLocalAudioPath(callId, localPath);
        await Call.updateCallStatus(callId, "downloaded");

        // Queue transcription job
        await Call.queueTranscriptionJob(callId);

        logger.info(`✅ Download completed for call: ${callId}`, { localPath });
        return {
          status: "completed",
          callId,
          localPath,
          message: "Audio download and transcription queued",
        };
      } catch (error) {
        logger.error(`❌ Download failed for call: ${callId}`, error);

        // Update call status to failed
        try {
          const { Call } = require("../services");
          await Call.updateCallStatus(callId, "download_failed");
        } catch (updateError) {
          logger.error("Failed to update call status", updateError);
        }

        throw error;
      }
    },
    {
      connection: queueConfig.connection,
      concurrency: queueConfig.concurrency.download,
    }
  );

  // Transcription worker (Phase 3)
  const transcriptionWorker = new Worker(
    queueConfig.queues.transcription,
    async (job) => {
      logger.info(`🎙️ Processing transcription job: ${job.id}`, job.data);
      // Placeholder - actual implementation in Phase 3
      return {
        status: "completed",
        message: "Transcription worker placeholder",
      };
    },
    {
      connection: queueConfig.connection,
      concurrency: queueConfig.concurrency.transcription,
    }
  );

  // Analysis worker (Phase 4)
  const analysisWorker = new Worker(
    queueConfig.queues.analysis,
    async (job) => {
      logger.info(`🤖 Processing analysis job: ${job.id}`, job.data);
      // Placeholder - actual implementation in Phase 4
      return { status: "completed", message: "Analysis worker placeholder" };
    },
    {
      connection: queueConfig.connection,
      concurrency: queueConfig.concurrency.analysis,
    }
  );

  // Notification worker (Phase 5)
  const notificationWorker = new Worker(
    queueConfig.queues.notification,
    async (job) => {
      logger.info(`📤 Processing notification job: ${job.id}`, job.data);
      // Placeholder - actual implementation in Phase 5
      return {
        status: "completed",
        message: "Notification worker placeholder",
      };
    },
    {
      connection: queueConfig.connection,
      concurrency: queueConfig.concurrency.notification,
    }
  );

  // Error handling
  [
    downloadWorker,
    transcriptionWorker,
    analysisWorker,
    notificationWorker,
  ].forEach((worker, index) => {
    const workerNames = [
      "download",
      "transcription",
      "analysis",
      "notification",
    ];
    const workerName = workerNames[index];

    worker.on("completed", (job) => {
      logger.info(`✅ ${workerName} job completed: ${job.id}`);
    });

    worker.on("failed", (job, err) => {
      logger.error(`❌ ${workerName} job failed: ${job.id}`, err);
    });
  });

  logger.info("👷 Workers initialized with placeholder processors");
};

// Test queue functionality
const testQueues = async () => {
  try {
    // Add a test job to each queue
    for (const [name, queue] of Object.entries(queues)) {
      const job = await queue.add(`${name}-test`, {
        test: true,
        timestamp: new Date().toISOString(),
        message: `Test job for ${name} queue`,
      });

      logger.info(`🧪 Test job added to ${name} queue: ${job.id}`);
    }

    logger.info("✅ Queue system test completed successfully");
  } catch (error) {
    logger.error("❌ Queue system test failed:", error);
    throw error;
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info("🛑 Shutting down workers...");

  // Close all queues
  await Promise.all(Object.values(queues).map((queue) => queue.close()));

  logger.info("👋 Workers shutdown complete");
};

// Initialize everything
const initialize = async () => {
  try {
    logger.info("🔄 Initializing background workers...");

    initializeQueues();
    createWorkers();

    // Test the system
    await testQueues();

    logger.info("✅ Workers initialization complete");

    // Handle shutdown signals
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error("❌ Workers initialization failed:", error);
    process.exit(1);
  }
};

// Export for use in main application
module.exports = {
  initialize,
  queues,
  shutdown,
};

// Run directly if called as main module
if (require.main === module) {
  initialize();
}
