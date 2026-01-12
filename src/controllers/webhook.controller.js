/**
 * Webhook Controller
 * Handles incoming webhooks from external services (Exotel, etc.)
 */

const config = require("../config");
const logger = require("../utils/logger");

/**
 * Handle Exotel call recording webhook
 * Note: Exotel does not support webhook signature validation.
 * Secure your webhook endpoint using IP whitelisting or firewall rules.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const handleExotelWebhook = async (req, res) => {
  try {
    // Exotel sends payload as flat JSON object (not nested with event/data)
    const payload = req.body;

    // Validate required fields
    if (!payload.call_sid) {
      logger.warn("Webhook missing required field: call_sid", { payload });
      return res.status(400).json({
        error: "Bad Request",
        message: "Missing required field: call_sid",
      });
    }

    // Only process completed calls with recordings
    // Exotel uses 'completed' for call_type and 'recording_url' (snake_case)
    if (payload.call_type !== "completed" || !payload.recording_url) {
      logger.info("Ignoring non-recording webhook event", {
        callSid: payload.call_sid,
        callType: payload.call_type,
        hasRecording: !!payload.recording_url,
      });
      return res.status(200).json({ status: "ignored" });
    }

    logger.info("Processing Exotel call recording webhook", {
      callSid: payload.call_sid,
      direction: payload.direction,
      duration: payload.on_call_duration,
    });

    // Import services (lazy load to avoid circular dependencies)
    const { CallService } = require("../services");

    // Create call record with correct Exotel field names (snake_case)
    const callData = {
      org_id: config.organization.defaultId,
      exotel_call_sid: payload.call_sid,
      recording_url: payload.recording_url,
      duration_seconds: payload.on_call_duration || payload.dial_call_duration,
      call_type: payload.call_type,
      caller_number: payload.from,
      callee_number: payload.to,
      direction: payload.direction,
      status: "received",
    };

    const call = await CallService.createCall(callData);

    // Queue download job
    const downloadJob = await CallService.queueDownloadJob(call.id);

    logger.info("Call record created and download queued", {
      callId: call.id,
      jobId: downloadJob.id,
    });

    res.status(200).json({
      status: "processed",
      call_id: call.id,
      job_id: downloadJob.id,
    });
  } catch (error) {
    logger.error("Error processing Exotel webhook", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process webhook",
    });
  }
};

/**
 * Handle mock webhook for testing
 * Uses correct Exotel payload structure with snake_case field names
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const handleMockWebhook = async (req, res) => {
  try {
    logger.info("Processing mock webhook", req.body);

    // Simulate Exotel payload structure with correct field names (snake_case)
    const mockData = {
      call_sid: req.body.call_sid || `mock-${Date.now()}`,
      transaction_id: req.body.transaction_id || `conn-${Date.now()}`,
      from: req.body.from || "09876543210",
      to: req.body.to || "08012345678",
      direction: req.body.direction || "incoming",
      start_time: req.body.start_time || new Date().toISOString(),
      current_time: req.body.current_time || new Date().toISOString(),
      dial_call_duration: req.body.dial_call_duration || 245,
      on_call_duration: req.body.on_call_duration || 240,
      recording_url:
        req.body.recording_url || "https://example.com/mock-recording.mp3",
      call_type: req.body.call_type || "completed",
      dial_call_status: req.body.dial_call_status || "completed",
    };

    // Import services
    const { CallService } = require("../services");

    // Create call record
    const callData = {
      org_id: config.organization.defaultId,
      exotel_call_sid: mockData.call_sid,
      recording_url: mockData.recording_url,
      duration_seconds: mockData.on_call_duration,
      call_type: mockData.call_type,
      caller_number: mockData.from,
      callee_number: mockData.to,
      direction: mockData.direction,
      status: "received",
    };

    const call = await CallService.createCall(callData);

    // Queue download job
    const downloadJob = await CallService.queueDownloadJob(call.id);

    logger.info("Mock call record created and download queued", {
      callId: call.id,
      jobId: downloadJob.id,
    });

    res.status(200).json({
      status: "processed",
      call_id: call.id,
      job_id: downloadJob.id,
      mock: true,
    });
  } catch (error) {
    logger.error("Error processing mock webhook", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process mock webhook",
    });
  }
};

module.exports = {
  handleExotelWebhook,
  handleMockWebhook,
};
