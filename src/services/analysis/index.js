/**
 * Analysis Services Index
 * Export analysis-related services
 */

const AnalysisService = require("./analysis.service");
const OpenRouterService = require("./openrouter.service");

// Create singleton instances
const analysisService = new AnalysisService();
const openRouterService = new OpenRouterService();

module.exports = {
  AnalysisService,
  OpenRouterService,
  Analysis: analysisService,
  OpenRouter: openRouterService,
};
