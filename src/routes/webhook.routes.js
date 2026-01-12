/**
 * Webhook Routes
 * Routes for handling incoming webhooks from Exotel
 */

const express = require("express");
const {
  handleExotelWebhook,
  handleMockWebhook,
} = require("../controllers/webhook.controller");

const router = express.Router();

/**
 * Exotel webhook endpoint
 * Note: Exotel does not support signature validation
 * The webhook payload is parsed as JSON directly
 */
router.post("/exotel", express.json(), handleExotelWebhook);

/**
 * Mock webhook endpoint for testing without real Exotel calls
 * Accepts the same payload structure as real Exotel webhooks
 */
router.post("/exotel/mock", express.json(), handleMockWebhook);

module.exports = router;
