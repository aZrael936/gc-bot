/**
 * Services Index
 * Export all business logic services
 */

const CallService = require("./call.service");
const StorageService = require("./storage.service");

module.exports = {
  CallService,
  StorageService,
  Call: new CallService(),
  Storage: new StorageService(),
};
