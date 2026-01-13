/**
 * ElevenLabs Provider
 * Transcription using ElevenLabs Scribe v2 API
 *
 * Best-in-class Malayalam accuracy (≤5% WER)
 * Features: 90+ languages, real-time, speaker diarization, word timestamps
 */

const BaseTranscriptionService = require("../base.transcription.service");
const FormData = require("form-data");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const logger = require("../../../utils/logger");

class ElevenLabsProvider extends BaseTranscriptionService {
  constructor(config = {}) {
    super(config);
    this.providerName = "elevenlabs";
    this.model = "scribe_v2";
    this.baseUrl = "https://api.elevenlabs.io/v1";
    this.maxFileSizeGB = 3;
  }

  /**
   * Initialize ElevenLabs client
   * @returns {boolean} Success status
   */
  initialize() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;

    if (!this.apiKey) {
      logger.warn("ELEVENLABS_API_KEY not set - ElevenLabs provider unavailable");
      return false;
    }

    logger.info("ElevenLabs transcription provider initialized");
    return true;
  }

  /**
   * Transcribe audio file using ElevenLabs Scribe
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioPath, options = {}) {
    const startTime = Date.now();

    // Ensure client is initialized
    if (!this.apiKey) {
      if (!this.initialize()) {
        throw new Error("ElevenLabs provider not configured - ELEVENLABS_API_KEY missing");
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

    // Check file size (ElevenLabs limit is 3GB)
    if (fileSizeGB > this.maxFileSizeGB) {
      throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB (max ${this.maxFileSizeGB}GB)`);
    }

    logger.info("Starting ElevenLabs transcription", {
      audioPath,
      fileSizeMB: fileSizeMB.toFixed(2),
      model: this.model,
      language: options.language || "auto",
    });

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append("file", fs.createReadStream(audioPath));
      formData.append("model_id", this.model);

      // Set language if specified
      if (options.language) {
        formData.append("language_code", options.language);
      }

      // Enable speaker diarization if requested
      if (options.diarize) {
        formData.append("diarize", "true");
      }

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
      const result = this.formatResponse(response.data, processingTime);

      logger.info("ElevenLabs transcription completed", {
        language: result.language,
        duration: result.duration,
        wordCount: result.wordCount,
        processingTimeMs: processingTime,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("ElevenLabs transcription failed", {
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
        throw new Error("ElevenLabs API rate limit exceeded");
      }
      if (error.response?.status === 400) {
        throw new Error(`ElevenLabs API error: ${error.response?.data?.detail || error.message}`);
      }

      throw error;
    }
  }

  /**
   * Format ElevenLabs response to standard format
   * @param {Object} rawResponse - Raw ElevenLabs response
   * @param {number} processingTime - Processing time in ms
   * @returns {TranscriptionResult}
   */
  formatResponse(rawResponse, processingTime) {
    const segments = (rawResponse.words || []).map((word, index) => ({
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

    return {
      text: rawResponse.text,
      language: rawResponse.language_code,
      duration,
      segments,
      wordCount: this.countWords(rawResponse.text),
      confidence: rawResponse.language_probability || null,
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
    return ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "flac", "ogg", "aac"];
  }

  /**
   * Get supported languages (90+ languages)
   * @returns {Array<string>}
   */
  getSupportedLanguages() {
    return [
      // Indian languages
      "en", "hi", "ml", "ta", "te", "gu", "kn", "or", "bn", "mr", "pa", "sd",
      // European
      "es", "fr", "de", "it", "pt", "ru", "pl", "nl", "uk", "cs",
      // Asian
      "ja", "ko", "zh", "th", "vi", "id", "ms",
      // Middle Eastern
      "ar", "fa", "he", "tr",
      // Many more supported
    ];
  }

  /**
   * Estimate cost for transcription (~$0.10-0.30 per hour)
   * @param {string} audioPath
   * @returns {Promise<number>} Estimated cost in USD
   */
  async estimateCost(audioPath) {
    const stats = fs.statSync(audioPath);
    // Rough estimate: assume 128kbps audio
    const durationEstimate = stats.size / (128000 / 8);
    const hours = durationEstimate / 3600;
    return hours * 0.20; // ~$0.20 per hour estimate
  }
}

module.exports = ElevenLabsProvider;
