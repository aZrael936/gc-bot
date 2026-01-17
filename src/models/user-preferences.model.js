/**
 * User Notification Preferences Model
 * Database operations for user_notification_preferences table
 */

const Database = require("better-sqlite3");
const config = require("../config");
const logger = require("../utils/logger");

class UserPreferencesModel {
  constructor() {
    this.db = new Database(config.database.path);
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * Create or update user notification preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Preference settings
   * @returns {Object} - Created/updated preferences record
   */
  upsert(userId, preferences = {}) {
    const existing = this.findByUserId(userId);

    if (existing) {
      return this.update(userId, preferences);
    }

    const sql = `
      INSERT INTO user_notification_preferences (
        id, user_id, telegram_enabled, telegram_chat_id, email_enabled,
        console_enabled, alert_low_score, alert_critical_issue,
        daily_digest, low_score_threshold, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(sql);
    const result = stmt.run(
      id,
      userId,
      preferences.telegram_enabled !== undefined ? (preferences.telegram_enabled ? 1 : 0) : 1,
      preferences.telegram_chat_id || null,
      preferences.email_enabled !== undefined ? (preferences.email_enabled ? 1 : 0) : 0,
      preferences.console_enabled !== undefined ? (preferences.console_enabled ? 1 : 0) : 1,
      preferences.alert_low_score !== undefined ? (preferences.alert_low_score ? 1 : 0) : 1,
      preferences.alert_critical_issue !== undefined ? (preferences.alert_critical_issue ? 1 : 0) : 1,
      preferences.daily_digest !== undefined ? (preferences.daily_digest ? 1 : 0) : 1,
      preferences.low_score_threshold || config.scoring.thresholds.alert,
      now,
      now
    );

    if (result.changes === 0) {
      throw new Error("Failed to create user preferences");
    }

    logger.info("User notification preferences created", { userId, id });
    return this.findByUserId(userId);
  }

  /**
   * Find preferences by user ID
   * @param {string} userId - User ID
   * @returns {Object|null} - Preferences record or null
   */
  findByUserId(userId) {
    const sql = `SELECT * FROM user_notification_preferences WHERE user_id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.get(userId);
    return this.formatPreferences(result);
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated preferences record
   */
  update(userId, updates) {
    const allowedFields = [
      "telegram_enabled",
      "telegram_chat_id",
      "email_enabled",
      "console_enabled",
      "alert_low_score",
      "alert_critical_issue",
      "daily_digest",
      "low_score_threshold",
    ];

    const fields = Object.keys(updates).filter((f) => allowedFields.includes(f));
    if (fields.length === 0) {
      return this.findByUserId(userId);
    }

    // Convert boolean fields to integers
    const booleanFields = [
      "telegram_enabled",
      "email_enabled",
      "console_enabled",
      "alert_low_score",
      "alert_critical_issue",
      "daily_digest",
    ];

    const values = fields.map((field) => {
      const val = updates[field];
      if (booleanFields.includes(field)) {
        return val ? 1 : 0;
      }
      return val;
    });

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `UPDATE user_notification_preferences SET ${setClause}, updated_at = ? WHERE user_id = ?`;

    values.push(new Date().toISOString(), userId);

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error(`User preferences not found for user: ${userId}`);
    }

    logger.info("User notification preferences updated", { userId, updates: fields });
    return this.findByUserId(userId);
  }

  /**
   * Get all users with specific channel enabled
   * @param {string} channel - Channel name (telegram, email, console)
   * @returns {Array} - Users with channel enabled
   */
  findByChannelEnabled(channel) {
    const columnName = `${channel}_enabled`;

    const sql = `
      SELECT unp.*, u.name as user_name, u.email as user_email
      FROM user_notification_preferences unp
      JOIN users u ON unp.user_id = u.id
      WHERE unp.${columnName} = 1
    `;

    const stmt = this.db.prepare(sql);
    const results = stmt.all();
    return results.map((r) => this.formatPreferences(r));
  }

  /**
   * Get users who want low score alerts
   * @returns {Array} - Users with low score alerts enabled
   */
  findUsersForLowScoreAlerts() {
    const sql = `
      SELECT unp.*, u.name as user_name, u.email as user_email
      FROM user_notification_preferences unp
      JOIN users u ON unp.user_id = u.id
      WHERE unp.alert_low_score = 1
    `;

    const stmt = this.db.prepare(sql);
    const results = stmt.all();
    return results.map((r) => this.formatPreferences(r));
  }

  /**
   * Get users who want daily digest
   * @returns {Array} - Users with daily digest enabled
   */
  findUsersForDailyDigest() {
    const sql = `
      SELECT unp.*, u.name as user_name, u.email as user_email
      FROM user_notification_preferences unp
      JOIN users u ON unp.user_id = u.id
      WHERE unp.daily_digest = 1
    `;

    const stmt = this.db.prepare(sql);
    const results = stmt.all();
    return results.map((r) => this.formatPreferences(r));
  }

  /**
   * Delete user preferences
   * @param {string} userId - User ID
   * @returns {boolean} - Success status
   */
  delete(userId) {
    const sql = `DELETE FROM user_notification_preferences WHERE user_id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(userId);

    logger.info("User notification preferences deleted", { userId });
    return result.changes > 0;
  }

  /**
   * Get default preferences
   * @returns {Object} - Default preference values
   */
  getDefaults() {
    return {
      telegram_enabled: true,
      telegram_chat_id: null,
      email_enabled: false,
      console_enabled: true,
      alert_low_score: true,
      alert_critical_issue: true,
      daily_digest: true,
      low_score_threshold: config.scoring.thresholds.alert,
    };
  }

  /**
   * Format preferences record (convert integers to booleans)
   * @param {Object} record - Raw database record
   * @returns {Object|null} - Formatted record
   */
  formatPreferences(record) {
    if (!record) return null;

    return {
      ...record,
      telegram_enabled: !!record.telegram_enabled,
      email_enabled: !!record.email_enabled,
      console_enabled: !!record.console_enabled,
      alert_low_score: !!record.alert_low_score,
      alert_critical_issue: !!record.alert_critical_issue,
      daily_digest: !!record.daily_digest,
    };
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

module.exports = UserPreferencesModel;
