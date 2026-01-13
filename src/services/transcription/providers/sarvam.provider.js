/**
 * Sarvam.ai Provider
 * Transcription using Sarvam Saarika v2 API
 *
 * Optimized for Indian accents, code-mixing, and colloquial speech
 * Features: 10+ Indian languages, 3x faster processing, code-switching support
 */

const BaseTranscriptionService = require("../base.transcription.service");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const logger = require("../../../utils/logger");

class SarvamProvider extends BaseTranscriptionService {
  constructor(config = {}) {
    super(config);
    this.providerName = "sarvam";
    this.model = "saarika:v2";
    this.baseUrl = "https://api.sarvam.ai";
  }

  /**
   * Initialize Sarvam client
   * @returns {boolean} Success status
   */
  initialize() {
    this.apiKey = process.env.SARVAM_API_KEY;

    if (!this.apiKey) {
      logger.warn("SARVAM_API_KEY not set - Sarvam provider unavailable");
      return false;
    }

    logger.info("Sarvam.ai transcription provider initialized");
    return true;
  }

  /**
   * Transcribe audio file using Sarvam Saarika
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioPath, options = {}) {
    const startTime = Date.now();

    // Ensure client is initialized
    if (!this.apiKey) {
      if (!this.initialize()) {
        throw new Error("Sarvam provider not configured - SARVAM_API_KEY missing");
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

    logger.info("Starting Sarvam transcription", {
      audioPath,
      fileSizeMB: fileSizeMB.toFixed(2),
      model: this.model,
      language: options.language || "auto",
    });

    try {
      // Convert audio to base64
      const audioBuffer = fs.readFileSync(audioPath);
      const audioBase64 = audioBuffer.toString("base64");

      // Determine MIME type from extension
      const ext = path.extname(audioPath).toLowerCase().slice(1);
      const mimeTypes = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        flac: "audio/flac",
        m4a: "audio/m4a",
        ogg: "audio/ogg",
        webm: "audio/webm",
      };
      const mimeType = mimeTypes[ext] || "audio/mpeg";

      // Map language code to Sarvam format (e.g., 'ml' -> 'ml-IN')
      const languageCode = this.mapLanguageCode(options.language);

      // Call Sarvam API
      const response = await axios.post(
        `${this.baseUrl}/speech-to-text`,
        {
          audio_uri: `data:${mimeType};base64,${audioBase64}`,
          language_code: languageCode,
          model: this.model,
          with_timestamps: options.timestamps !== false,
          enable_inverse_text_normalization: true,
        },
        {
          headers: {
            "api-subscription-key": this.apiKey,
            "Content-Type": "application/json",
          },
          timeout: 300000, // 5 minute timeout
        }
      );

      const processingTime = Date.now() - startTime;
      const result = this.formatResponse(response.data, processingTime);

      logger.info("Sarvam transcription completed", {
        language: result.language,
        duration: result.duration,
        wordCount: result.wordCount,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("Sarvam transcription failed", {
        audioPath,
        error: error.message,
        status: error.response?.status,
        processingTimeMs: processingTime,
      });

      // Handle specific errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error("Invalid SARVAM_API_KEY");
      }
      if (error.response?.status === 413) {
        throw new Error("Audio file too large for Sarvam API");
      }
      if (error.response?.status === 429) {
        throw new Error("Sarvam API rate limit exceeded");
      }
      if (error.response?.status === 400) {
        throw new Error(`Sarvam API error: ${error.response?.data?.message || error.message}`);
      }

      throw error;
    }
  }

  /**
   * Map language code to Sarvam format
   * @param {string} language - Short language code
   * @returns {string} Sarvam language code
   */
  mapLanguageCode(language) {
    const languageMap = {
      ml: "ml-IN",     // Malayalam
      hi: "hi-IN",     // Hindi
      ta: "ta-IN",     // Tamil
      te: "te-IN",     // Telugu
      gu: "gu-IN",     // Gujarati
      kn: "kn-IN",     // Kannada
      bn: "bn-IN",     // Bengali
      mr: "mr-IN",     // Marathi
      pa: "pa-IN",     // Punjabi
      or: "or-IN",     // Odia
      en: "en-IN",     // English (Indian)
    };

    if (!language) {
      return "ml-IN"; // Default to Malayalam
    }

    return languageMap[language] || languageMap[language.split("-")[0]] || "ml-IN";
  }

  /**
   * Format Sarvam response to standard format
   * @param {Object} rawResponse - Raw Sarvam response
   * @param {number} processingTime - Processing time in ms
   * @returns {TranscriptionResult}
   */
  formatResponse(rawResponse, processingTime) {
    const segments = (rawResponse.words || []).map((word, index) => ({
      id: index,
      start: word.start_time || word.start || 0,
      end: word.end_time || word.end || 0,
      text: word.word || word.text,
      confidence: word.confidence || null,
    }));

    return {
      text: rawResponse.transcript,
      language: rawResponse.language_code,
      duration: rawResponse.duration || (segments.length > 0 ? segments[segments.length - 1].end : 0),
      segments,
      wordCount: this.countWords(rawResponse.transcript),
      confidence: rawResponse.confidence || null,
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
    return ["mp3", "wav", "flac", "m4a", "ogg", "webm"];
  }

  /**
   * Get supported languages (Indian languages focus)
   * @returns {Array<string>}
   */
  getSupportedLanguages() {
    return ["ml", "hi", "ta", "te", "gu", "kn", "bn", "mr", "pa", "or", "en"];
  }

  /**
   * Estimate cost for transcription (competitive Indian market pricing)
   * @param {string} audioPath
   * @returns {Promise<number>} Estimated cost in USD
   */
  async estimateCost(audioPath) {
    const stats = fs.statSync(audioPath);
    const durationEstimate = stats.size / (128000 / 8);
    const hours = durationEstimate / 3600;
    return hours * 0.10; // Estimated ~$0.10 per hour
  }
}

module.exports = SarvamProvider;
