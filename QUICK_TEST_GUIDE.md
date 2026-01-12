# 🚀 Quick Test Guide - Test with Real Exotel in 10 Minutes

This is a simplified, step-by-step guide to test your webhook with a real Exotel call.

---

## ⚡ Quick Start (3 Commands)

### Terminal 1: Start Application
```bash
cd /Users/etherdifter/hobby/qc-automation
./scripts/start-testing.sh
```

### Terminal 2: Start ngrok
```bash
ngrok http 3000
```

### Terminal 3: Monitor Logs (Optional)
```bash
cd /Users/etherdifter/hobby/qc-automation
tail -f logs/app.log
```

---

## 📝 Detailed Steps

### Step 1: Prepare Exotel Credentials (2 mins)

1. Go to https://my.exotel.com
2. Navigate to **Settings** → **API Settings**
3. Copy these three values:
   - Account SID (e.g., `exotel123456`)
   - API Key
   - API Token

4. Edit your `.env` file:
```bash
nano .env
```

5. Update these lines:
```env
EXOTEL_ACCOUNT_SID=exotel123456          # Your actual SID
EXOTEL_API_KEY=your_actual_api_key       # Your actual key
EXOTEL_API_TOKEN=your_actual_token       # Your actual token
```

6. Save and exit (Ctrl+O, Enter, Ctrl+X)

---

### Step 2: Start Your Application (1 min)

Run the automated setup script:
```bash
./scripts/start-testing.sh
```

**What this does:**
- ✅ Checks Node.js, Docker, ngrok
- ✅ Starts Redis container
- ✅ Initializes database (if needed)
- ✅ Starts server on port 3000
- ✅ Starts background workers

**You should see:**
```
🚀 Server running on http://localhost:3000
📊 Environment: development
🏥 Health check: http://localhost:3000/health
📋 Queue initialized: audio-download
✅ Workers initialization complete
```

---

### Step 3: Expose to Internet with ngrok (1 min)

Open a **NEW terminal window** and run:
```bash
ngrok http 3000
```

**You'll see:**
```
Session Status                online
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:3000
```

**📋 COPY THIS URL:** `https://abc123xyz.ngrok-free.app`

---

### Step 4: Configure Exotel Webhook (5 mins)

**⚠️ IMPORTANT: Exotel uses Applets (visual flow builder), not a simple webhook URL field.**

#### 📖 **Read the Detailed Applet Setup Guide First:**
```bash
cat EXOTEL_APPLET_SETUP.md
```

#### Quick Summary:

1. **Go to:** https://my.exotel.com → **"App Bazaar"** → **"Apps"**

2. **Create/Edit Flow:**
   - Click **"Create New App"** or edit existing
   - You'll see a **Visual Flow Builder** with applets

3. **Enable Recording:**
   - Find/add **"Connect"** applet
   - ✅ Check **"Record this call"**

4. **Add Webhook:**
   - Find **"After Call Ends"** section
   - Add **"Passthru"** applet
   - Enter webhook URL: `https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel`
   - ✅ Check **"Make Passthru Async"**

5. **Save & Assign:**
   - Save the flow
   - Assign to your Exotel number

**📚 Full step-by-step guide:** [EXOTEL_APPLET_SETUP.md](EXOTEL_APPLET_SETUP.md)

---

### Step 5: Make Test Call (2 mins)

#### Option A: Via Exotel Dashboard (Easier)

1. In Exotel dashboard, click **"Make a Call"**
2. **From:** Your mobile number (you'll receive the call)
3. **To:** Any test number (e.g., another phone you have)
4. **Select App:** Choose the app you just configured
5. Click **"Call Now"**

#### Option B: Via API (Advanced)

```bash
curl -X POST https://api.exotel.com/v1/Accounts/YOUR_ACCOUNT_SID/Calls/connect.json \
  -u YOUR_API_KEY:YOUR_API_TOKEN \
  -d "From=YOUR_PHONE" \
  -d "To=TEST_PHONE" \
  -d "CallerId=YOUR_EXOTEL_NUMBER" \
  -d "Record=true"
```

#### 5.1 Answer and Complete Call
1. Answer the call on your phone
2. Talk for at least 15-20 seconds
3. Hang up normally

---

### Step 6: Watch the Magic Happen! (1 min)

#### In Your Server Terminal, You'll See:

```
[INFO] Processing Exotel call recording webhook {
  callSid: 'abc123xyz789',
  direction: 'incoming',
  duration: 45
}
[INFO] Call record created and download queued {
  callId: 'call_1704729600000_xyz',
  jobId: '1'
}
[INFO] �� Processing download job: 1
[INFO] Starting file download...
[INFO] ✅ Download completed for call: call_1704729600000_xyz
```

#### Check ngrok Terminal:
You'll see the incoming POST request from Exotel.

#### Or visit: http://127.0.0.1:4040
See the webhook request details in ngrok's web interface.

---

## ✅ Verify Everything Worked

### Check 1: Database
```bash
sqlite3 database/app.db "SELECT id, exotel_call_sid, status FROM calls ORDER BY created_at DESC LIMIT 1;"
```

**Expected:**
```
call_1704729600000_xyz|abc123xyz789|downloaded
```

### Check 2: Audio File
```bash
ls -lh storage/audio/default/
```

**Expected:**
```
-rw-r--r--  1 user  staff   245K Jan  8 10:34 call_1704729600000_xyz.wav
```

### Check 3: Play Audio (macOS)
```bash
afplay storage/audio/default/call_*.wav
```

You should hear your test call recording!

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Webhook not received"

**Check:**
```bash
# Is server running?
curl http://localhost:3000/health

# Is ngrok running?
curl https://YOUR_NGROK_URL.ngrok-free.app/health
```

**Fix:** Restart server and/or ngrok

---

### Issue: "Call completed but webhook ignored"

**Check logs:**
```bash
tail -20 logs/app.log | grep -i "ignoring"
```

**Common causes:**
- Recording not enabled in Exotel app
- Call was too short (< 1 second)
- Call status is not "completed"

**Fix:**
- Enable recording in Exotel app settings
- Make sure call lasts at least 10-15 seconds
- Check call actually completed (not busy/failed)

---

### Issue: "Download failed"

**Check:**
```bash
tail -20 logs/app.log | grep -i "download"
```

**Fix:**
```bash
# Check storage directory exists
mkdir -p storage/audio/default

# Check permissions
chmod -R 755 storage/
```

---

### Issue: "401 Unauthorized when downloading"

**This means Exotel recording URL requires authentication.**

**Quick Fix:** Add to [src/services/storage.service.js](src/services/storage.service.js#L49):

```javascript
// In the downloadFile method, modify the request:
const auth = `${config.exotel.apiKey}:${config.exotel.apiToken}`;
const authHeader = 'Basic ' + Buffer.from(auth).toString('base64');

const request = client.get(url, {
  headers: {
    'Authorization': authHeader
  }
}, (response) => {
  // ... rest of code
});
```

---

## 🎯 Success Checklist

After your test, verify:

- [ ] ✅ Server started without errors
- [ ] ✅ ngrok tunnel active
- [ ] ✅ Webhook URL configured in Exotel
- [ ] ✅ Test call completed
- [ ] ✅ Webhook received (check logs)
- [ ] ✅ Call record in database
- [ ] ✅ Audio file downloaded
- [ ] ✅ Audio file is playable

---

## 📊 View Your Results

### All Calls
```bash
sqlite3 database/app.db "SELECT * FROM calls;"
```

### Today's Calls
```bash
sqlite3 database/app.db "
SELECT
  id,
  exotel_call_sid,
  SUBSTR(caller_number, -10) as from,
  SUBSTR(callee_number, -10) as to,
  duration_seconds || 's' as duration,
  status,
  TIME(created_at) as time
FROM calls
WHERE DATE(created_at) = DATE('now')
ORDER BY created_at DESC;
"
```

### Call Count by Status
```bash
sqlite3 database/app.db "
SELECT status, COUNT(*) as count
FROM calls
GROUP BY status;
"
```

---

## 🔄 Run Another Test

Just make another call! The system will automatically:
1. Receive the webhook
2. Create a new call record
3. Download the audio
4. Queue it for transcription (Phase 3)

---

## 🎓 Understanding the Flow

```
1. You make a call via Exotel
         ↓
2. Call completes with recording
         ↓
3. Exotel sends webhook → ngrok → your server
         ↓
4. Server creates call record in database
         ↓
5. Server queues download job
         ↓
6. Worker downloads audio from Exotel
         ↓
7. Audio saved to storage/audio/
         ↓
8. Ready for Phase 3 (Transcription)!
```

---

## 💡 Pro Tips

1. **Keep ngrok window visible** - See webhooks in real-time
2. **Monitor logs continuously** - `tail -f logs/app.log`
3. **Use ngrok web UI** - http://127.0.0.1:4040 for detailed request inspection
4. **Test with different call durations** - Short (10s), Medium (1min), Long (5min)
5. **Save your ngrok URL** - If using free tier, it changes on restart

---

## 📞 Need Help?

### Check These First:
1. Server logs: `tail -f logs/app.log`
2. ngrok web interface: http://127.0.0.1:4040
3. Database: `sqlite3 database/app.db "SELECT * FROM calls;"`
4. Storage: `ls -la storage/audio/default/`

### Documentation:
- **Full Guide:** [TESTING_WITH_EXOTEL.md](TESTING_WITH_EXOTEL.md)
- **Phase 2 Fixes:** [PHASE2_FIXES.md](PHASE2_FIXES.md)
- **Exotel API Docs:** https://developer.exotel.com

---

## 🎉 What's Next?

Once you have successfully tested with real Exotel:

1. ✅ **Phase II Complete!** 🎊
2. ⏭️ **Move to Phase III** - Set up Whisper for transcription
3. 📖 Read the Phase III documentation
4. 🤖 Implement AI-powered call analysis

---

**Happy Testing! If you see your audio file downloaded, you're ready for Phase III! 🚀**
