/**
 * Google Cloud Speech-to-Text Provider
 * Transcription using Google Cloud STT V2 with Chirp 3 model
 *
 * Enterprise-grade, highly accurate, global infrastructure
 * Features: Malayalam (ml-IN) with Chirp 2 & 3 models, auto punctuation
 */

const BaseTranscriptionService = require("../base.transcription.service");
const fs = require("fs");
const path = require("path");
const logger = require("../../../utils/logger");

class GoogleProvider extends BaseTranscriptionService {
  constructor(config = {}) {
    super(config);
    this.providerName = "google";
    this.model = "chirp_2"; // chirp_2 is more widely available, chirp_3 is newer
    this.client = null;
    this.projectId = null;
    this.location = "asia-south1"; // India region
  }

  /**
   * Initialize Google Cloud Speech client
   * @returns {boolean} Success status
   */
  initialize() {
    // Check for credentials file
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT;

    if (!credentialsPath) {
      logger.warn("GOOGLE_APPLICATION_CREDENTIALS not set - Google provider unavailable");
      return false;
    }

    if (!fs.existsSync(credentialsPath)) {
      logger.warn(`Google credentials file not found: ${credentialsPath}`);
      return false;
    }

    if (!this.projectId) {
      // Try to extract from credentials file
      try {
        const creds = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
        this.projectId = creds.project_id;
      } catch (e) {
        logger.warn("GOOGLE_CLOUD_PROJECT not set and could not extract from credentials");
        return false;
      }
    }

    try {
      // Dynamic import to avoid errors if not installed
      const speech = require("@google-cloud/speech").v2;
      this.client = new speech.SpeechClient({
        keyFilename: credentialsPath,
      });
      this.apiKey = "configured"; // Mark as configured
      logger.info("Google Cloud Speech transcription provider initialized");
      return true;
    } catch (error) {
      logger.warn(`Failed to initialize Google Cloud Speech: ${error.message}`);
      logger.warn("Install with: npm install @google-cloud/speech");
      return false;
    }
  }

  /**
   * Transcribe audio file using Google Cloud STT
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioPath, options = {}) {
    const startTime = Date.now();

    // Ensure client is initialized
    if (!this.client) {
      if (!this.initialize()) {
        throw new Error("Google provider not configured - check GOOGLE_APPLICATION_CREDENTIALS");
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

    // Map language code to Google format
    const languageCode = this.mapLanguageCode(options.language);

    logger.info("Starting Google Cloud transcription", {
      audioPath,
      fileSizeMB: fileSizeMB.toFixed(2),
      model: this.model,
      language: languageCode,
    });

    try {
      // Read audio file and convert to base64
      const audioBytes = fs.readFileSync(audioPath).toString("base64");

      // Prepare recognition request
      const request = {
        recognizer: `projects/${this.projectId}/locations/${this.location}/recognizers/_`,
        config: {
          autoDecodingConfig: {},
          languageCodes: [languageCode],
          model: this.model,
          features: {
            enableAutomaticPunctuation: true,
            enableWordTimeOffsets: options.timestamps !== false,
            enableWordConfidence: true,
          },
        },
        content: audioBytes,
      };

      // Call Google Cloud STT API
      const [response] = await this.client.recognize(request);

      const processingTime = Date.now() - startTime;
      const result = this.formatResponse(response, processingTime, languageCode);

      logger.info("Google Cloud transcription completed", {
        language: result.language,
        duration: result.duration,
        wordCount: result.wordCount,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("Google Cloud transcription failed", {
        audioPath,
        error: error.message,
        code: error.code,
        processingTimeMs: processingTime,
      });

      // Handle specific errors
      if (error.code === 7) {
        throw new Error("Google Cloud Speech API not enabled or permission denied");
      }
      if (error.code === 3) {
        throw new Error(`Invalid request: ${error.message}`);
      }
      if (error.code === 8) {
        throw new Error("Google Cloud API quota exceeded");
      }

      throw error;
    }
  }

  /**
   * Map language code to Google format
   * @param {string} language - Short language code
   * @returns {string} Google language code
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
      en: "en-US",     // English (US)
    };

    if (!language) {
      return "ml-IN"; // Default to Malayalam
    }

    return languageMap[language] || languageMap[language.split("-")[0]] || "ml-IN";
  }

  /**
   * Format Google response to standard format
   * @param {Object} rawResponse - Raw Google response
   * @param {number} processingTime - Processing time in ms
   * @param {string} languageCode - Language code used
   * @returns {TranscriptionResult}
   */
  formatResponse(rawResponse, processingTime, languageCode) {
    const results = rawResponse.results || [];

    // Extract all transcripts
    const text = results
      .map((result) => result.alternatives?.[0]?.transcript || "")
      .join(" ")
      .trim();

    // Extract all words with timestamps
    const segments = [];
    let wordId = 0;

    results.forEach((result) => {
      const words = result.alternatives?.[0]?.words || [];
      words.forEach((word) => {
        segments.push({
          id: wordId++,
          start: this.parseGoogleDuration(word.startOffset),
          end: this.parseGoogleDuration(word.endOffset),
          text: word.word,
          confidence: word.confidence || null,
        });
      });
    });

    // Calculate duration from last word
    const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;

    // Get overall confidence
    const confidence = results[0]?.alternatives?.[0]?.confidence || null;

    return {
      text,
      language: results[0]?.languageCode || languageCode,
      duration,
      segments,
      wordCount: this.countWords(text),
      confidence,
      processingTimeMs: processingTime,
      model: this.model,
      provider: this.providerName,
      raw: rawResponse,
    };
  }

  /**
   * Parse Google duration format to seconds
   * @param {Object} duration - Google duration object
   * @returns {number} Duration in seconds
   */
  parseGoogleDuration(duration) {
    if (!duration) return 0;
    const seconds = parseInt(duration.seconds || "0", 10);
    const nanos = parseInt(duration.nanos || "0", 10);
    return seconds + nanos / 1e9;
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>}
   */
  getSupportedFormats() {
    return ["mp3", "wav", "flac", "ogg", "webm", "m4a"];
  }

  /**
   * Get supported languages
   * @returns {Array<string>}
   */
  getSupportedLanguages() {
    return [
      "ml", "hi", "ta", "te", "gu", "kn", "bn", "mr", "pa",
      "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh", "ar",
    ];
  }

  /**
   * Estimate cost for transcription (~$1.44 per hour for Chirp)
   * @param {string} audioPath
   * @returns {Promise<number>} Estimated cost in USD
   */
  async estimateCost(audioPath) {
    const stats = fs.statSync(audioPath);
    const durationEstimate = stats.size / (128000 / 8);
    const hours = durationEstimate / 3600;
    return hours * 1.44; // ~$1.44 per hour for Chirp model
  }
}

module.exports = GoogleProvider;
