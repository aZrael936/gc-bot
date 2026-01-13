/**
 * Transcript Model
 * Database operations for transcripts table
 */

const Database = require("better-sqlite3");
const config = require("../config");
const logger = require("../utils/logger");

class TranscriptModel {
  constructor() {
    this.db = new Database(config.database.path);
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * Create a new transcript record
   * @param {Object} data - Transcript data
   * @returns {Object} - Created transcript record
   */
  create(data) {
    const sql = `
      INSERT INTO transcripts (
        id, call_id, content, language, speaker_segments,
        word_count, stt_provider, processing_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(sql);
    const result = stmt.run(
      id,
      data.call_id,
      data.content,
      data.language || null,
      data.speaker_segments ? JSON.stringify(data.speaker_segments) : null,
      data.word_count || 0,
      data.stt_provider || "groq",
      data.processing_time_ms || 0,
      new Date().toISOString()
    );

    if (result.changes === 0) {
      throw new Error("Failed to create transcript record");
    }

    logger.info("Transcript record created", { id, callId: data.call_id });
    return this.findById(id);
  }

  /**
   * Find transcript by ID
   * @param {string} id - Transcript ID
   * @returns {Object|null} - Transcript record or null
   */
  findById(id) {
    const sql = `SELECT * FROM transcripts WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.get(id);

    if (result && result.speaker_segments) {
      result.speaker_segments = JSON.parse(result.speaker_segments);
    }

    return result;
  }

  /**
   * Find transcript by call ID
   * @param {string} callId - Call ID
   * @returns {Object|null} - Transcript record or null
   */
  findByCallId(callId) {
    const sql = `SELECT * FROM transcripts WHERE call_id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.get(callId);

    if (result && result.speaker_segments) {
      result.speaker_segments = JSON.parse(result.speaker_segments);
    }

    return result;
  }

  /**
   * Update transcript record
   * @param {string} id - Transcript ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated transcript record
   */
  update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return this.findById(id);
    }

    // Handle speaker_segments JSON serialization
    const processedValues = values.map((val, idx) => {
      if (fields[idx] === "speaker_segments" && typeof val === "object") {
        return JSON.stringify(val);
      }
      return val;
    });

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `UPDATE transcripts SET ${setClause} WHERE id = ?`;

    processedValues.push(id);

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...processedValues);

    if (result.changes === 0) {
      throw new Error(`Transcript not found: ${id}`);
    }

    logger.info("Transcript record updated", { id, updates: fields });
    return this.findById(id);
  }

  /**
   * Delete transcript by ID
   * @param {string} id - Transcript ID
   * @returns {boolean} - Success status
   */
  delete(id) {
    const sql = `DELETE FROM transcripts WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(id);

    logger.info("Transcript record deleted", { id });
    return result.changes > 0;
  }

  /**
   * Delete transcript by call ID
   * @param {string} callId - Call ID
   * @returns {boolean} - Success status
   */
  deleteByCallId(callId) {
    const sql = `DELETE FROM transcripts WHERE call_id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(callId);

    logger.info("Transcript deleted for call", { callId });
    return result.changes > 0;
  }

  /**
   * Check if transcript exists for call
   * @param {string} callId - Call ID
   * @returns {boolean}
   */
  existsForCall(callId) {
    const sql = `SELECT 1 FROM transcripts WHERE call_id = ? LIMIT 1`;
    const stmt = this.db.prepare(sql);
    return !!stmt.get(callId);
  }

  /**
   * Get transcript count
   * @param {Object} filters - Filter options
   * @returns {number} - Count
   */
  count(filters = {}) {
    const { language, stt_provider } = filters;

    let sql = `SELECT COUNT(*) as count FROM transcripts WHERE 1=1`;
    const params = [];

    if (language) {
      sql += ` AND language = ?`;
      params.push(language);
    }

    if (stt_provider) {
      sql += ` AND stt_provider = ?`;
      params.push(stt_provider);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  /**
   * Get transcripts with pagination
   * @param {Object} options - Query options
   * @returns {Array} - Transcript records
   */
  findAll(options = {}) {
    const { limit = 50, offset = 0, language } = options;

    let sql = `SELECT * FROM transcripts WHERE 1=1`;
    const params = [];

    if (language) {
      sql += ` AND language = ?`;
      params.push(language);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params);

    return results.map((r) => {
      if (r.speaker_segments) {
        r.speaker_segments = JSON.parse(r.speaker_segments);
      }
      return r;
    });
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

module.exports = TranscriptModel;
