/**
 * Analysis Model
 * Database operations for analyses table
 */

const Database = require("better-sqlite3");
const config = require("../config");
const logger = require("../utils/logger");

class AnalysisModel {
  constructor() {
    this.db = new Database(config.database.path);
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * Create a new analysis record
   * @param {Object} data - Analysis data
   * @returns {Object} - Created analysis record
   */
  create(data) {
    const sql = `
      INSERT INTO analyses (
        id, call_id, overall_score, category_scores, issues,
        recommendations, summary, sentiment, llm_model,
        prompt_tokens, completion_tokens, processing_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(sql);
    const result = stmt.run(
      id,
      data.call_id,
      data.overall_score,
      data.category_scores ? JSON.stringify(data.category_scores) : null,
      data.issues ? JSON.stringify(data.issues) : null,
      data.recommendations ? JSON.stringify(data.recommendations) : null,
      data.summary || null,
      data.sentiment || null,
      data.llm_model || null,
      data.prompt_tokens || 0,
      data.completion_tokens || 0,
      data.processing_time_ms || 0,
      new Date().toISOString()
    );

    if (result.changes === 0) {
      throw new Error("Failed to create analysis record");
    }

    logger.info("Analysis record created", { id, callId: data.call_id, score: data.overall_score });
    return this.findById(id);
  }

  /**
   * Find analysis by ID
   * @param {string} id - Analysis ID
   * @returns {Object|null} - Analysis record or null
   */
  findById(id) {
    const sql = `SELECT * FROM analyses WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.get(id);

    return this.parseJsonFields(result);
  }

  /**
   * Find analysis by call ID
   * @param {string} callId - Call ID
   * @returns {Object|null} - Analysis record or null
   */
  findByCallId(callId) {
    const sql = `SELECT * FROM analyses WHERE call_id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.get(callId);

    return this.parseJsonFields(result);
  }

  /**
   * Find all analyses for a call (including re-analyses)
   * @param {string} callId - Call ID
   * @returns {Array} - Analysis records
   */
  findAllByCallId(callId) {
    const sql = `SELECT * FROM analyses WHERE call_id = ? ORDER BY created_at DESC`;
    const stmt = this.db.prepare(sql);
    const results = stmt.all(callId);

    return results.map(r => this.parseJsonFields(r));
  }

  /**
   * Update analysis record
   * @param {string} id - Analysis ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated analysis record
   */
  update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return this.findById(id);
    }

    // Handle JSON serialization
    const processedValues = values.map((val, idx) => {
      const field = fields[idx];
      if (["category_scores", "issues", "recommendations"].includes(field) && typeof val === "object") {
        return JSON.stringify(val);
      }
      return val;
    });

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `UPDATE analyses SET ${setClause} WHERE id = ?`;

    processedValues.push(id);

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...processedValues);

    if (result.changes === 0) {
      throw new Error(`Analysis not found: ${id}`);
    }

    logger.info("Analysis record updated", { id, updates: fields });
    return this.findById(id);
  }

  /**
   * Delete analysis by ID
   * @param {string} id - Analysis ID
   * @returns {boolean} - Success status
   */
  delete(id) {
    const sql = `DELETE FROM analyses WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(id);

    logger.info("Analysis record deleted", { id });
    return result.changes > 0;
  }

  /**
   * Delete analysis by call ID
   * @param {string} callId - Call ID
   * @returns {boolean} - Success status
   */
  deleteByCallId(callId) {
    const sql = `DELETE FROM analyses WHERE call_id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(callId);

    logger.info("Analysis deleted for call", { callId });
    return result.changes > 0;
  }

  /**
   * Check if analysis exists for call
   * @param {string} callId - Call ID
   * @returns {boolean}
   */
  existsForCall(callId) {
    const sql = `SELECT 1 FROM analyses WHERE call_id = ? LIMIT 1`;
    const stmt = this.db.prepare(sql);
    return !!stmt.get(callId);
  }

  /**
   * Get analyses with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Array} - Analysis records
   */
  findAll(options = {}) {
    const { limit = 50, offset = 0, minScore, maxScore, sentiment } = options;

    let sql = `SELECT * FROM analyses WHERE 1=1`;
    const params = [];

    if (minScore !== undefined) {
      sql += ` AND overall_score >= ?`;
      params.push(minScore);
    }

    if (maxScore !== undefined) {
      sql += ` AND overall_score <= ?`;
      params.push(maxScore);
    }

    if (sentiment) {
      sql += ` AND sentiment = ?`;
      params.push(sentiment);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params);

    return results.map(r => this.parseJsonFields(r));
  }

  /**
   * Get low-scoring analyses (for alerts)
   * @param {number} threshold - Score threshold
   * @param {Object} options - Query options
   * @returns {Array} - Analysis records
   */
  findLowScoring(threshold = 50, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const sql = `
      SELECT a.*, c.agent_id, c.caller_number, c.callee_number
      FROM analyses a
      JOIN calls c ON a.call_id = c.id
      WHERE a.overall_score < ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db.prepare(sql);
    const results = stmt.all(threshold, limit, offset);

    return results.map(r => this.parseJsonFields(r));
  }

  /**
   * Get analysis statistics
   * @param {Object} filters - Filter options
   * @returns {Object} - Statistics
   */
  getStatistics(filters = {}) {
    const { orgId, startDate, endDate } = filters;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (orgId) {
      whereClause += ` AND c.org_id = ?`;
      params.push(orgId);
    }

    if (startDate) {
      whereClause += ` AND a.created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND a.created_at <= ?`;
      params.push(endDate);
    }

    const sql = `
      SELECT
        COUNT(*) as total_analyses,
        AVG(a.overall_score) as avg_score,
        MIN(a.overall_score) as min_score,
        MAX(a.overall_score) as max_score,
        SUM(CASE WHEN a.overall_score >= 70 THEN 1 ELSE 0 END) as good_calls,
        SUM(CASE WHEN a.overall_score < 50 THEN 1 ELSE 0 END) as poor_calls,
        SUM(CASE WHEN a.sentiment = 'positive' THEN 1 ELSE 0 END) as positive_sentiment,
        SUM(CASE WHEN a.sentiment = 'negative' THEN 1 ELSE 0 END) as negative_sentiment
      FROM analyses a
      JOIN calls c ON a.call_id = c.id
      ${whereClause}
    `;

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);

    return {
      totalAnalyses: result.total_analyses || 0,
      avgScore: result.avg_score ? Math.round(result.avg_score * 10) / 10 : 0,
      minScore: result.min_score || 0,
      maxScore: result.max_score || 0,
      goodCalls: result.good_calls || 0,
      poorCalls: result.poor_calls || 0,
      positiveSentiment: result.positive_sentiment || 0,
      negativeSentiment: result.negative_sentiment || 0,
    };
  }

  /**
   * Get analysis count
   * @param {Object} filters - Filter options
   * @returns {number} - Count
   */
  count(filters = {}) {
    const { sentiment, minScore, maxScore } = filters;

    let sql = `SELECT COUNT(*) as count FROM analyses WHERE 1=1`;
    const params = [];

    if (sentiment) {
      sql += ` AND sentiment = ?`;
      params.push(sentiment);
    }

    if (minScore !== undefined) {
      sql += ` AND overall_score >= ?`;
      params.push(minScore);
    }

    if (maxScore !== undefined) {
      sql += ` AND overall_score <= ?`;
      params.push(maxScore);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  /**
   * Parse JSON fields in analysis record
   * @param {Object} record - Raw database record
   * @returns {Object|null} - Parsed record
   */
  parseJsonFields(record) {
    if (!record) return null;

    try {
      if (record.category_scores) {
        record.category_scores = JSON.parse(record.category_scores);
      }
      if (record.issues) {
        record.issues = JSON.parse(record.issues);
      }
      if (record.recommendations) {
        record.recommendations = JSON.parse(record.recommendations);
      }
    } catch (e) {
      logger.error("Error parsing analysis JSON fields", { id: record.id, error: e.message });
    }

    return record;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = AnalysisModel;
