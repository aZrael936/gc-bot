/**
 * Models Index
 * Export all database models
 */

const CallModel = require("./call.model");

module.exports = {
  CallModel,
  Call: new CallModel(),
};
