/**
 * Call Model
 * Database operations for calls table
 */

const Database = require("better-sqlite3");
const path = require("path");
const config = require("../config");
const logger = require("../utils/logger");

class CallModel {
  constructor() {
    this.db = new Database(config.database.path);
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * Create a new call record
   * @param {Object} callData - Call data
   * @returns {Object} - Created call record
   */
  create(callData) {
    const sql = `
      INSERT INTO calls (
        id, org_id, agent_id, exotel_call_sid, recording_url,
        local_audio_path, duration_seconds, call_type, caller_number,
        callee_number, direction, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(sql);
    const result = stmt.run(
      id,
      callData.org_id,
      callData.agent_id || null,
      callData.exotel_call_sid,
      callData.recording_url,
      callData.local_audio_path || null,
      callData.duration_seconds,
      callData.call_type,
      callData.caller_number,
      callData.callee_number,
      callData.direction,
      callData.status,
      new Date().toISOString()
    );

    if (result.changes === 0) {
      throw new Error("Failed to create call record");
    }

    logger.info("Call record created", {
      id,
      exotelCallSid: callData.exotel_call_sid,
    });
    return this.findById(id);
  }

  /**
   * Find call by ID
   * @param {string} id - Call ID
   * @returns {Object|null} - Call record or null
   */
  findById(id) {
    const sql = `SELECT * FROM calls WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.get(id);
  }

  /**
   * Find call by Exotel CallSid
   * @param {string} callSid - Exotel CallSid
   * @returns {Object|null} - Call record or null
   */
  findByExotelCallSid(callSid) {
    const sql = `SELECT * FROM calls WHERE exotel_call_sid = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.get(callSid);
  }

  /**
   * Update call record
   * @param {string} id - Call ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated call record
   */
  update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (fields.length === 0) {
      return this.findById(id);
    }

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `UPDATE calls SET ${setClause}, updated_at = ? WHERE id = ?`;

    values.push(new Date().toISOString(), id);

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error(`Call not found: ${id}`);
    }

    logger.info("Call record updated", { id, updates });
    return this.findById(id);
  }

  /**
   * Update call status
   * @param {string} id - Call ID
   * @param {string} status - New status
   * @returns {Object} - Updated call record
   */
  updateStatus(id, status) {
    return this.update(id, { status });
  }

  /**
   * Set local audio path
   * @param {string} id - Call ID
   * @param {string} localPath - Local file path
   * @returns {Object} - Updated call record
   */
  setLocalAudioPath(id, localPath) {
    return this.update(id, { local_audio_path: localPath });
  }

  /**
   * Get calls with pagination
   * @param {Object} options - Query options
   * @returns {Array} - Call records
   */
  findAll(options = {}) {
    const { limit = 50, offset = 0, status, org_id } = options;

    let sql = `SELECT * FROM calls WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (org_id) {
      sql += ` AND org_id = ?`;
      params.push(org_id);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Get call count
   * @param {Object} filters - Filter options
   * @returns {number} - Count
   */
  count(filters = {}) {
    const { status, org_id } = filters;

    let sql = `SELECT COUNT(*) as count FROM calls WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (org_id) {
      sql += ` AND org_id = ?`;
      params.push(org_id);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
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

module.exports = CallModel;
