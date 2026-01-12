/**
 * Storage Service
 * File storage operations (local filesystem)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const config = require("../config");
const logger = require("../utils/logger");

class StorageService {
  constructor() {
    this.basePath = config.storage.path;
    this.audioPath = path.join(this.basePath, "audio");
    this.ensureDirectories();
  }

  /**
   * Ensure storage directories exist
   */
  ensureDirectories() {
    const dirs = [this.basePath, this.audioPath];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info("Created storage directory", { dir });
      }
    });
  }

  /**
   * Download file from URL to local storage
   * @param {string} url - Source URL
   * @param {string} localPath - Local file path (relative to storage root)
   * @param {Object} options - Download options (auth, headers, etc.)
   * @returns {Promise<string>} - Full local path
   */
  async downloadFile(url, localPath, options = {}) {
    return new Promise((resolve, reject) => {
      const fullLocalPath = path.join(this.basePath, localPath);
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      logger.info("Starting file download", { url, localPath: fullLocalPath });

      // Prepare request options
      const requestOptions = {
        headers: options.headers || {},
      };

      // Add Basic Auth if credentials provided
      if (options.auth) {
        const authString = Buffer.from(
          `${options.auth.username}:${options.auth.password}`
        ).toString("base64");
        requestOptions.headers["Authorization"] = `Basic ${authString}`;
      }

      const request = client.get(url, requestOptions, (response) => {
        if (response.statusCode !== 200) {
          const error = new Error(
            `Download failed: ${response.statusCode} ${response.statusMessage}`
          );
          logger.error("Download failed", {
            url,
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
          });
          reject(error);
          return;
        }

        // Ensure directory exists
        const dir = path.dirname(fullLocalPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const fileStream = fs.createWriteStream(fullLocalPath);

        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          logger.info("File download completed", {
            url,
            localPath: fullLocalPath,
            size: fs.statSync(fullLocalPath).size,
          });
          resolve(fullLocalPath);
        });

        fileStream.on("error", (error) => {
          logger.error("File write error", {
            url,
            localPath: fullLocalPath,
            error,
          });
          fs.unlink(fullLocalPath, () => {}); // Delete partial file
          reject(error);
        });
      });

      request.on("error", (error) => {
        logger.error("Download request error", { url, error });
        reject(error);
      });

      // Set timeout
      request.setTimeout(30000, () => {
        request.destroy();
        const error = new Error("Download timeout");
        logger.error("Download timeout", { url });
        reject(error);
      });
    });
  }

  /**
   * Generate local path for call audio
   * @param {string} orgId - Organization ID
   * @param {string} callId - Call ID
   * @returns {string} - Relative path
   */
  getCallAudioPath(orgId, callId) {
    return path.join("audio", orgId, `${callId}.wav`);
  }

  /**
   * Download call recording from Exotel
   * @param {string} recordingUrl - Exotel recording URL
   * @param {string} orgId - Organization ID
   * @param {string} callId - Call ID
   * @returns {Promise<string>} - Local file path
   */
  async downloadCallRecording(recordingUrl, orgId, callId) {
    const localPath = this.getCallAudioPath(orgId, callId);

    // Add Exotel authentication if credentials are configured
    const options = {};
    if (config.exotel.apiKey && config.exotel.apiToken) {
      options.auth = {
        username: config.exotel.apiKey,
        password: config.exotel.apiToken,
      };
      logger.info("Using Exotel authentication for download");
    }

    return this.downloadFile(recordingUrl, localPath, options);
  }

  /**
   * Check if file exists
   * @param {string} localPath - Local file path (relative to storage root)
   * @returns {boolean} - True if file exists
   */
  fileExists(localPath) {
    const fullPath = path.join(this.basePath, localPath);
    return fs.existsSync(fullPath);
  }

  /**
   * Get file stats
   * @param {string} localPath - Local file path (relative to storage root)
   * @returns {Object|null} - File stats or null if not found
   */
  getFileStats(localPath) {
    const fullPath = path.join(this.basePath, localPath);
    try {
      return fs.statSync(fullPath);
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete file
   * @param {string} localPath - Local file path (relative to storage root)
   * @returns {boolean} - True if deleted successfully
   */
  deleteFile(localPath) {
    const fullPath = path.join(this.basePath, localPath);
    try {
      fs.unlinkSync(fullPath);
      logger.info("File deleted", { localPath: fullPath });
      return true;
    } catch (error) {
      logger.error("Failed to delete file", { localPath: fullPath, error });
      return false;
    }
  }

  /**
   * Get full absolute path for local path
   * @param {string} localPath - Local file path (relative to storage root)
   * @returns {string} - Absolute path
   */
  getAbsolutePath(localPath) {
    return path.join(this.basePath, localPath);
  }
}

module.exports = StorageService;
