/**
 * Analysis Controller
 * Handles HTTP requests for call analysis operations
 */

const { Analysis, Call } = require("../services");
const config = require("../config");
const logger = require("../utils/logger");

/**
 * Get analysis for a specific call
 * GET /api/calls/:callId/analysis
 */
const getCallAnalysis = async (req, res) => {
  try {
    const { callId } = req.params;

    // Verify call exists
    const call = await Call.getCallById(callId);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: "Call not found",
        callId,
      });
    }

    const analysis = Analysis.getAnalysisByCallId(callId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: "Analysis not found for this call",
        callId,
        hint: "The call may not have been analyzed yet. Use POST /api/calls/:callId/analyze to trigger analysis.",
      });
    }

    // Add score classification
    const classification = Analysis.getScoreClassification(analysis.overall_score);

    res.json({
      success: true,
      data: {
        ...analysis,
        classification,
        thresholds: config.scoring.thresholds,
      },
    });
  } catch (error) {
    logger.error("Error getting call analysis", { callId: req.params.callId, error });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve analysis",
      message: error.message,
    });
  }
};

/**
 * Trigger analysis for a call
 * POST /api/calls/:callId/analyze
 */
const analyzeCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { model, async: runAsync } = req.body;

    // Verify call exists
    const call = await Call.getCallById(callId);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: "Call not found",
        callId,
      });
    }

    // Check if analysis service is available
    if (!Analysis.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: "Analysis service not available",
        hint: "Ensure OPENROUTER_API_KEY is configured in environment",
      });
    }

    // If async, queue the job and return immediately
    if (runAsync) {
      const job = await Call.queueAnalysisJob(callId);
      return res.status(202).json({
        success: true,
        message: "Analysis job queued",
        jobId: job.id,
        callId,
        checkStatus: `/api/calls/${callId}/analysis`,
      });
    }

    // Perform synchronous analysis
    const result = await Analysis.analyzeCall(callId, { model });

    res.json({
      success: true,
      message: "Analysis completed",
      data: {
        ...result,
        classification: Analysis.getScoreClassification(result.overall_score),
      },
    });
  } catch (error) {
    logger.error("Error analyzing call", { callId: req.params.callId, error });

    if (error.message.includes("No transcript found")) {
      return res.status(400).json({
        success: false,
        error: "Cannot analyze call without transcript",
        hint: "Ensure the call has been transcribed first",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to analyze call",
      message: error.message,
    });
  }
};

/**
 * Re-analyze a call with different model or settings
 * POST /api/calls/:callId/reanalyze
 */
const reanalyzeCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { model, async: runAsync } = req.body;

    // Verify call exists
    const call = await Call.getCallById(callId);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: "Call not found",
        callId,
      });
    }

    // Check if analysis service is available
    if (!Analysis.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: "Analysis service not available",
        hint: "Ensure OPENROUTER_API_KEY is configured in environment",
      });
    }

    // If async, queue the job
    if (runAsync) {
      const { queues } = require("../workers");
      const job = await queues.analysis.add(
        `reanalyze-${callId}`,
        {
          callId,
          model,
          reanalyze: true,
          type: "call-reanalysis",
          timestamp: new Date().toISOString(),
        },
        {
          priority: 2,
          attempts: 2,
        }
      );

      return res.status(202).json({
        success: true,
        message: "Re-analysis job queued",
        jobId: job.id,
        callId,
        checkStatus: `/api/calls/${callId}/analysis`,
      });
    }

    // Perform synchronous re-analysis
    const result = await Analysis.reanalyzeCall(callId, { model });

    res.json({
      success: true,
      message: "Re-analysis completed",
      data: {
        ...result,
        classification: Analysis.getScoreClassification(result.overall_score),
      },
    });
  } catch (error) {
    logger.error("Error re-analyzing call", { callId: req.params.callId, error });
    res.status(500).json({
      success: false,
      error: "Failed to re-analyze call",
      message: error.message,
    });
  }
};

/**
 * Get analysis report for a call
 * GET /api/calls/:callId/report
 */
const getCallReport = async (req, res) => {
  try {
    const { callId } = req.params;

    const report = Analysis.generateReport(callId);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error("Error generating report", { callId: req.params.callId, error });

    if (error.message.includes("No analysis found")) {
      return res.status(404).json({
        success: false,
        error: "No analysis found for this call",
        hint: "Analyze the call first using POST /api/calls/:callId/analyze",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate report",
      message: error.message,
    });
  }
};

/**
 * Get all analyses with pagination
 * GET /api/analyses
 */
const getAnalyses = async (req, res) => {
  try {
    const { page = 1, limit = 50, minScore, maxScore, sentiment } = req.query;

    const result = Analysis.getAnalyses({
      page: parseInt(page),
      limit: parseInt(limit),
      minScore: minScore ? parseFloat(minScore) : undefined,
      maxScore: maxScore ? parseFloat(maxScore) : undefined,
      sentiment,
    });

    // Add classification to each analysis
    result.analyses = result.analyses.map((a) => ({
      ...a,
      classification: Analysis.getScoreClassification(a.overall_score),
    }));

    res.json({
      success: true,
      data: result.analyses,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("Error getting analyses", { error });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve analyses",
      message: error.message,
    });
  }
};

/**
 * Get low-scoring calls for review
 * GET /api/analyses/alerts
 */
const getAlerts = async (req, res) => {
  try {
    const { threshold, page = 1, limit = 50 } = req.query;

    const alerts = Analysis.getLowScoringCalls({
      threshold: threshold ? parseFloat(threshold) : config.scoring.thresholds.alert,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      data: alerts.map((a) => ({
        ...a,
        classification: Analysis.getScoreClassification(a.overall_score),
      })),
      threshold: threshold ? parseFloat(threshold) : config.scoring.thresholds.alert,
      count: alerts.length,
    });
  } catch (error) {
    logger.error("Error getting alerts", { error });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve alerts",
      message: error.message,
    });
  }
};

/**
 * Get analysis statistics
 * GET /api/analyses/statistics
 */
const getStatistics = async (req, res) => {
  try {
    const { orgId, startDate, endDate } = req.query;

    const statistics = Analysis.getStatistics({
      orgId,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: {
        ...statistics,
        thresholds: config.scoring.thresholds,
      },
    });
  } catch (error) {
    logger.error("Error getting statistics", { error });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve statistics",
      message: error.message,
    });
  }
};

/**
 * Get recommended models
 * GET /api/analyses/models
 */
const getModels = async (req, res) => {
  try {
    const recommended = Analysis.getRecommendedModels();

    res.json({
      success: true,
      data: {
        recommended,
        currentModel: config.openrouter.model,
        fallbackModel: config.openrouter.fallbackModel,
      },
    });
  } catch (error) {
    logger.error("Error getting models", { error });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve models",
      message: error.message,
    });
  }
};

/**
 * Get analysis by ID
 * GET /api/analyses/:analysisId
 */
const getAnalysisById = async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = Analysis.getAnalysisById(analysisId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: "Analysis not found",
        analysisId,
      });
    }

    res.json({
      success: true,
      data: {
        ...analysis,
        classification: Analysis.getScoreClassification(analysis.overall_score),
      },
    });
  } catch (error) {
    logger.error("Error getting analysis", { analysisId: req.params.analysisId, error });
    res.status(500).json({
      success: false,
      error: "Failed to retrieve analysis",
      message: error.message,
    });
  }
};

module.exports = {
  getCallAnalysis,
  analyzeCall,
  reanalyzeCall,
  getCallReport,
  getAnalyses,
  getAlerts,
  getStatistics,
  getModels,
  getAnalysisById,
};
