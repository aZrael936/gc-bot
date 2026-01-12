#!/bin/bash

# Test script for Exotel webhook integration
# This script sends test payloads to the webhook endpoint

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Testing Exotel Webhook Integration"
echo "================================================"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Valid webhook with recording
echo "📝 Test 1: Valid completed call with recording"
echo "------------------------------------------------"
curl -X POST "$BASE_URL/webhook/exotel/mock" \
  -H "Content-Type: application/json" \
  -d '{
    "call_sid": "test_'$(date +%s)'",
    "transaction_id": "conn_'$(date +%s)'",
    "from": "09876543210",
    "to": "08012345678",
    "direction": "incoming",
    "start_time": "2025-01-08 10:30:00",
    "current_time": "2025-01-08 10:34:00",
    "dial_call_duration": 245,
    "on_call_duration": 240,
    "recording_url": "https://s3-ap-southeast-1.amazonaws.com/exotelrecordings/test/recording.mp3",
    "call_type": "completed",
    "dial_call_status": "completed"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n\n"

echo ""
echo "================================================"
echo ""

# Test 2: Webhook without recording (should be ignored)
echo "📝 Test 2: Call without recording (should be ignored)"
echo "------------------------------------------------"
curl -X POST "$BASE_URL/webhook/exotel" \
  -H "Content-Type: application/json" \
  -d '{
    "call_sid": "test_no_recording_'$(date +%s)'",
    "from": "09876543210",
    "to": "08012345678",
    "direction": "incoming",
    "call_type": "completed"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n\n"

echo ""
echo "================================================"
echo ""

# Test 3: Incomplete call (should be ignored)
echo "📝 Test 3: Incomplete call (should be ignored)"
echo "------------------------------------------------"
curl -X POST "$BASE_URL/webhook/exotel" \
  -H "Content-Type: application/json" \
  -d '{
    "call_sid": "test_incomplete_'$(date +%s)'",
    "from": "09876543210",
    "to": "08012345678",
    "direction": "incoming",
    "call_type": "incomplete",
    "recording_url": "https://example.com/recording.mp3"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n\n"

echo ""
echo "================================================"
echo ""

# Test 4: Missing call_sid (should be rejected)
echo "📝 Test 4: Missing call_sid (should be rejected with 400)"
echo "------------------------------------------------"
curl -X POST "$BASE_URL/webhook/exotel" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "09876543210",
    "to": "08012345678",
    "recording_url": "https://example.com/recording.mp3",
    "call_type": "completed"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n\n"

echo ""
echo "================================================"
echo ""

# Test 5: Real Exotel-like payload structure
echo "📝 Test 5: Complete Exotel-like payload"
echo "------------------------------------------------"
curl -X POST "$BASE_URL/webhook/exotel/mock" \
  -H "Content-Type: application/json" \
  -d '{
    "call_sid": "real_test_'$(date +%s)'",
    "transaction_id": "conn_xyz_789",
    "vn": "08012345678",
    "greenpin_id": "alloc_123",
    "from": "09876543210",
    "to": "08012345678",
    "call_type": "completed",
    "start_time": "2025-01-08 10:30:00",
    "current_time": "2025-01-08 10:34:05",
    "dial_call_duration": 245,
    "on_call_duration": 240,
    "recording_url": "https://s3-ap-southeast-1.amazonaws.com/exotelrecordings/abc123/recording.mp3",
    "dial_call_status": "completed",
    "direction": "incoming",
    "source": "exotel"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n\n"

echo ""
echo "================================================"
echo "✅ All tests completed!"
echo "================================================"
echo ""
echo "💡 To check the results:"
echo "   - Check server logs: tail -f logs/app.log"
echo "   - Check database: sqlite3 database/app.db 'SELECT * FROM calls;'"
echo "   - Check queue: docker exec -it sales-call-qc-redis redis-cli"
echo ""
