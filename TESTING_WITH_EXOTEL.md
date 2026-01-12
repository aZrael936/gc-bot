# Testing with Real Exotel Webhooks - Step-by-Step Guide

This guide will walk you through testing your Phase II implementation with actual Exotel webhooks.

---

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] Exotel account with API access
- [ ] Exotel virtual number (VN) configured
- [ ] Two phone numbers for testing (one to call from, one to call to)
- [ ] Your computer/server accessible from the internet (via ngrok)
- [ ] Docker running (for Redis)
- [ ] Node.js 20+ installed

---

## 🚀 Step-by-Step Testing Process

### Step 1: Prepare Your Local Environment

#### 1.1 Start Redis
```bash
cd /Users/etherdifter/hobby/qc-automation
docker-compose up -d
```

Verify Redis is running:
```bash
docker ps | grep redis
```

#### 1.2 Initialize Database (if not already done)
```bash
npm run db:init
```

#### 1.3 Update Environment Variables

Open `.env` file and add your Exotel credentials:
```bash
nano .env
```

Update these values:
```env
EXOTEL_ACCOUNT_SID=your_actual_account_sid
EXOTEL_API_KEY=your_actual_api_key
EXOTEL_API_TOKEN=your_actual_api_token
```

**Where to find these:**
1. Log in to https://my.exotel.com
2. Go to **Settings** → **API Settings**
3. Copy:
   - Account SID (format: `exotelXXXXXX`)
   - API Key
   - API Token

---

### Step 2: Start Your Application

Open **two terminal windows** side by side.

#### Terminal 1: Start Server + Workers
```bash
cd /Users/etherdifter/hobby/qc-automation
npm run dev:all
```

You should see:
```
🚀 Server running on http://localhost:3000
📊 Environment: development
🏥 Health check: http://localhost:3000/health
📋 Queue initialized: audio-download
📋 Queue initialized: transcription
📋 Queue initialized: analysis
📋 Queue initialized: notification
👷 Workers initialized with placeholder processors
✅ Workers initialization complete
```

#### Terminal 2: Monitor Logs (optional)
```bash
cd /Users/etherdifter/hobby/qc-automation
tail -f logs/app.log
```

---

### Step 3: Expose Your Local Server to Internet (ngrok)

#### 3.1 Install ngrok (if not installed)

**macOS:**
```bash
brew install ngrok
```

**Linux:**
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok
```

**Or download from:** https://ngrok.com/download

#### 3.2 Configure ngrok (first time only)

Sign up at https://dashboard.ngrok.com/signup and get your auth token.

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

#### 3.3 Start ngrok Tunnel

Open a **third terminal window**:
```bash
ngrok http 3000
```

You'll see output like:
```
ngrok

Session Status                online
Account                       your-email@example.com (Plan: Free)
Version                       3.x.x
Region                        India (in)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**IMPORTANT:** Copy the **HTTPS forwarding URL** (e.g., `https://abc123xyz.ngrok-free.app`)

---

### Step 4: Configure Exotel Webhook

**⚠️ IMPORTANT:** Exotel uses **Applets** (visual flow builder), not a simple webhook URL field.

#### 📖 Complete Applet Configuration Guide

**For detailed step-by-step instructions with screenshots, read:**
```bash
cat EXOTEL_APPLET_SETUP.md
```

Or view: [EXOTEL_APPLET_SETUP.md](EXOTEL_APPLET_SETUP.md)

---

#### Quick Overview: Configuring Exotel Applets

#### 4.1 Access Exotel Dashboard
1. Go to https://my.exotel.com
2. Navigate to **"App Bazaar"** → **"Apps"** or **"My Apps"**

#### 4.2 Create or Edit Call Flow

**Option A: Create New Flow**
1. Click **"Create New App"** or **"+ New Flow"**
2. Name it: "QC Automation Webhook"
3. Select type: **"Voice"** or **"Incoming Call"**

**Option B: Edit Existing Flow**
1. Find your existing flow
2. Click **"Edit"** or pencil icon
3. You'll see the **Visual Flow Builder**

#### 4.3 Configure Connect Applet (Enable Recording)

1. Find or add a **"Connect"** or **"Dial"** applet
2. Click on it to open settings
3. ✅ Enable **"Record this call"**
4. Select **"Dual Channel"** recording (if available)
5. Save the applet

#### 4.4 Add Passthru Applet (For Webhook)

1. Locate **"After Call Conversation Ends"** section in your flow
2. Click **"+"** or **"Add Applet"**
3. Select **"Passthru"** or **"Information Pass Through"**
4. Configure the Passthru applet:

   **Webhook URL:**
   ```
   https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel
   ```

   **Example:**
   ```
   https://abc123xyz.ngrok-free.app/webhook/exotel
   ```

   **Important Settings:**
   - ✅ Check **"Make Passthru Async"** ← Critical!
   - HTTP Method: POST (if available)
   - Content Type: application/json (if available)

5. Save the Passthru applet

#### 4.5 Save and Assign Flow

1. Click **"Save Flow"** button (usually top-right)
2. **Assign to your Exotel number:**
   - Method A: In flow settings, select "Assign to Number"
   - Method B: Go to "Phone Numbers" → Select your number → Assign this flow
3. Confirm assignment

#### 4.6 Verify Configuration

Check that:
- ✅ Connect applet has recording enabled
- ✅ Passthru applet is added after "Call Ends"
- ✅ Passthru has correct webhook URL
- ✅ "Make Passthru Async" is checked
- ✅ Flow is saved and assigned to your number

---

**📚 For detailed screenshots and troubleshooting, see:** [EXOTEL_APPLET_SETUP.md](EXOTEL_APPLET_SETUP.md)

---

### Step 5: Make a Test Call

#### 5.1 Initiate Call via Exotel

**Method 1: Using Exotel Dashboard**
1. Go to **"Make a Call"** in Exotel dashboard
2. From: Your phone number (where you'll receive the call)
3. To: Test destination number
4. Select your configured app
5. Click **"Call Now"**

**Method 2: Using Exotel API**
```bash
curl -X POST https://api.exotel.com/v1/Accounts/YOUR_ACCOUNT_SID/Calls/connect.json \
  -u YOUR_API_KEY:YOUR_API_TOKEN \
  -d "From=YOUR_PHONE_NUMBER" \
  -d "To=DESTINATION_NUMBER" \
  -d "CallerId=YOUR_EXOTEL_NUMBER" \
  -d "StatusCallback=https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel" \
  -d "Record=true"
```

#### 5.2 Complete the Call

1. Answer the call on your phone
2. Have a brief conversation (at least 10-15 seconds)
3. Hang up normally

---

### Step 6: Monitor Webhook Delivery

#### 6.1 Watch Your Terminal Logs

You should see logs appearing in your server terminal:

```
[INFO] Processing Exotel call recording webhook {
  callSid: 'abc123xyz789',
  direction: 'incoming',
  duration: 45
}
[INFO] Call record created {
  id: 'call_1704729600000_xyz',
  exotelCallSid: 'abc123xyz789'
}
[INFO] Download job queued {
  callId: 'call_1704729600000_xyz',
  jobId: '1'
}
```

#### 6.2 Check ngrok Web Interface

Open http://127.0.0.1:4040 in your browser to see:
- Incoming webhook requests
- Request headers
- Request body (JSON payload)
- Response status codes

#### 6.3 Check Database

```bash
sqlite3 database/app.db "SELECT * FROM calls ORDER BY created_at DESC LIMIT 1;"
```

Expected output:
```
call_xxx|default|NULL|abc123xyz789|https://s3.amazonaws.com/exotelrecordings/...|NULL|45|completed|09876543210|08012345678|incoming|received|2025-01-08T...
```

#### 6.4 Check Queue

```bash
docker exec -it sales-call-qc-redis redis-cli
> KEYS *
> HGETALL bull:audio-download:1
```

---

### Step 7: Verify Audio Download

Watch the download worker logs:

```
[INFO] 📥 Processing download job: 1 { callId: 'call_1704729600000_xyz' }
[INFO] Starting file download {
  url: 'https://s3.amazonaws.com/exotelrecordings/.../recording.mp3',
  localPath: '/Users/etherdifter/hobby/qc-automation/storage/audio/default/call_xxx.wav'
}
[INFO] File download completed { size: 245678 }
[INFO] ✅ Download completed for call: call_1704729600000_xyz
```

Check if file exists:
```bash
ls -lh storage/audio/default/
```

Play the audio (macOS):
```bash
afplay storage/audio/default/call_*.wav
```

---

## 🐛 Troubleshooting

### Issue 1: Webhook Not Received

**Symptoms:** No logs appear after call ends

**Solutions:**
1. Verify ngrok is running: `curl https://YOUR_NGROK_URL.ngrok-free.app/health`
2. Check ngrok web interface (http://127.0.0.1:4040) for requests
3. Verify webhook URL in Exotel dashboard has no typos
4. Check if recording is enabled in Exotel app settings
5. Wait 1-2 minutes - Exotel may delay webhook delivery

### Issue 2: Webhook Received but Ignored

**Symptoms:** Log shows "Ignoring non-recording webhook event"

**Check:**
```bash
# View the actual payload received
# Check ngrok web interface at http://127.0.0.1:4040
```

**Common causes:**
- `call_type` is not "completed" (call was incomplete)
- `recording_url` is missing or null
- Call recording not enabled in Exotel app

### Issue 3: Download Job Fails

**Symptoms:** Job queued but download fails

**Check logs for error:**
```bash
grep -i "download failed" logs/app.log
```

**Common causes:**
- Recording URL expired (recordings expire after 7 days)
- Network connectivity issues
- Invalid URL format
- Storage directory permissions

**Solutions:**
```bash
# Check storage directory exists and is writable
ls -la storage/audio/default/

# Create if missing
mkdir -p storage/audio/default

# Fix permissions
chmod -R 755 storage/
```

### Issue 4: 401 Unauthorized from Exotel

**Symptoms:** Download fails with 401 error

**Cause:** Exotel recording URLs are signed and may require authentication

**Solution:** Update StorageService to include Exotel credentials in download request:
```javascript
// In storage.service.js, modify the request to include Basic Auth
const auth = Buffer.from(`${config.exotel.apiKey}:${config.exotel.apiToken}`).toString('base64');
const request = client.get(url, {
  headers: {
    'Authorization': `Basic ${auth}`
  }
}, (response) => { ... });
```

### Issue 5: ngrok Session Expired

**Symptoms:** ngrok shows "Session Expired"

**Solution:**
```bash
# Restart ngrok
ngrok http 3000

# Copy the NEW URL and update Exotel webhook configuration
```

---

## ✅ Success Checklist

After a successful test, verify all of these:

- [ ] Webhook received in server logs
- [ ] Call record created in database
- [ ] Download job queued in Redis
- [ ] Audio file downloaded to storage
- [ ] Audio file playable and correct
- [ ] Call status updated to "downloaded"
- [ ] Transcription job queued (placeholder for Phase 3)

---

## 📊 Verification Commands

### Check Latest Call
```bash
sqlite3 database/app.db "
SELECT
  id,
  exotel_call_sid,
  caller_number,
  callee_number,
  duration_seconds,
  status,
  created_at
FROM calls
ORDER BY created_at DESC
LIMIT 1;
"
```

### Check All Calls Today
```bash
sqlite3 database/app.db "
SELECT COUNT(*), status
FROM calls
WHERE date(created_at) = date('now')
GROUP BY status;
"
```

### Check Downloaded Files
```bash
find storage/audio -name "*.wav" -o -name "*.mp3" | head -5
```

### Check Queue Status
```bash
docker exec -it sales-call-qc-redis redis-cli KEYS "bull:*"
```

---

## 🔄 Running Multiple Tests

To test with multiple calls:

1. Make 3-5 test calls of varying durations
2. Monitor processing for each
3. Verify all audio files downloaded
4. Check for any errors in logs

```bash
# Count total processed calls
sqlite3 database/app.db "SELECT COUNT(*) FROM calls WHERE status='downloaded';"

# List all audio files
ls -lh storage/audio/default/
```

---

## 📝 Logging Webhook Payloads (for debugging)

If you want to see the exact payload Exotel sends:

1. Check ngrok web interface: http://127.0.0.1:4040
2. Or temporarily add logging to webhook controller:

```javascript
// In handleExotelWebhook function, add at the top:
logger.info("Raw Exotel payload received:", JSON.stringify(req.body, null, 2));
```

---

## 🎯 Next Steps After Successful Test

Once you've confirmed Phase II is working:

1. ✅ **Document your Exotel webhook URL** (save the ngrok URL if using free tier)
2. ✅ **Take screenshots** of successful webhook delivery
3. ✅ **Backup your database** with test data
4. ✅ **Move to Phase III** - Whisper transcription setup

---

## 💡 Tips

1. **Free ngrok limitations:** URL changes on restart. Consider ngrok paid plan ($8/month) for persistent URLs
2. **Exotel webhook retries:** Exotel will retry failed webhooks 3 times with exponential backoff
3. **Recording availability:** Exotel recordings may take 30 seconds to 2 minutes to be available
4. **Testing costs:** Each test call uses Exotel credits (approximately ₹0.50-₹2 per minute)
5. **Development workflow:** Keep ngrok, server, and logs visible in separate terminal windows

---

## 📞 Support

If you encounter issues:

1. **Check logs first:** `tail -f logs/app.log`
2. **Check ngrok requests:** http://127.0.0.1:4040
3. **Exotel Support:** https://support.exotel.com
4. **Exotel API Docs:** https://developer.exotel.com

---

*Happy Testing! 🚀*
