/**
 * Report Services Index
 * Exports all report-related services
 */

const DailyDigestService = require("./daily-digest.service");

module.exports = {
  DailyDigestService,
  DailyDigest: new DailyDigestService(),
};
