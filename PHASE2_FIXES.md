# Phase 2 Fixes - Exotel Integration Corrections

## Summary

Fixed critical issues in the Exotel webhook integration to align with the official Exotel API documentation. The implementation now correctly handles Exotel webhooks with proper payload structure and field names.

---

## 🔴 Critical Issues Fixed

### 1. **Removed Invalid Signature Validation**

**Issue:** Code implemented HMAC-SHA1 signature validation, but Exotel does not support webhook signature validation.

**Fix:**
- Removed `validateExotelSignature()` function entirely
- Removed `crypto` import and signature checking logic
- Updated configuration to remove `signatureValidation` setting
- Added documentation comments explaining Exotel's security limitations

**Security Recommendation:**
- Use IP whitelisting in your firewall/reverse proxy to only accept webhooks from Exotel's IP addresses
- Deploy webhook endpoint behind VPN or internal network when possible
- Monitor webhook logs for suspicious activity

---

### 2. **Fixed Webhook Payload Structure**

**Issue:** Code expected nested structure `{ event: "call.hangup", data: {...} }` but Exotel sends flat JSON.

**Before:**
```javascript
const { event, data } = req.body;
if (event !== "call.hangup" || !data.RecordingUrl) { ... }
```

**After:**
```javascript
const payload = req.body;
if (payload.call_type !== "completed" || !payload.recording_url) { ... }
```

**Exotel Actual Payload:**
```json
{
  "call_sid": "abc123",
  "from": "09876543210",
  "to": "08012345678",
  "recording_url": "https://s3.amazonaws.com/.../recording.mp3",
  "call_type": "completed",
  "on_call_duration": 240,
  "direction": "incoming"
}
```

---

### 3. **Fixed Field Name Mismatches**

**Issue:** Code used PascalCase (e.g., `CallSid`) but Exotel uses snake_case (e.g., `call_sid`).

**All Field Mappings:**

| Old (Incorrect) | New (Correct) | Description |
|----------------|---------------|-------------|
| `data.CallSid` | `payload.call_sid` | Unique call identifier |
| `data.RecordingUrl` | `payload.recording_url` | Recording S3 URL |
| `data.TotalCallDuration` | `payload.on_call_duration` | Conversation duration |
| `data.DialCallDuration` | `payload.dial_call_duration` | Dial attempt duration |
| `data.CallFrom` | `payload.from` | Caller phone number |
| `data.CallTo` | `payload.to` | Called phone number |
| `data.Direction` | `payload.direction` | Call direction |
| `data.CustomField` | N/A (removed) | Not in standard Exotel payload |
| N/A | `payload.call_type` | Call completion status |
| N/A | `payload.transaction_id` | Connection ID |

---

### 4. **Simplified Body Parsing**

**Issue:** Complex raw body parser that conflicted with `express.json()`.

**Before:**
```javascript
const rawBodyParser = (req, res, next) => {
  let data = "";
  req.on("data", (chunk) => { data += chunk; });
  req.on("end", () => { req.rawBody = data; next(); });
};
router.post("/exotel", rawBodyParser, express.json(), handleExotelWebhook);
```

**After:**
```javascript
// Simple and clean - no signature validation needed
router.post("/exotel", express.json(), handleExotelWebhook);
```

---

## ✅ Files Modified

### 1. **src/controllers/webhook.controller.js**
- Removed `crypto` import
- Removed `validateExotelSignature()` function
- Updated `handleExotelWebhook()` to use flat payload structure
- Fixed all field names to snake_case
- Updated `handleMockWebhook()` to match real Exotel structure
- Removed `validateExotelSignature` from exports

### 2. **src/routes/webhook.routes.js**
- Removed raw body parser middleware
- Simplified route handlers to use `express.json()` directly
- Added documentation comments

### 3. **src/config/index.js**
- Removed `signatureValidation` from Exotel config
- Removed Exotel-specific validation from `validateConfig()`
- Added informative logging for Exotel configuration status
- Added documentation comments

### 4. **.env and env.example**
- Removed `EXOTEL_SIGNATURE_VALIDATION` variable
- Removed `EXOTEL_WEBHOOK_SECRET` variable
- Removed `EXOTEL_SUBDOMAIN` variable
- Added security advisory comments
- Clarified that API credentials are for outgoing calls TO Exotel

---

## 🧪 Testing

### Automated Tests

Run the Phase 2 test suite:
```bash
npm run test:phase2
```

Tests cover:
- ✅ Valid completed call with recording
- ✅ Calls without recordings (ignored)
- ✅ Incomplete calls (ignored)
- ✅ Missing required fields (rejected with 400)
- ✅ Duplicate call_sid handling

### Manual Testing

Use the provided test script:
```bash
# Test against local server
./scripts/test-webhook.sh

# Test against ngrok URL
./scripts/test-webhook.sh https://your-ngrok-url.ngrok.io
```

### Testing with cURL

Test the mock endpoint:
```bash
curl -X POST http://localhost:3000/webhook/exotel/mock \
  -H "Content-Type: application/json" \
  -d '{
    "call_sid": "test_123",
    "from": "09876543210",
    "to": "08012345678",
    "direction": "incoming",
    "on_call_duration": 120,
    "recording_url": "https://example.com/test.mp3",
    "call_type": "completed"
  }'
```

Expected response:
```json
{
  "status": "processed",
  "call_id": "call_1704729600000_abc123xyz",
  "job_id": "1",
  "mock": true
}
```

---

## 🚀 Deployment Checklist

Before deploying to production with real Exotel webhooks:

- [ ] Update `.env` with real Exotel credentials
- [ ] Set up ngrok or public endpoint: `ngrok http 3000`
- [ ] Configure webhook URL in Exotel dashboard
- [ ] Implement IP whitelisting for Exotel's IPs
- [ ] Test with a real Exotel call
- [ ] Monitor logs for successful webhook delivery
- [ ] Verify audio files are downloading correctly
- [ ] Check database for proper call records

---

## 📊 Verification

### Check Call Records
```bash
sqlite3 database/app.db "SELECT * FROM calls ORDER BY created_at DESC LIMIT 5;"
```

### Check Queue Jobs
```bash
docker exec -it sales-call-qc-redis redis-cli
> KEYS *
> HGETALL bull:download:1
```

### Check Logs
```bash
tail -f logs/app.log | grep -i exotel
```

---

## 🔗 Exotel Documentation References

- **Developer Portal:** https://developer.exotel.com/api
- **Call Events:** https://developer.exotel.com/api/events-call-backs
- **Call Completed Event:** https://developer.exotel.com/api/events-call-backs-2
- **API Authentication:** Uses Basic Auth (API Key + Token) for calls TO Exotel
- **Webhook Security:** No signature validation supported by Exotel

---

## 🎯 Next Steps (Phase 3)

Phase 2 is now complete and ready for Phase 3:
- ✅ Webhook integration working correctly
- ✅ Audio download worker functional
- ✅ Queue system operational
- ⏭️ Next: Implement Whisper-based transcription (Phase 3)

---

## 📝 Notes

1. **Exotel Webhook Timing:** Recording URLs may take 1-2 minutes to be available after call completion
2. **Field Availability:** Some fields like `dial_call_status` or `transaction_id` may be optional depending on call type
3. **Direction Field:** Exotel typically uses "incoming" for inbound calls and "outgoing-dial" for outbound
4. **Call Types:** Common values are "completed", "incomplete", "call-attempt", "client-hangup"

---

*Document Created: January 8, 2025*
*Author: AI Code Review & Fix*
