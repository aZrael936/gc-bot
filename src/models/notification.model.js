/**
 * Notification Model
 * Database operations for notifications table
 */

const Database = require("better-sqlite3");
const config = require("../config");
const logger = require("../utils/logger");

class NotificationModel {
  constructor() {
    this.db = new Database(config.database.path);
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * Create a new notification record
   * @param {Object} data - Notification data
   * @returns {Object} - Created notification record
   */
  create(data) {
    const sql = `
      INSERT INTO notifications (
        id, call_id, user_id, channel, type, message, status, metadata, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(sql);
    const result = stmt.run(
      id,
      data.call_id || null,
      data.user_id || null,
      data.channel,
      data.type || "custom",
      data.message || null,
      data.status || "pending",
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.sent_at || null,
      new Date().toISOString()
    );

    if (result.changes === 0) {
      throw new Error("Failed to create notification record");
    }

    logger.info("Notification record created", {
      id,
      channel: data.channel,
      type: data.type,
    });
    return this.findById(id);
  }

  /**
   * Find notification by ID
   * @param {string} id - Notification ID
   * @returns {Object|null} - Notification record or null
   */
  findById(id) {
    const sql = `SELECT * FROM notifications WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.get(id);
    return this.parseJsonFields(result);
  }

  /**
   * Find notifications by call ID
   * @param {string} callId - Call ID
   * @returns {Array} - Notification records
   */
  findByCallId(callId) {
    const sql = `SELECT * FROM notifications WHERE call_id = ? ORDER BY created_at DESC`;
    const stmt = this.db.prepare(sql);
    const results = stmt.all(callId);
    return results.map((r) => this.parseJsonFields(r));
  }

  /**
   * Find notifications by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} - Notification records
   */
  findByUserId(userId, options = {}) {
    const { limit = 50, offset = 0, status } = options;

    let sql = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [userId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params);
    return results.map((r) => this.parseJsonFields(r));
  }

  /**
   * Update notification status
   * @param {string} id - Notification ID
   * @param {string} status - New status
   * @param {Date} sentAt - Sent timestamp (optional)
   * @returns {Object} - Updated notification record
   */
  updateStatus(id, status, sentAt = null) {
    const sql = `UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(status, sentAt || new Date().toISOString(), id);

    if (result.changes === 0) {
      throw new Error(`Notification not found: ${id}`);
    }

    logger.info("Notification status updated", { id, status });
    return this.findById(id);
  }

  /**
   * Mark notification as sent
   * @param {string} id - Notification ID
   * @returns {Object} - Updated notification record
   */
  markAsSent(id) {
    return this.updateStatus(id, "sent", new Date().toISOString());
  }

  /**
   * Mark notification as failed
   * @param {string} id - Notification ID
   * @param {string} error - Error message
   * @returns {Object} - Updated notification record
   */
  markAsFailed(id, error) {
    const existing = this.findById(id);
    const metadata = existing?.metadata || {};
    metadata.error = error;

    const sql = `UPDATE notifications SET status = ?, metadata = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run("failed", JSON.stringify(metadata), id);

    logger.error("Notification failed", { id, error });
    return this.findById(id);
  }

  /**
   * Get notifications with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Array} - Notification records
   */
  findAll(options = {}) {
    const { limit = 50, offset = 0, status, channel, type, startDate, endDate } = options;

    let sql = `SELECT * FROM notifications WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (channel) {
      sql += ` AND channel = ?`;
      params.push(channel);
    }

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (startDate) {
      sql += ` AND created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND created_at <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params);
    return results.map((r) => this.parseJsonFields(r));
  }

  /**
   * Get pending notifications
   * @param {Object} options - Query options
   * @returns {Array} - Pending notification records
   */
  findPending(options = {}) {
    return this.findAll({ ...options, status: "pending" });
  }

  /**
   * Get notification statistics
   * @param {Object} filters - Filter options
   * @returns {Object} - Statistics
   */
  getStatistics(filters = {}) {
    const { startDate, endDate, channel } = filters;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (startDate) {
      whereClause += ` AND created_at >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND created_at <= ?`;
      params.push(endDate);
    }

    if (channel) {
      whereClause += ` AND channel = ?`;
      params.push(channel);
    }

    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN channel = 'telegram' THEN 1 ELSE 0 END) as telegram_count,
        SUM(CASE WHEN channel = 'console' THEN 1 ELSE 0 END) as console_count,
        SUM(CASE WHEN type = 'low_score_alert' THEN 1 ELSE 0 END) as low_score_alerts,
        SUM(CASE WHEN type = 'critical_issue' THEN 1 ELSE 0 END) as critical_issues,
        SUM(CASE WHEN type = 'daily_digest' THEN 1 ELSE 0 END) as daily_digests
      FROM notifications
      ${whereClause}
    `;

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);

    return {
      total: result.total || 0,
      sent: result.sent || 0,
      pending: result.pending || 0,
      failed: result.failed || 0,
      byChannel: {
        telegram: result.telegram_count || 0,
        console: result.console_count || 0,
      },
      byType: {
        lowScoreAlerts: result.low_score_alerts || 0,
        criticalIssues: result.critical_issues || 0,
        dailyDigests: result.daily_digests || 0,
      },
    };
  }

  /**
   * Get notification count
   * @param {Object} filters - Filter options
   * @returns {number} - Count
   */
  count(filters = {}) {
    const { status, channel, type } = filters;

    let sql = `SELECT COUNT(*) as count FROM notifications WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (channel) {
      sql += ` AND channel = ?`;
      params.push(channel);
    }

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  /**
   * Delete old notifications
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {number} - Number of deleted records
   */
  deleteOld(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const sql = `DELETE FROM notifications WHERE created_at < ? AND status = 'sent'`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(cutoffDate.toISOString());

    logger.info("Old notifications deleted", {
      count: result.changes,
      olderThan: cutoffDate.toISOString(),
    });
    return result.changes;
  }

  /**
   * Parse JSON fields in notification record
   * @param {Object} record - Raw database record
   * @returns {Object|null} - Parsed record
   */
  parseJsonFields(record) {
    if (!record) return null;

    try {
      if (record.metadata) {
        record.metadata = JSON.parse(record.metadata);
      }
    } catch (e) {
      logger.error("Error parsing notification JSON fields", {
        id: record.id,
        error: e.message,
      });
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

module.exports = NotificationModel;
