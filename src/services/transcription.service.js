/**
 * Transcription Service
 * Handles audio transcription using Groq's Whisper API
 */

const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

class TranscriptionService {
  constructor() {
    this.groq = null;
    this.model = "whisper-large-v3-turbo";
  }

  /**
   * Initialize Groq client
   */
  initialize() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      logger.warn("GROQ_API_KEY not set - transcription service unavailable");
      return false;
    }

    this.groq = new Groq({ apiKey });
    logger.info("Transcription service initialized with Groq Whisper");
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
    if (!this.groq) {
      if (!this.initialize()) {
        throw new Error("Transcription service not configured - GROQ_API_KEY missing");
      }
    }

    // Validate file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const fileStats = fs.statSync(audioPath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    logger.info("Starting transcription", {
      audioPath,
      fileSizeMB: fileSizeMB.toFixed(2),
      model: this.model,
    });

    // Check file size (Groq limit is 25MB)
    if (fileSizeMB > 25) {
      throw new Error(`Audio file too large: ${fileSizeMB.toFixed(2)}MB (max 25MB)`);
    }

    try {
      // Create file stream for upload
      const audioFile = fs.createReadStream(audioPath);

      // Call Groq Whisper API
      const transcription = await this.groq.audio.transcriptions.create({
        file: audioFile,
        model: this.model,
        response_format: "verbose_json",
        language: options.language || undefined, // Auto-detect if not specified
        temperature: options.temperature || 0,
      });

      const processingTime = Date.now() - startTime;

      // Extract and format results
      const result = {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        segments: this.formatSegments(transcription.segments || []),
        wordCount: this.countWords(transcription.text),
        processingTimeMs: processingTime,
        model: this.model,
        provider: "groq",
      };

      logger.info("Transcription completed", {
        language: result.language,
        duration: result.duration,
        wordCount: result.wordCount,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("Transcription failed", {
        audioPath,
        error: error.message,
        processingTimeMs: processingTime,
      });

      // Handle specific Groq errors
      if (error.status === 401) {
        throw new Error("Invalid GROQ_API_KEY");
      }
      if (error.status === 413) {
        throw new Error("Audio file too large for Groq API");
      }
      if (error.status === 429) {
        throw new Error("Groq API rate limit exceeded - try again later");
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
    return segments.map((seg) => ({
      id: seg.id,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
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
    return !!process.env.GROQ_API_KEY;
  }

  /**
   * Get supported audio formats
   * @returns {Array}
   */
  getSupportedFormats() {
    return ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "flac", "ogg"];
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
