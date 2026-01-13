/**
 * Transcription Manager
 * Orchestrates multiple transcription providers for parallel comparison
 */

const {
  GroqProvider,
  ElevenLabsProvider,
  SarvamProvider,
  GoogleProvider,
  AzureProvider,
} = require("./providers");
const logger = require("../../utils/logger");

class TranscriptionManager {
  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  /**
   * Initialize all available transcription providers
   */
  initializeProviders() {
    const providerConfigs = [
      { name: "groq", ProviderClass: GroqProvider },
      { name: "elevenlabs", ProviderClass: ElevenLabsProvider },
      { name: "sarvam", ProviderClass: SarvamProvider },
      { name: "google", ProviderClass: GoogleProvider },
      { name: "azure", ProviderClass: AzureProvider },
    ];

    providerConfigs.forEach(({ name, ProviderClass }) => {
      try {
        const provider = new ProviderClass();
        if (provider.initialize()) {
          this.providers.set(name, provider);
          logger.info(`Initialized ${name} transcription provider`);
        } else {
          logger.warn(`${name} provider not available (missing API key or dependencies)`);
        }
      } catch (error) {
        logger.error(`Failed to initialize ${name} provider: ${error.message}`);
      }
    });

    logger.info(`Transcription Manager ready with ${this.providers.size} providers`);
  }

  /**
   * Get list of available provider names
   * @returns {Array<string>}
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get specific provider instance
   * @param {string} providerName - Provider name
   * @returns {BaseTranscriptionService|null}
   */
  getProvider(providerName) {
    return this.providers.get(providerName) || null;
  }

  /**
   * Transcribe audio with a specific provider
   * @param {string} providerName - Provider to use
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribeWith(providerName, audioPath, options = {}) {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider '${providerName}' not available. Available: ${this.getAvailableProviders().join(", ")}`);
    }

    return provider.transcribe(audioPath, options);
  }

  /**
   * Transcribe audio with all available providers in parallel
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Results from all providers
   */
  async transcribeWithAll(audioPath, options = {}) {
    const providers = Array.from(this.providers.entries());

    if (providers.length === 0) {
      throw new Error("No transcription providers available");
    }

    logger.info(`Starting parallel transcription with ${providers.length} providers`, {
      audioPath,
      providers: providers.map(([name]) => name),
      options,
    });

    const startTime = Date.now();

    // Run all transcriptions in parallel
    const results = await Promise.allSettled(
      providers.map(async ([name, provider]) => {
        const providerStartTime = Date.now();
        try {
          const result = await provider.transcribe(audioPath, options);
          return {
            name,
            success: true,
            result,
            error: null,
          };
        } catch (error) {
          logger.error(`${name} transcription failed`, {
            error: error.message,
            processingTimeMs: Date.now() - providerStartTime,
          });
          return {
            name,
            success: false,
            result: null,
            error: error.message,
          };
        }
      })
    );

    const totalTime = Date.now() - startTime;

    // Format results
    const formatted = {
      audioPath,
      timestamp: new Date().toISOString(),
      totalProcessingTimeMs: totalTime,
      options,
      results: {},
    };

    results.forEach((settledResult) => {
      if (settledResult.status === "fulfilled") {
        const { name, success, result, error } = settledResult.value;
        formatted.results[name] = {
          success,
          data: result,
          error,
        };
      } else {
        // Promise rejected (shouldn't happen with our error handling)
        logger.error("Unexpected promise rejection", { reason: settledResult.reason });
      }
    });

    logger.info("Parallel transcription completed", {
      audioPath,
      totalTimeMs: totalTime,
      successCount: Object.values(formatted.results).filter((r) => r.success).length,
      failCount: Object.values(formatted.results).filter((r) => !r.success).length,
    });

    return formatted;
  }

  /**
   * Compare results from multiple providers
   * @param {Object} allResults - Results from transcribeWithAll()
   * @returns {Object} Comparison analysis
   */
  compareResults(allResults) {
    const successful = Object.entries(allResults.results)
      .filter(([_, r]) => r.success && r.data)
      .map(([name, r]) => ({
        name,
        ...r.data,
      }));

    if (successful.length === 0) {
      return {
        error: "No successful transcriptions to compare",
        failedProviders: Object.entries(allResults.results)
          .filter(([_, r]) => !r.success)
          .map(([name, r]) => ({ name, error: r.error })),
      };
    }

    // Find fastest provider
    const fastest = successful.reduce((prev, curr) =>
      curr.processingTimeMs < prev.processingTimeMs ? curr : prev
    );

    // Find slowest provider
    const slowest = successful.reduce((prev, curr) =>
      curr.processingTimeMs > prev.processingTimeMs ? curr : prev
    );

    // Find highest confidence (if available)
    const withConfidence = successful.filter((r) => r.confidence !== null);
    const highestConfidence = withConfidence.length > 0
      ? withConfidence.reduce((prev, curr) =>
          (curr.confidence || 0) > (prev.confidence || 0) ? curr : prev
        )
      : null;

    // Text length comparison
    const textLengths = successful.map((r) => ({
      provider: r.provider,
      length: r.text?.length || 0,
      wordCount: r.wordCount || 0,
    }));

    // Sort by word count to identify potential outliers
    const sortedByWordCount = [...textLengths].sort((a, b) => b.wordCount - a.wordCount);

    // Calculate average word count
    const avgWordCount = textLengths.reduce((sum, t) => sum + t.wordCount, 0) / textLengths.length;

    // Identify outliers (>50% deviation from average)
    const outliers = textLengths.filter(
      (t) => Math.abs(t.wordCount - avgWordCount) > avgWordCount * 0.5
    );

    return {
      summary: {
        totalProviders: Object.keys(allResults.results).length,
        successfulProviders: successful.length,
        failedProviders: Object.keys(allResults.results).length - successful.length,
        totalProcessingTimeMs: allResults.totalProcessingTimeMs,
      },
      fastest: {
        provider: fastest.provider,
        timeMs: fastest.processingTimeMs,
      },
      slowest: {
        provider: slowest.provider,
        timeMs: slowest.processingTimeMs,
      },
      highestConfidence: highestConfidence
        ? {
            provider: highestConfidence.provider,
            confidence: highestConfidence.confidence,
          }
        : null,
      textAnalysis: {
        averageWordCount: Math.round(avgWordCount),
        textLengths: sortedByWordCount,
        outliers: outliers.length > 0 ? outliers : null,
      },
      transcriptions: successful.map((r) => ({
        provider: r.provider,
        model: r.model,
        text: r.text,
        textPreview: r.text?.substring(0, 200) + (r.text?.length > 200 ? "..." : ""),
        wordCount: r.wordCount,
        language: r.language,
        duration: r.duration,
        processingTimeMs: r.processingTimeMs,
        confidence: r.confidence,
        segmentCount: r.segments?.length || 0,
      })),
      failed: Object.entries(allResults.results)
        .filter(([_, r]) => !r.success)
        .map(([name, r]) => ({ provider: name, error: r.error })),
    };
  }

  /**
   * Get the best transcription based on criteria
   * @param {Object} allResults - Results from transcribeWithAll()
   * @param {string} criteria - 'fastest', 'confidence', 'wordCount'
   * @returns {Object|null} Best result or null
   */
  getBestResult(allResults, criteria = "confidence") {
    const comparison = this.compareResults(allResults);

    if (comparison.error) {
      return null;
    }

    switch (criteria) {
      case "fastest":
        return comparison.transcriptions.find(
          (t) => t.provider === comparison.fastest.provider
        );
      case "confidence":
        if (comparison.highestConfidence) {
          return comparison.transcriptions.find(
            (t) => t.provider === comparison.highestConfidence.provider
          );
        }
        // Fall back to fastest if no confidence scores
        return comparison.transcriptions.find(
          (t) => t.provider === comparison.fastest.provider
        );
      case "wordCount":
        return comparison.transcriptions.reduce((prev, curr) =>
          curr.wordCount > prev.wordCount ? curr : prev
        );
      default:
        return comparison.transcriptions[0];
    }
  }

  /**
   * Estimate total cost for transcribing with all providers
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} Cost estimates by provider
   */
  async estimateCosts(audioPath) {
    const estimates = {};

    for (const [name, provider] of this.providers) {
      try {
        estimates[name] = await provider.estimateCost(audioPath);
      } catch (error) {
        estimates[name] = null;
      }
    }

    const total = Object.values(estimates)
      .filter((v) => v !== null)
      .reduce((sum, cost) => sum + cost, 0);

    return {
      byProvider: estimates,
      total,
    };
  }
}

module.exports = TranscriptionManager;
