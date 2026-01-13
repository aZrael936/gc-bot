/**
 * Groq Provider
 * Transcription using Groq's Whisper API (OpenAI Whisper)
 *
 * Note: Currently produces poor Malayalam results despite language specification.
 * Kept as baseline for comparison.
 */

const BaseTranscriptionService = require("../base.transcription.service");
const Groq = require("groq-sdk");
const fs = require("fs");
const path = require("path");
const logger = require("../../../utils/logger");

class GroqProvider extends BaseTranscriptionService {
  constructor(config = {}) {
    super(config);
    this.providerName = "groq";
    this.model = "whisper-large-v3-turbo";
    this.groq = null;
    this.maxFileSizeMB = 25;
  }

  /**
   * Initialize Groq client
   * @returns {boolean} Success status
   */
  initialize() {
    this.apiKey = process.env.GROQ_API_KEY;

    if (!this.apiKey) {
      logger.warn("GROQ_API_KEY not set - Groq provider unavailable");
      return false;
    }

    this.groq = new Groq({ apiKey: this.apiKey });
    logger.info("Groq transcription provider initialized");
    return true;
  }

  /**
   * Transcribe audio file using Groq Whisper
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioPath, options = {}) {
    const startTime = Date.now();

    // Ensure client is initialized
    if (!this.groq) {
      if (!this.initialize()) {
        throw new Error("Groq provider not configured - GROQ_API_KEY missing");
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

    // Check file size (Groq limit is 25MB)
    if (fileSizeMB > this.maxFileSizeMB) {
      throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB (max ${this.maxFileSizeMB}MB)`);
    }

    logger.info("Starting Groq transcription", {
      audioPath,
      fileSizeMB: fileSizeMB.toFixed(2),
      model: this.model,
      language: options.language || "auto",
    });

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
      const result = this.formatResponse(transcription, processingTime);

      logger.info("Groq transcription completed", {
        language: result.language,
        duration: result.duration,
        wordCount: result.wordCount,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("Groq transcription failed", {
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
   * Format Groq response to standard format
   * @param {Object} rawResponse - Raw Groq response
   * @param {number} processingTime - Processing time in ms
   * @returns {TranscriptionResult}
   */
  formatResponse(rawResponse, processingTime) {
    const segments = (rawResponse.segments || []).map((seg) => ({
      id: seg.id,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : null,
    }));

    return {
      text: rawResponse.text,
      language: rawResponse.language,
      duration: rawResponse.duration,
      segments,
      wordCount: this.countWords(rawResponse.text),
      confidence: null, // Groq doesn't provide overall confidence
      processingTimeMs: processingTime,
      model: this.model,
      provider: this.providerName,
      raw: rawResponse,
    };
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>}
   */
  getSupportedFormats() {
    return ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "flac", "ogg"];
  }

  /**
   * Get supported languages (Whisper supports 100+ languages)
   * @returns {Array<string>}
   */
  getSupportedLanguages() {
    return [
      "en", "hi", "ml", "ta", "te", "gu", "kn", "bn", "mr", "pa",
      "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh", "ar",
      // ... many more
    ];
  }

  /**
   * Estimate cost for transcription (Groq has free tier)
   * @param {string} audioPath
   * @returns {Promise<number>} Estimated cost in USD
   */
  async estimateCost(audioPath) {
    // Groq Whisper is currently free
    return 0;
  }
}

module.exports = GroqProvider;
