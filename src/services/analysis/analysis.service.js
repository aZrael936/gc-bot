/**
 * Analysis Service
 * Business logic for call quality analysis
 *
 * Orchestrates:
 * - OpenRouter API calls for LLM analysis
 * - Database operations for storing results
 * - Score threshold alerting
 */

const OpenRouterService = require("./openrouter.service");
const { Analysis, Transcript } = require("../../models");
const config = require("../../config");
const logger = require("../../utils/logger");

class AnalysisService {
  constructor() {
    this.openRouter = new OpenRouterService();
    this.thresholds = config.scoring.thresholds;
  }

  /**
   * Initialize the service
   * @returns {boolean}
   */
  initialize() {
    return this.openRouter.initialize();
  }

  /**
   * Check if service is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.openRouter.isAvailable();
  }

  /**
   * Analyze a call by ID
   * @param {string} callId - Call ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeCall(callId, options = {}) {
    logger.info("Starting call analysis", { callId, options });

    // Get transcript for the call
    const transcript = Transcript.findByCallId(callId);

    if (!transcript) {
      throw new Error(`No transcript found for call: ${callId}`);
    }

    if (!transcript.content || transcript.content.trim().length === 0) {
      throw new Error(`Transcript is empty for call: ${callId}`);
    }

    // Check for existing analysis (unless reanalyze is requested)
    if (!options.reanalyze) {
      const existingAnalysis = Analysis.findByCallId(callId);
      if (existingAnalysis) {
        logger.info("Returning existing analysis", { callId, analysisId: existingAnalysis.id });
        return existingAnalysis;
      }
    }

    // Perform LLM analysis
    const startTime = Date.now();
    const analysisResult = await this.openRouter.analyzeTranscript(transcript.content, {
      model: options.model,
      temperature: options.temperature,
    });
    const processingTime = Date.now() - startTime;

    // Delete existing analysis if reanalyzing
    if (options.reanalyze) {
      Analysis.deleteByCallId(callId);
    }

    // Save to database
    const savedAnalysis = Analysis.create({
      call_id: callId,
      overall_score: analysisResult.overall_score,
      category_scores: analysisResult.category_scores,
      issues: analysisResult.issues,
      recommendations: analysisResult.recommendations,
      summary: analysisResult.summary,
      sentiment: analysisResult.sentiment,
      llm_model: analysisResult.metadata?.model,
      prompt_tokens: analysisResult.metadata?.usage?.promptTokens || 0,
      completion_tokens: analysisResult.metadata?.usage?.completionTokens || 0,
      processing_time_ms: processingTime,
    });

    // Add extra fields from analysis
    const enrichedAnalysis = {
      ...savedAnalysis,
      customer_interest_level: analysisResult.customer_interest_level,
      follow_up_priority: analysisResult.follow_up_priority,
      detected_requirements: analysisResult.detected_requirements,
      metadata: analysisResult.metadata,
    };

    // Check thresholds and determine if alert is needed
    const alertNeeded = this.checkAlertThreshold(enrichedAnalysis);
    enrichedAnalysis.alert_triggered = alertNeeded;

    logger.info("Call analysis completed", {
      callId,
      analysisId: savedAnalysis.id,
      overallScore: savedAnalysis.overall_score,
      sentiment: savedAnalysis.sentiment,
      alertTriggered: alertNeeded,
      processingTimeMs: processingTime,
    });

    return enrichedAnalysis;
  }

  /**
   * Re-analyze a call with different model or updated prompts
   * @param {string} callId - Call ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>}
   */
  async reanalyzeCall(callId, options = {}) {
    return this.analyzeCall(callId, { ...options, reanalyze: true });
  }

  /**
   * Get analysis for a call
   * @param {string} callId - Call ID
   * @returns {Object|null}
   */
  getAnalysisByCallId(callId) {
    return Analysis.findByCallId(callId);
  }

  /**
   * Get analysis by ID
   * @param {string} id - Analysis ID
   * @returns {Object|null}
   */
  getAnalysisById(id) {
    return Analysis.findById(id);
  }

  /**
   * Get all analyses with pagination
   * @param {Object} options - Query options
   * @returns {Object}
   */
  getAnalyses(options = {}) {
    const { page = 1, limit = 50, minScore, maxScore, sentiment } = options;
    const offset = (page - 1) * limit;

    const analyses = Analysis.findAll({ limit, offset, minScore, maxScore, sentiment });
    const total = Analysis.count({ minScore, maxScore, sentiment });

    return {
      analyses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get low-scoring calls for review
   * @param {Object} options - Query options
   * @returns {Array}
   */
  getLowScoringCalls(options = {}) {
    const threshold = options.threshold || this.thresholds.alert;
    return Analysis.findLowScoring(threshold, options);
  }

  /**
   * Get analysis statistics
   * @param {Object} filters - Filter options
   * @returns {Object}
   */
  getStatistics(filters = {}) {
    return Analysis.getStatistics(filters);
  }

  /**
   * Check if score triggers an alert
   * @param {Object} analysis - Analysis object
   * @returns {boolean}
   */
  checkAlertThreshold(analysis) {
    return analysis.overall_score < this.thresholds.alert;
  }

  /**
   * Get score classification
   * @param {number} score - Overall score
   * @returns {string}
   */
  getScoreClassification(score) {
    if (score >= this.thresholds.excellent) return "excellent";
    if (score >= this.thresholds.good) return "good";
    if (score >= this.thresholds.alert) return "needs_improvement";
    return "poor";
  }

  /**
   * Get recommended models
   * @returns {Object}
   */
  getRecommendedModels() {
    return this.openRouter.getRecommendedModels();
  }

  /**
   * Get available models from OpenRouter
   * @returns {Promise<Array>}
   */
  async getAvailableModels() {
    return this.openRouter.getAvailableModels();
  }

  /**
   * Generate analysis report for a call
   * @param {string} callId - Call ID
   * @returns {Object}
   */
  generateReport(callId) {
    const analysis = Analysis.findByCallId(callId);
    const transcript = Transcript.findByCallId(callId);

    if (!analysis) {
      throw new Error(`No analysis found for call: ${callId}`);
    }

    const classification = this.getScoreClassification(analysis.overall_score);

    return {
      callId,
      analysisId: analysis.id,
      createdAt: analysis.created_at,
      overallScore: analysis.overall_score,
      classification,
      categoryScores: analysis.category_scores,
      issues: analysis.issues,
      recommendations: analysis.recommendations,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      transcript: {
        wordCount: transcript?.word_count || 0,
        language: transcript?.language || "unknown",
      },
      model: analysis.llm_model,
      processingTimeMs: analysis.processing_time_ms,
    };
  }

  /**
   * Compare two analyses
   * @param {string} analysisId1 - First analysis ID
   * @param {string} analysisId2 - Second analysis ID
   * @returns {Object}
   */
  compareAnalyses(analysisId1, analysisId2) {
    const analysis1 = Analysis.findById(analysisId1);
    const analysis2 = Analysis.findById(analysisId2);

    if (!analysis1 || !analysis2) {
      throw new Error("One or both analyses not found");
    }

    const scoreDiff = analysis2.overall_score - analysis1.overall_score;
    const categoryDiffs = {};

    if (analysis1.category_scores && analysis2.category_scores) {
      for (const category of Object.keys(analysis1.category_scores)) {
        const score1 = analysis1.category_scores[category]?.score || 0;
        const score2 = analysis2.category_scores[category]?.score || 0;
        categoryDiffs[category] = {
          before: score1,
          after: score2,
          diff: score2 - score1,
        };
      }
    }

    return {
      analysis1: {
        id: analysis1.id,
        callId: analysis1.call_id,
        overallScore: analysis1.overall_score,
        model: analysis1.llm_model,
        createdAt: analysis1.created_at,
      },
      analysis2: {
        id: analysis2.id,
        callId: analysis2.call_id,
        overallScore: analysis2.overall_score,
        model: analysis2.llm_model,
        createdAt: analysis2.created_at,
      },
      comparison: {
        overallScoreDiff: scoreDiff,
        improved: scoreDiff > 0,
        categoryDiffs,
      },
    };
  }
}

module.exports = AnalysisService;
