# 🎯 Ready to Test with Real Exotel Webhooks!

All Phase II fixes have been applied. Your system is now correctly configured to work with Exotel's actual webhook API.

---

## 🚀 Quick Start (Choose Your Path)

### Path 1: Super Quick Test (10 mins)
```bash
# Read this short guide
cat QUICK_TEST_GUIDE.md

# Start everything
./scripts/start-testing.sh

# In another terminal
ngrok http 3000

# Configure webhook in Exotel and make a call!
```

### Path 2: Detailed Setup (30 mins)
```bash
# Read the comprehensive guide
cat TESTING_WITH_EXOTEL.md

# Follow step-by-step instructions
```

### Path 3: Mock Testing (No Exotel needed)
```bash
# Start server
npm run dev:all

# In another terminal, run test script
./scripts/test-webhook.sh
```

---

## 📁 Documentation Files

| File | Purpose | When to Use |
|------|---------|-------------|
| **[EXOTEL_QUICK_REFERENCE.md](EXOTEL_QUICK_REFERENCE.md)** | 1-page quick reference card | Keep this open while configuring! |
| **[EXOTEL_APPLET_SETUP.md](EXOTEL_APPLET_SETUP.md)** | Complete Exotel Applet guide | Learn how to configure Exotel webhooks |
| **[QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md)** | Fast 10-minute test guide | When you want to test quickly |
| **[TESTING_WITH_EXOTEL.md](TESTING_WITH_EXOTEL.md)** | Comprehensive testing guide | When you need detailed instructions |
| **[PHASE2_FIXES.md](PHASE2_FIXES.md)** | Technical changes documentation | To understand what was fixed |
| **[README_TESTING.md](README_TESTING.md)** | This file - overview | Starting point |

---

## 🛠️ Helpful Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| **Start Testing** | `./scripts/start-testing.sh` | One-command setup |
| **Check Status** | `./scripts/check-status.sh` | View system status |
| **Test Webhook** | `./scripts/test-webhook.sh` | Send mock webhooks |

---

## 🎯 What Was Fixed

✅ **Removed invalid signature validation** - Exotel doesn't support it
✅ **Fixed webhook payload structure** - Now uses flat JSON
✅ **Fixed all field names** - Changed to snake_case
✅ **Simplified body parsing** - Clean express.json()
✅ **Updated configuration** - Removed invalid settings
✅ **Created comprehensive tests** - Automated and manual

**Read details:** [PHASE2_FIXES.md](PHASE2_FIXES.md)

---

## 📊 System Status

Check your system anytime:
```bash
./scripts/check-status.sh
```

Example output:
```
📊 QC Automation System Status
================================================

🚀 Server Status
✅ Server is running

🔴 Redis Status
✅ Redis container is running
✅ Redis is responding

💾 Database Status
✅ Database exists
   Total calls: 5
   Breakdown by status:
   received: 1
   downloaded: 4

📁 Storage Status
✅ Storage directory exists
   Audio files: 4
   Total size: 2.1M

🔗 ngrok Status
✅ ngrok tunnel is active
   Public URL: https://abc123xyz.ngrok-free.app
   Webhook URL: https://abc123xyz.ngrok-free.app/webhook/exotel

📊 Summary
✅ All systems operational!
🎯 Ready to receive webhooks!
```

---

## 🧪 Testing Options

### Option 1: Mock Webhook (No Exotel)
```bash
# Start server
npm run dev:all

# In another terminal
./scripts/test-webhook.sh
```

### Option 2: Real Exotel Webhook
```bash
# Follow QUICK_TEST_GUIDE.md
cat QUICK_TEST_GUIDE.md
```

### Option 3: Automated Tests
```bash
npm run test:phase2
```

---

## ✅ Success Checklist

After testing, verify:

- [ ] Server started successfully
- [ ] Redis container running
- [ ] ngrok tunnel active
- [ ] Webhook configured in Exotel
- [ ] Test call completed
- [ ] Webhook received (check logs)
- [ ] Call record in database
- [ ] Audio file downloaded
- [ ] Audio file playable

**Verify with:**
```bash
./scripts/check-status.sh
```

---

## 🔍 Debugging Tools

### View Logs
```bash
tail -f logs/app.log
```

### Check Database
```bash
sqlite3 database/app.db "SELECT * FROM calls;"
```

### Check Downloaded Files
```bash
ls -lh storage/audio/default/
```

### View Queue Jobs
```bash
docker exec -it sales-call-qc-redis redis-cli KEYS "bull:*"
```

### ngrok Web Interface
```
http://localhost:4040
```

---

## 📖 Example Test Flow

### 1. Start System
```bash
./scripts/start-testing.sh
```

### 2. Start ngrok
```bash
ngrok http 3000
```

### 3. Configure Exotel
- Go to https://my.exotel.com
- Set webhook URL: `https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel`
- Enable call recording

### 4. Make Test Call
- Use Exotel dashboard or API
- Talk for 15-20 seconds
- Hang up

### 5. Watch Logs
```
[INFO] Processing Exotel call recording webhook
[INFO] Call record created and download queued
[INFO] 📥 Processing download job: 1
[INFO] ✅ Download completed for call: call_xxx
```

### 6. Verify
```bash
./scripts/check-status.sh
```

---

## 🎓 Understanding the Flow

```
┌─────────────────────────────────────────────────┐
│              Exotel Webhook Flow                │
└─────────────────────────────────────────────────┘

   1. Call completed on Exotel
          ↓
   2. Exotel sends POST request
          ↓
   3. ngrok forwards to localhost:3000
          ↓
   4. Express receives at /webhook/exotel
          ↓
   5. Controller validates payload
          ↓
   6. Create call record in SQLite
          ↓
   7. Queue download job in Redis
          ↓
   8. Worker downloads audio from S3
          ↓
   9. Save to storage/audio/
          ↓
  10. Update status to "downloaded"
          ↓
  11. Queue transcription job (Phase 3)
```

---

## 🔐 Security Notes

Since Exotel doesn't support webhook signature validation:

1. **Use HTTPS** - Always use ngrok HTTPS URLs
2. **IP Whitelisting** - Configure firewall rules in production
3. **Monitor Logs** - Watch for suspicious activity
4. **Rate Limiting** - Implement in production
5. **VPN/Private Network** - Deploy behind VPN when possible

---

## 🚨 Common Issues & Fixes

### "Webhook not received"
```bash
# Check if server is running
curl http://localhost:3000/health

# Check if ngrok is forwarding
curl https://YOUR_NGROK_URL.ngrok-free.app/health
```

### "Download failed"
```bash
# Check storage directory
ls -la storage/audio/default/

# Fix permissions
chmod -R 755 storage/
```

### "401 Unauthorized"
```bash
# Exotel recording URLs may need authentication
# See TESTING_WITH_EXOTEL.md for fix
```

**Full troubleshooting:** [TESTING_WITH_EXOTEL.md#troubleshooting](TESTING_WITH_EXOTEL.md)

---

## 📞 Support & Resources

### Documentation
- **Exotel API Docs:** https://developer.exotel.com
- **Exotel Support:** https://support.exotel.com
- **ngrok Docs:** https://ngrok.com/docs

### Your Project Docs
- Quick Guide: [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md)
- Full Guide: [TESTING_WITH_EXOTEL.md](TESTING_WITH_EXOTEL.md)
- Technical Fixes: [PHASE2_FIXES.md](PHASE2_FIXES.md)

---

## 🎉 What's Next?

Once you've successfully tested with real Exotel:

### ✅ Phase II Complete!
- Webhook integration working ✓
- Audio download functional ✓
- Queue system operational ✓

### ⏭️ Move to Phase III
- Set up Whisper.cpp for transcription
- Implement speech-to-text pipeline
- Handle Hindi/English/Hinglish

### 📖 Read Phase III Documentation
```bash
cat PLAN/AI-Sales-Call-QC-MVP-Development-Plan.md
# Scroll to Phase 3 section
```

---

## 💬 Quick Commands Reference

```bash
# Check system status
./scripts/check-status.sh

# Start application
./scripts/start-testing.sh

# Test with mock webhooks
./scripts/test-webhook.sh

# Monitor logs
tail -f logs/app.log

# View database
sqlite3 database/app.db "SELECT * FROM calls;"

# Check audio files
ls -lh storage/audio/default/

# View queue
docker exec -it sales-call-qc-redis redis-cli KEYS "bull:*"
```

---

**🎯 You're ready to test! Start with [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md) for the fastest path.**

**Good luck! 🚀**
