/**
 * Transcription Service
 * Handles audio transcription using ElevenLabs Scribe v2 API
 *
 * Best-in-class Malayalam accuracy (100% confidence vs Groq's poor performance)
 * Features: 90+ languages, real-time, speaker diarization, word timestamps
 */

const FormData = require("form-data");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

class TranscriptionService {
  constructor() {
    this.apiKey = null;
    this.model = "scribe_v2";
    this.providerName = "elevenlabs";
    this.baseUrl = "https://api.elevenlabs.io/v1";
    this.maxFileSizeGB = 3;
  }

  /**
   * Initialize ElevenLabs client
   */
  initialize() {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      logger.warn("ELEVENLABS_API_KEY not set - transcription service unavailable");
      return false;
    }

    this.apiKey = apiKey;
    logger.info("Transcription service initialized with ElevenLabs Scribe v2");
    return true;
  }

  /**
   * Transcribe audio file
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Object} - Transcription result
   */
  async transcribe(audioPath, options = {}) {
    const startTime = Date.now();

    // Ensure client is initialized
    if (!this.apiKey) {
      if (!this.initialize()) {
        throw new Error("Transcription service not configured - ELEVENLABS_API_KEY missing");
      }
    }

    // Validate file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Validate format
    if (!this.isValidFormat(audioPath)) {
      throw new Error(`Unsupported format: ${path.extname(audioPath)}`);
    }

    const fileStats = fs.statSync(audioPath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    const fileSizeGB = fileSizeMB / 1024;

    logger.info("Starting transcription", {
      audioPath,
      fileSizeMB: fileSizeMB.toFixed(2),
      model: this.model,
      provider: this.providerName,
      language: options.language || "auto",
    });

    // Check file size (ElevenLabs limit is 3GB)
    if (fileSizeGB > this.maxFileSizeGB) {
      throw new Error(`Audio file too large: ${fileSizeMB.toFixed(2)}MB (max ${this.maxFileSizeGB}GB)`);
    }

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append("file", fs.createReadStream(audioPath));
      formData.append("model_id", this.model);

      // Set language if specified
      if (options.language) {
        formData.append("language_code", options.language);
      }

      // Enable speaker diarization by default (great for call QC)
      formData.append("diarize", "true");

      // Enable word-level timestamps (default: true)
      if (options.timestamps !== false) {
        formData.append("timestamps_granularity", "word");
      }

      // Enable audio event tagging
      formData.append("tag_audio_events", "true");

      // Call ElevenLabs API
      const response = await axios.post(
        `${this.baseUrl}/speech-to-text`,
        formData,
        {
          headers: {
            "xi-api-key": this.apiKey,
            ...formData.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300000, // 5 minute timeout for large files
        }
      );

      const processingTime = Date.now() - startTime;

      // Format response
      const segments = (response.data.words || []).map((word, index) => ({
        id: index,
        start: word.start,
        end: word.end,
        text: word.text,
        confidence: word.confidence || null,
        speaker: word.speaker || null,
      }));

      // Calculate duration from last segment
      const duration = segments.length > 0
        ? segments[segments.length - 1].end
        : 0;

      const result = {
        text: response.data.text,
        language: response.data.language_code,
        duration,
        segments,
        wordCount: this.countWords(response.data.text),
        confidence: response.data.language_probability || null,
        processingTimeMs: processingTime,
        model: this.model,
        provider: this.providerName,
      };

      logger.info("Transcription completed", {
        language: result.language,
        duration: result.duration,
        wordCount: result.wordCount,
        processingTimeMs: processingTime,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("Transcription failed", {
        audioPath,
        error: error.message,
        status: error.response?.status,
        processingTimeMs: processingTime,
      });

      // Handle specific errors
      if (error.response?.status === 401) {
        throw new Error("Invalid ELEVENLABS_API_KEY");
      }
      if (error.response?.status === 413) {
        throw new Error("Audio file too large for ElevenLabs API");
      }
      if (error.response?.status === 429) {
        throw new Error("ElevenLabs API rate limit exceeded - try again later");
      }
      if (error.response?.status === 400) {
        throw new Error(`ElevenLabs API error: ${error.response?.data?.detail || error.message}`);
      }

      throw error;
    }
  }

  /**
   * Format segments with timestamps
   * @param {Array} segments - Raw segments from API
   * @returns {Array} - Formatted segments
   */
  formatSegments(segments) {
    return segments.map((seg, index) => ({
      id: seg.id || index,
      start: seg.start,
      end: seg.end,
      text: seg.text?.trim() || seg.text,
      confidence: seg.confidence || null,
      speaker: seg.speaker || null,
    }));
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number} - Word count
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Check if service is available
   * @returns {boolean}
   */
  isAvailable() {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  /**
   * Get supported audio formats (ElevenLabs supports 10+ formats)
   * @returns {Array}
   */
  getSupportedFormats() {
    return ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "flac", "ogg", "aac"];
  }

  /**
   * Validate audio file format
   * @param {string} audioPath - Path to audio file
   * @returns {boolean}
   */
  isValidFormat(audioPath) {
    const ext = path.extname(audioPath).toLowerCase().slice(1);
    return this.getSupportedFormats().includes(ext);
  }
}

module.exports = TranscriptionService;
