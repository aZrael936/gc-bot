# 🎯 Exotel Applet Configuration - Quick Reference Card

## 📋 What You Need

| Item | Value |
|------|-------|
| **Your ngrok URL** | `https://abc123xyz.ngrok-free.app` |
| **Webhook endpoint** | `/webhook/exotel` |
| **Full webhook URL** | `https://abc123xyz.ngrok-free.app/webhook/exotel` |

---

## 🏗️ Visual Flow Structure

```
┌─────────────────────────────────────────────────────────┐
│         Exotel Call Flow (Visual Builder)               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1️⃣  Start                                              │
│       ↓                                                 │
│  2️⃣  ┌─────────────────────────────────────┐            │
│      │  Connect Applet                     │            │
│      │  (Dial/Call)                        │            │
│      │                                     │            │
│      │  Settings:                          │            │
│      │  ✅ Record this call                │ ← Enable! │
│      │  □ Dual channel                     │            │
│      │  Destination: [phone number]        │            │
│      └─────────────────────────────────────┘            │
│       ↓                                                 │
│  3️⃣  After Call Conversation Ends                       │
│       ↓                                                 │
│  4️⃣  ┌─────────────────────────────────────┐            │
│      │  Passthru Applet                    │            │
│      │  (Webhook/Info Pass Through)        │            │
│      │                                     │            │
│      │  URL: https://abc123.ngrok.io/...  │ ← Your URL│
│      │  ✅ Make Passthru Async             │ ← Enable! │
│      │  Method: POST                       │            │
│      └─────────────────────────────────────┘            │
│       ↓                                                 │
│  5️⃣  End / Hangup                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Configuration Checklist

### Before You Start
- [ ] Server running: `npm run dev:all`
- [ ] ngrok running: `ngrok http 3000`
- [ ] ngrok URL copied: `https://_____.ngrok-free.app`

### In Exotel Dashboard
- [ ] Logged into https://my.exotel.com
- [ ] Opened "App Bazaar" → "Apps"
- [ ] Created/opened a call flow

### Connect Applet
- [ ] Connect applet added to flow
- [ ] "Record this call" is **checked** ✅
- [ ] Destination number configured
- [ ] Applet saved

### Passthru Applet
- [ ] Found "After Call Ends" section
- [ ] Passthru applet added
- [ ] Webhook URL entered: `https://YOUR_URL.ngrok-free.app/webhook/exotel`
- [ ] "Make Passthru Async" is **checked** ✅
- [ ] Applet saved

### Save & Assign
- [ ] Flow saved (click "Save Flow" button)
- [ ] Flow assigned to your Exotel number
- [ ] Assignment confirmed

---

## 🎯 Step-by-Step (Ultra Quick)

### 1. Access Dashboard
```
https://my.exotel.com → App Bazaar → Apps
```

### 2. Create/Edit Flow
```
Click "Create New App" or "Edit" existing
→ Opens Visual Flow Builder
```

### 3. Add/Configure Connect Applet
```
Click Connect applet
→ ✅ Check "Record this call"
→ Click Save
```

### 4. Add Passthru Applet
```
Scroll to "After Call Ends"
→ Click "+" or "Add Applet"
→ Select "Passthru"
→ Enter URL: https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel
→ ✅ Check "Make Passthru Async"
→ Click Save
```

### 5. Save & Assign
```
Click "Save Flow"
→ Assign to your Exotel number
→ Done! ✅
```

---

## 🔍 Where to Find Things

### Applet Library
**Location:** Left sidebar in Flow Builder
**Look for:**
- Connect (for dialing)
- Passthru (for webhooks)
- Gather (for DTMF input)
- Play (for audio)
- Hangup (to end call)

### "After Call Ends" Section
**Location:** Bottom of your flow, after Connect applet
**Alternative names:**
- "After Call Conversation Ends"
- "On Call Complete"
- "Post Call Actions"

### "Make Passthru Async" Checkbox
**Location:** Inside Passthru applet settings
**Why important:** Sends webhook without blocking call flow
**If missing:** Webhook might not be sent or could delay call processing

---

## 🧪 Testing Quick Commands

### 1. Check Your Setup
```bash
./scripts/check-status.sh
```

### 2. Watch Logs
```bash
tail -f logs/app.log
```

### 3. Make Test Call
- Call your Exotel number
- Or use Exotel dashboard "Make a Call"
- Talk for 15-20 seconds
- Hang up
- **Wait 30-60 seconds** for webhook

### 4. Verify Success
```bash
# Check database
sqlite3 database/app.db "SELECT * FROM calls ORDER BY created_at DESC LIMIT 1;"

# Check audio file
ls -lh storage/audio/default/
```

---

## 📸 What You Should See

### In Flow Builder
```
Your flow should look like:
[Start] → [Connect ✅ Recording ON] → [After Call Ends] → [Passthru ✅ Async ON] → [End]
```

### In Your Terminal
```
[INFO] Processing Exotel call recording webhook
[INFO] Call record created and download queued
[INFO] 📥 Processing download job: 1
[INFO] ✅ Download completed
```

### In ngrok (http://localhost:4040)
```
POST /webhook/exotel  200 OK
```

### In Database
```
call_xxx | completed | downloaded | recording.mp3
```

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| **Can't find Passthru** | Look for "Information Pass Through" or check "Advanced" applets |
| **No "Make Passthru Async"** | Different Exotel version - webhook should still work |
| **Webhook not received** | Check ngrok is running, URL has no typos, flow is assigned |
| **No recording_url** | Enable "Record this call" in Connect applet |
| **Call ends immediately** | Check Connect applet destination number is valid |

---

## 📞 Quick Test

### Fastest Way to Test:
1. **Start everything:**
   ```bash
   ./scripts/start-testing.sh  # Terminal 1
   ngrok http 3000             # Terminal 2
   ```

2. **Configure Exotel:**
   - Add Connect applet with recording
   - Add Passthru applet with your ngrok URL
   - Save and assign

3. **Call your Exotel number**

4. **Watch Terminal 1** for webhook logs

5. **Success = logs showing:**
   ```
   Processing Exotel webhook → Call created → Download queued → Download completed
   ```

---

## 🎓 Key Concepts

### What is an Applet?
- Building block in Exotel's visual flow builder
- Like LEGO pieces you connect to build call flows
- Examples: Connect, Play, Gather, Passthru

### What is Passthru?
- Applet that sends data to your webhook URL
- "Passes through" call information to your server
- Can be Sync (blocks) or Async (non-blocking)

### Why "Make Passthru Async"?
- **Async**: Sends webhook without waiting, call continues
- **Sync**: Waits for your server response, can delay/block
- **Always use Async** for webhooks!

### When is the webhook sent?
- **After the call ends** (when configured in "After Call Ends")
- Exotel processes recording (30-60 seconds)
- Then sends POST request to your webhook URL
- Your server receives call details + recording URL

---

## 🆘 Need More Help?

### Read Full Guides:
- **Detailed Applet Setup:** [EXOTEL_APPLET_SETUP.md](EXOTEL_APPLET_SETUP.md)
- **Quick Test Guide:** [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md)
- **Comprehensive Testing:** [TESTING_WITH_EXOTEL.md](TESTING_WITH_EXOTEL.md)

### Exotel Resources:
- **Support:** https://support.exotel.com
- **Developer Docs:** https://developer.exotel.com
- **Dashboard:** https://my.exotel.com

### Check Status:
```bash
./scripts/check-status.sh
```

---

## 🎯 Success Criteria

✅ You're successful when:
1. Call completes normally
2. Server logs show "Processing Exotel webhook"
3. Database has new call record
4. Audio file appears in `storage/audio/default/`
5. Audio file is playable

**Run:** `./scripts/check-status.sh` to verify all! 🚀

---

**Print this page and keep it next to you while configuring! 📄**
