/**
 * OpenRouter Analysis Service
 * Cloud LLM API integration for call quality analysis
 *
 * Supports multiple models via OpenRouter gateway:
 * - DeepSeek (free tier)
 * - GPT-4o-mini (budget)
 * - GPT-4o, Claude 3.5 (premium)
 */

const axios = require("axios");
const config = require("../../config");
const logger = require("../../utils/logger");

class OpenRouterService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = config.openrouter.baseUrl;
    this.defaultModel = config.openrouter.model;
    this.fallbackModel = config.openrouter.fallbackModel;
    this.temperature = config.llm.temperature;
    this.maxTokens = config.llm.maxTokens;
  }

  /**
   * Initialize the service
   * @returns {boolean} - Whether initialization was successful
   */
  initialize() {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      logger.warn("OPENROUTER_API_KEY not set - analysis service unavailable");
      return false;
    }

    this.apiKey = apiKey;
    logger.info("OpenRouter analysis service initialized", { model: this.defaultModel });
    return true;
  }

  /**
   * Check if service is available
   * @returns {boolean}
   */
  isAvailable() {
    return !!process.env.OPENROUTER_API_KEY;
  }

  /**
   * Analyze transcript using OpenRouter API
   * @param {string} transcript - Call transcript text
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeTranscript(transcript, options = {}) {
    const startTime = Date.now();

    // Ensure service is initialized
    if (!this.apiKey) {
      if (!this.initialize()) {
        throw new Error("OpenRouter service not configured - OPENROUTER_API_KEY missing");
      }
    }

    const model = options.model || this.defaultModel;

    logger.info("Starting transcript analysis", {
      model,
      transcriptLength: transcript.length,
      wordCount: this.countWords(transcript),
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: [
            {
              role: "system",
              content: this.getSystemPrompt(),
            },
            {
              role: "user",
              content: this.buildAnalysisPrompt(transcript),
            },
          ],
          temperature: options.temperature || this.temperature,
          max_tokens: options.maxTokens || this.maxTokens,
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": options.referer || "http://localhost:3000",
            "X-Title": options.appTitle || "Sports Infrastructure Sales QC",
          },
          timeout: 120000, // 2 minute timeout
        }
      );

      const processingTime = Date.now() - startTime;
      const result = this.parseAnalysisResponse(response.data, model, processingTime);

      logger.info("Analysis completed", {
        model,
        overallScore: result.overall_score,
        sentiment: result.sentiment,
        processingTimeMs: processingTime,
        tokensUsed: result.metadata?.usage?.totalTokens,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Try fallback model if primary fails
      if (model !== this.fallbackModel && this.shouldRetryWithFallback(error)) {
        logger.warn("Primary model failed, trying fallback", {
          primaryModel: model,
          fallbackModel: this.fallbackModel,
          error: error.message,
        });

        return this.analyzeTranscript(transcript, {
          ...options,
          model: this.fallbackModel,
        });
      }

      logger.error("Analysis failed", {
        model,
        error: error.message,
        status: error.response?.status,
        processingTimeMs: processingTime,
      });

      throw this.handleError(error);
    }
  }

  /**
   * Get system prompt for sports infrastructure sales analysis
   * @returns {string}
   */
  getSystemPrompt() {
    return `You are an expert sales call quality analyst specializing in B2B sports infrastructure sales in India.

COMPANY CONTEXT:
- The company builds and installs sports infrastructure across India
- Products include: turf grounds, basketball courts, badminton courts, tennis courts, swimming pools, sports flooring, gymnasium equipment, running tracks, cricket pitches, and multi-sport complexes
- Target customers: schools, colleges, corporate offices, residential societies, sports clubs, municipal corporations, and private sports academies
- Sales cycle is typically consultative with site visits, quotations, and project proposals

YOUR ROLE:
Analyze sales call transcripts between our sales representatives and potential customers who have enquired about sports infrastructure. Focus on:
1. How well the sales rep understood the customer's requirements
2. Technical knowledge demonstrated about sports infrastructure
3. Ability to handle budget discussions and objections
4. Professionalism and follow-up commitment

LANGUAGE CONSIDERATIONS:
- Calls may be in English, Hindi, or regional Indian languages (Malayalam, Tamil, Kannada, Telugu, etc.)
- Code-switching between languages is common and acceptable
- Focus on communication effectiveness regardless of language

Always respond with valid JSON matching the exact schema requested. Be objective and constructive in feedback.`;
  }

  /**
   * Build analysis prompt with transcript
   * @param {string} transcript - Call transcript
   * @returns {string}
   */
  buildAnalysisPrompt(transcript) {
    return `Analyze this sales call transcript from a sports infrastructure company and provide a detailed quality assessment.

TRANSCRIPT:
---
${transcript}
---

SCORING RUBRIC (Score each category 0-100):

1. GREETING & RAPPORT (15% weight)
   - Professional introduction with name and company
   - Warm and welcoming tone
   - Acknowledging the customer's enquiry source
   - Building initial rapport

2. REQUIREMENT DISCOVERY (25% weight)
   - Understanding the type of sports facility needed
   - Asking about space/area availability
   - Understanding usage patterns (school, commercial, residential)
   - Budget range discussion
   - Timeline expectations
   - Decision-making process understanding

3. PRODUCT KNOWLEDGE & PRESENTATION (20% weight)
   - Clear explanation of relevant products/solutions
   - Technical specifications (materials, dimensions, standards)
   - Customization options
   - Installation process explanation
   - Warranty and maintenance details

4. OBJECTION HANDLING (20% weight)
   - Addressing price concerns professionally
   - Handling timeline objections
   - Responding to quality/durability questions
   - Competitor comparisons handled appropriately
   - Flexibility in solutions offered

5. CLOSING & NEXT STEPS (20% weight)
   - Clear call-to-action proposed
   - Site visit scheduled or offered
   - Quotation/proposal commitment
   - Follow-up timeline established
   - Contact details confirmed

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "overall_score": <weighted average 0-100>,
  "category_scores": {
    "greeting_rapport": {
      "score": <0-100>,
      "weight": 0.15,
      "feedback": "<specific observation about greeting and rapport building>"
    },
    "requirement_discovery": {
      "score": <0-100>,
      "weight": 0.25,
      "feedback": "<specific observation about how requirements were gathered>"
    },
    "product_knowledge": {
      "score": <0-100>,
      "weight": 0.20,
      "feedback": "<specific observation about product presentation>"
    },
    "objection_handling": {
      "score": <0-100>,
      "weight": 0.20,
      "feedback": "<specific observation about handling concerns>"
    },
    "closing_next_steps": {
      "score": <0-100>,
      "weight": 0.20,
      "feedback": "<specific observation about call conclusion>"
    }
  },
  "issues": [
    {
      "type": "<missed_requirement|poor_explanation|weak_closing|unprofessional|missed_opportunity|technical_gap>",
      "severity": "<low|medium|high>",
      "detail": "<specific issue description>",
      "timestamp_hint": "<approximate location in call if identifiable>"
    }
  ],
  "recommendations": [
    "<actionable improvement suggestion 1>",
    "<actionable improvement suggestion 2>",
    "<actionable improvement suggestion 3>"
  ],
  "summary": "<2-3 sentence overall assessment of the call quality>",
  "sentiment": "<positive|neutral|negative>",
  "customer_interest_level": "<low|medium|high>",
  "follow_up_priority": "<low|medium|high|urgent>",
  "detected_requirements": {
    "facility_type": "<type of sports facility discussed or null>",
    "budget_mentioned": "<budget range if mentioned or null>",
    "timeline": "<timeline if mentioned or null>",
    "location": "<location/city if mentioned or null>"
  }
}`;
  }

  /**
   * Parse OpenRouter API response
   * @param {Object} data - API response data
   * @param {string} model - Model used
   * @param {number} processingTime - Processing time in ms
   * @returns {Object}
   */
  parseAnalysisResponse(data, model, processingTime) {
    const content = data.choices[0].message.content;

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse analysis response as JSON");
      }
    }

    // Validate and provide defaults
    analysis = this.validateAnalysis(analysis);

    // Add metadata
    return {
      ...analysis,
      metadata: {
        model: data.model || model,
        provider: data.provider || "openrouter",
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        processingTimeMs: processingTime,
        cost: this.calculateCost(data, model),
      },
    };
  }

  /**
   * Validate analysis object and provide defaults
   * @param {Object} analysis - Parsed analysis
   * @returns {Object}
   */
  validateAnalysis(analysis) {
    // Ensure overall_score exists and is valid
    if (typeof analysis.overall_score !== "number" || analysis.overall_score < 0 || analysis.overall_score > 100) {
      // Calculate from category scores if possible
      if (analysis.category_scores) {
        analysis.overall_score = this.calculateWeightedScore(analysis.category_scores);
      } else {
        analysis.overall_score = 50; // Default
      }
    }

    // Ensure category_scores exists
    if (!analysis.category_scores) {
      analysis.category_scores = {};
    }

    // Ensure arrays exist
    if (!Array.isArray(analysis.issues)) {
      analysis.issues = [];
    }
    if (!Array.isArray(analysis.recommendations)) {
      analysis.recommendations = [];
    }

    // Ensure sentiment is valid
    if (!["positive", "neutral", "negative"].includes(analysis.sentiment)) {
      analysis.sentiment = "neutral";
    }

    // Ensure summary exists
    if (!analysis.summary) {
      analysis.summary = "Analysis completed. See category scores for details.";
    }

    return analysis;
  }

  /**
   * Calculate weighted score from category scores
   * @param {Object} categoryScores - Category scores object
   * @returns {number}
   */
  calculateWeightedScore(categoryScores) {
    const weights = {
      greeting_rapport: 0.15,
      requirement_discovery: 0.25,
      product_knowledge: 0.20,
      objection_handling: 0.20,
      closing_next_steps: 0.20,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [category, data] of Object.entries(categoryScores)) {
      const weight = data.weight || weights[category] || 0.2;
      const score = typeof data.score === "number" ? data.score : (typeof data === "number" ? data : 50);

      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight * 10) / 10 : 50;
  }

  /**
   * Calculate cost based on usage
   * @param {Object} data - API response data
   * @param {string} model - Model used
   * @returns {Object}
   */
  calculateCost(data, model) {
    // Costs per 1M tokens (approximate)
    const modelCosts = {
      "deepseek/deepseek-chat": { prompt: 0, completion: 0 },
      "mistralai/mistral-7b-instruct:free": { prompt: 0, completion: 0 },
      "openai/gpt-4o-mini": { prompt: 0.15, completion: 0.60 },
      "anthropic/claude-3.5-haiku": { prompt: 1.00, completion: 5.00 },
      "openai/gpt-4o": { prompt: 2.50, completion: 10.00 },
      "anthropic/claude-3.5-sonnet": { prompt: 3.00, completion: 15.00 },
    };

    const costs = modelCosts[model] || { prompt: 0, completion: 0 };
    const promptCost = ((data.usage?.prompt_tokens || 0) / 1000000) * costs.prompt;
    const completionCost = ((data.usage?.completion_tokens || 0) / 1000000) * costs.completion;
    const totalCost = promptCost + completionCost;

    return {
      promptCostUSD: promptCost.toFixed(6),
      completionCostUSD: completionCost.toFixed(6),
      totalCostUSD: totalCost.toFixed(6),
      totalCostINR: (totalCost * 84).toFixed(4),
    };
  }

  /**
   * Check if we should retry with fallback model
   * @param {Error} error - The error that occurred
   * @returns {boolean}
   */
  shouldRetryWithFallback(error) {
    // Retry on rate limit, model unavailable, or server errors
    const status = error.response?.status;
    return status === 429 || status === 503 || status === 500 || status === 502;
  }

  /**
   * Handle API errors
   * @param {Error} error - The error
   * @returns {Error}
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      if (status === 401) {
        return new Error("Invalid OPENROUTER_API_KEY");
      }
      if (status === 402) {
        return new Error("Insufficient OpenRouter credits. Add credits at openrouter.ai");
      }
      if (status === 429) {
        return new Error("OpenRouter rate limit exceeded. Please try again later.");
      }
      if (status === 400) {
        return new Error(`OpenRouter API error: ${errorData?.error?.message || "Bad request"}`);
      }
      if (status >= 500) {
        return new Error(`OpenRouter server error (${status}). Please try again.`);
      }

      return new Error(`OpenRouter API error: ${errorData?.error?.message || error.message}`);
    }

    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return new Error("Cannot connect to OpenRouter API. Check internet connection.");
    }

    if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      return new Error("OpenRouter API request timed out. Try again or use a faster model.");
    }

    return error;
  }

  /**
   * Get available models
   * @returns {Promise<Array>}
   */
  async getAvailableModels() {
    if (!this.apiKey) {
      if (!this.initialize()) {
        throw new Error("OpenRouter service not configured");
      }
    }

    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.data.data.map((model) => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing,
        contextLength: model.context_length,
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get recommended models for analysis
   * @returns {Object}
   */
  getRecommendedModels() {
    return {
      free: [
        {
          id: "deepseek/deepseek-chat",
          name: "DeepSeek V3",
          description: "Fast, good quality, FREE - Recommended for development",
        },
        {
          id: "mistralai/mistral-7b-instruct:free",
          name: "Mistral 7B",
          description: "Decent quality, FREE",
        },
      ],
      budget: [
        {
          id: "openai/gpt-4o-mini",
          name: "GPT-4o Mini",
          description: "Excellent value at $0.15/$0.60 per 1M tokens",
        },
        {
          id: "anthropic/claude-3.5-haiku",
          name: "Claude 3.5 Haiku",
          description: "Fast and accurate at $1.00/$5.00 per 1M tokens",
        },
      ],
      premium: [
        {
          id: "openai/gpt-4o",
          name: "GPT-4o",
          description: "Best quality at $2.50/$10.00 per 1M tokens",
        },
        {
          id: "anthropic/claude-3.5-sonnet",
          name: "Claude 3.5 Sonnet",
          description: "Excellent reasoning at $3.00/$15.00 per 1M tokens",
        },
      ],
    };
  }

  /**
   * Count words in text
   * @param {string} text
   * @returns {number}
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}

module.exports = OpenRouterService;
