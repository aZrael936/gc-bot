/**
 * Call Service
 * Business logic for call operations
 */

const { Call } = require("../models");
const queueConfig = require("../config/queue");
const logger = require("../utils/logger");

class CallService {
  /**
   * Create a new call record
   * @param {Object} callData - Call data
   * @returns {Object} - Created call record
   */
  async createCall(callData) {
    try {
      // Check for duplicate CallSid
      const existingCall = Call.findByExotelCallSid(callData.exotel_call_sid);
      if (existingCall) {
        logger.warn("Duplicate Exotel CallSid, returning existing call", {
          callSid: callData.exotel_call_sid,
          existingId: existingCall.id,
        });
        return existingCall;
      }

      const call = Call.create(callData);
      logger.info("Call record created", {
        id: call.id,
        callSid: call.exotel_call_sid,
      });
      return call;
    } catch (error) {
      logger.error("Error creating call record", error);
      throw error;
    }
  }

  /**
   * Get call by ID
   * @param {string} id - Call ID
   * @returns {Object|null} - Call record
   */
  async getCallById(id) {
    try {
      return Call.findById(id);
    } catch (error) {
      logger.error("Error getting call by ID", { id, error });
      throw error;
    }
  }

  /**
   * Update call status
   * @param {string} id - Call ID
   * @param {string} status - New status
   * @returns {Object} - Updated call record
   */
  async updateCallStatus(id, status) {
    try {
      const call = Call.updateStatus(id, status);
      logger.info("Call status updated", { id, status });
      return call;
    } catch (error) {
      logger.error("Error updating call status", { id, status, error });
      throw error;
    }
  }

  /**
   * Set local audio path for call
   * @param {string} id - Call ID
   * @param {string} localPath - Local file path
   * @returns {Object} - Updated call record
   */
  async setLocalAudioPath(id, localPath) {
    try {
      const call = Call.setLocalAudioPath(id, localPath);
      logger.info("Call local audio path set", { id, localPath });
      return call;
    } catch (error) {
      logger.error("Error setting local audio path", { id, localPath, error });
      throw error;
    }
  }

  /**
   * Queue download job for call
   * @param {string} callId - Call ID
   * @returns {Object} - Job details
   */
  async queueDownloadJob(callId) {
    try {
      const { queues } = require("../workers");

      const job = await queues.download.add(
        `download-${callId}`,
        {
          callId,
          type: "audio-download",
          timestamp: new Date().toISOString(),
        },
        {
          priority: 1, // High priority for downloads
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        }
      );

      logger.info("Download job queued", { callId, jobId: job.id });
      return {
        id: job.id,
        name: job.name,
        data: job.data,
      };
    } catch (error) {
      logger.error("Error queuing download job", { callId, error });
      throw error;
    }
  }

  /**
   * Queue transcription job for call
   * @param {string} callId - Call ID
   * @returns {Object} - Job details
   */
  async queueTranscriptionJob(callId) {
    try {
      const { queues } = require("../workers");

      const job = await queues.transcription.add(
        `transcribe-${callId}`,
        {
          callId,
          type: "speech-transcription",
          timestamp: new Date().toISOString(),
        },
        {
          priority: 2,
          attempts: 2,
          backoff: {
            type: "exponential",
            delay: 10000,
          },
        }
      );

      logger.info("Transcription job queued", { callId, jobId: job.id });
      return {
        id: job.id,
        name: job.name,
        data: job.data,
      };
    } catch (error) {
      logger.error("Error queuing transcription job", { callId, error });
      throw error;
    }
  }

  /**
   * Queue analysis job for call
   * @param {string} callId - Call ID
   * @returns {Object} - Job details
   */
  async queueAnalysisJob(callId) {
    try {
      const { queues } = require("../workers");

      const job = await queues.analysis.add(
        `analyze-${callId}`,
        {
          callId,
          type: "call-analysis",
          timestamp: new Date().toISOString(),
        },
        {
          priority: 3,
          attempts: 2,
          backoff: {
            type: "exponential",
            delay: 15000,
          },
        }
      );

      logger.info("Analysis job queued", { callId, jobId: job.id });
      return {
        id: job.id,
        name: job.name,
        data: job.data,
      };
    } catch (error) {
      logger.error("Error queuing analysis job", { callId, error });
      throw error;
    }
  }

  /**
   * Get calls with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Object} - Paginated results
   */
  async getCalls(options = {}) {
    try {
      const { page = 1, limit = 50, status, org_id } = options;
      const offset = (page - 1) * limit;

      const calls = Call.findAll({ limit, offset, status, org_id });
      const total = Call.count({ status, org_id });

      return {
        calls,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting calls", { options, error });
      throw error;
    }
  }
}

module.exports = CallService;
