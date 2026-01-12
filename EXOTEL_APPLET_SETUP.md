# 🎯 Exotel Applet Setup Guide - Complete Walkthrough

This guide shows you how to configure Exotel using **Applets** (the visual flow builder) to send webhooks to your application.

---

## 📖 Understanding Exotel Applets

Exotel uses a visual **Call Flow Builder** with "Applets" (building blocks) to design call flows. To receive webhooks with call recordings, you need to:

1. **Create a Call Flow** using applets
2. **Enable Recording** in the Connect applet
3. **Add a Passthru Applet** to send webhook notifications
4. **Assign the flow** to your Exotel number

---

## 🚀 Step-by-Step Configuration

### Step 1: Access Exotel Dashboard (1 min)

1. Go to https://my.exotel.com
2. Log in with your credentials

---

### Step 2: Navigate to App Bazaar (1 min)

1. Click on **"App Bazaar"** in the left menu (or top menu)
2. Click on **"Apps"** or **"My Apps"**
3. You'll see a list of your existing call flows

---

### Step 3: Create New Call Flow (2 mins)

#### Option A: Create New
1. Click **"Create New App"** or **"+ New Flow"**
2. Give it a name: **"QC Automation Webhook"**
3. Select flow type: **"Voice"** or **"Incoming Call"** or **"Outgoing Call"**

#### Option B: Edit Existing
1. Find an existing flow you want to use
2. Click **"Edit"** or the **pencil icon**

You'll now see the **Visual Flow Builder** with various applets.

---

### Step 4: Configure Connect Applet (3 mins)

The Connect applet connects the caller to another number.

1. **Find or Add Connect Applet**
   - Look for a **"Connect"** or **"Dial"** applet in your flow
   - If not present, drag it from the applet library on the left

2. **Configure Connect Settings**
   - Click on the **Connect applet** to open its settings
   - **Destination Number**: Enter the number to connect to (or select from options)
   - **Enable Recording**: ✅ Check the box **"Record this call"** or **"Enable Recording"**
   - **Recording Type**: Select **"Dual Channel"** (separate tracks for caller/callee) or **"Single"**
   - **Max Duration**: Set call duration limits if needed

3. **Save Connect Applet**
   - Click **"Save"** or **"Done"**

---

### Step 5: Add Passthru Applet for Webhook (5 mins)

The **Passthru applet** sends call details to your webhook URL.

#### 5.1 Locate "After Call Conversation Ends" Section

In the flow builder, look for:
- **"After Call Ends"** section
- **"On Call Complete"** section
- **"Post Call Actions"** section
- Or a **"+"** button to add actions after the call

#### 5.2 Add Passthru Applet

1. Click the **"+"** button or **"Add Applet"** in the "After Call Ends" section
2. Select **"Passthru"** or **"Information Pass Through"** from the applet list
3. A Passthru applet will be added to your flow

#### 5.3 Configure Passthru Applet

Click on the Passthru applet to configure:

**URL Field:**
```
https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel
```

**Example:**
```
https://abc123xyz.ngrok-free.app/webhook/exotel
```

**Important Settings:**
- ✅ **Make Passthru Async**: Check this box!
  - This ensures the webhook is sent without blocking the call flow
  - Your webhook will receive call details including the recording URL

**HTTP Method:**
- Select **POST** (if option is available)
- Some versions default to GET - that's okay for testing

**Content Type:**
- Select **"application/json"** if available

#### 5.4 Save Passthru Applet

Click **"Save"** or **"Done"**

---

### Step 6: Configure Additional Webhooks (Optional)

For complete tracking, add Passthru applets to other sections:

#### If Nobody Answers
1. Find **"If nobody answers"** or **"No Answer"** section
2. Add another **Passthru applet**
3. Use the same webhook URL
4. ✅ Check **"Make Passthru Async"**

#### If Call Fails
1. Find **"If call fails"** or **"Error"** section
2. Add another **Passthru applet**
3. Use the same webhook URL
4. ✅ Check **"Make Passthru Async"**

---

### Step 7: Save Call Flow (1 min)

1. Click **"Save Flow"** or **"Save"** button (usually top-right)
2. Give your flow a name if prompted: **"QC Webhook Flow"**
3. Wait for confirmation that the flow is saved

---

### Step 8: Assign Flow to Your Number (2 mins)

Now you need to assign this flow to your Exotel virtual number.

#### Method A: From Flow Settings
1. In the flow editor, look for **"Assign to Number"** option
2. Select your **ExoPhone number** from the dropdown
3. Click **"Assign"** or **"Save"**

#### Method B: From Phone Numbers Section
1. Go to **"Phone Numbers"** or **"Virtual Numbers"** in the left menu
2. Find your Exotel number
3. Click **"Configure"** or **"Settings"**
4. Under **"Incoming Call Flow"** or **"App"**, select your newly created flow
5. Click **"Save"**

---

### Step 9: Test Configuration (1 min)

1. Note your **Exotel virtual number**
2. Note your **ngrok webhook URL**: `https://YOUR_URL.ngrok-free.app/webhook/exotel`
3. Ready to make a test call!

---

## 📸 Visual Guide (What to Look For)

### Flow Builder Interface
```
┌─────────────────────────────────────────────────┐
│  QC Automation Webhook Flow          [Save]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────┐                                  │
│  │  Start   │                                  │
│  └────┬─────┘                                  │
│       │                                        │
│       ▼                                        │
│  ┌──────────────┐                             │
│  │   Connect    │  ← Click to configure       │
│  │  (Dial/Call) │    Enable recording here    │
│  └──────┬───────┘                             │
│         │                                      │
│         ▼                                      │
│  ┌──────────────────┐                         │
│  │ After Call Ends  │                         │
│  └──────┬───────────┘                         │
│         │                                      │
│         ▼                                      │
│  ┌──────────────────┐                         │
│  │    Passthru      │  ← Add this applet      │
│  │   (Webhook)      │    Configure URL here   │
│  └──────────────────┘                         │
│                                                │
└─────────────────────────────────────────────────┘
```

---

## ✅ Configuration Checklist

Before saving, verify:

- [ ] **Connect applet** has recording enabled
- [ ] **Passthru applet** added after "Call Ends"
- [ ] **Webhook URL** is your ngrok HTTPS URL
- [ ] **"Make Passthru Async"** is checked
- [ ] **Flow is saved**
- [ ] **Flow is assigned** to your Exotel number

---

## 🧪 Making a Test Call

### Option 1: Call Your Exotel Number

1. **From your mobile**: Call your Exotel virtual number
2. The call will follow your configured flow
3. Have a conversation (at least 15-20 seconds)
4. Hang up
5. **Wait 30-60 seconds** for Exotel to process the recording
6. Your webhook should receive the notification!

### Option 2: Use Exotel Dashboard

1. In Exotel dashboard, look for **"Make a Call"** or **"Test Call"**
2. **From**: Your mobile number
3. **To**: Test destination number
4. **Select Flow**: Choose your configured flow
5. Click **"Call"**
6. Answer the call and have a conversation
7. Hang up and wait for webhook

### Option 3: Use Exotel API

```bash
curl -X POST https://api.exotel.com/v1/Accounts/YOUR_ACCOUNT_SID/Calls/connect.json \
  -u YOUR_API_KEY:YOUR_API_TOKEN \
  -d "From=YOUR_MOBILE" \
  -d "To=DESTINATION_NUMBER" \
  -d "CallerId=YOUR_EXOTEL_NUMBER" \
  -d "Record=true"
```

---

## 🔍 What Your Webhook Will Receive

When the call ends, your webhook at `/webhook/exotel` will receive a POST request with:

### Expected Payload
```json
{
  "call_sid": "abc123xyz789",
  "transaction_id": "conn_456",
  "from": "09876543210",
  "to": "08012345678",
  "direction": "incoming",
  "start_time": "2025-01-08 10:30:00",
  "current_time": "2025-01-08 10:34:00",
  "dial_call_duration": 245,
  "on_call_duration": 240,
  "recording_url": "https://s3-ap-southeast-1.amazonaws.com/exotelrecordings/YOUR_SID/recording.mp3",
  "call_type": "completed",
  "dial_call_status": "completed"
}
```

---

## 📊 Verify in Your Application

### Check Server Logs
```bash
tail -f logs/app.log
```

Expected output:
```
[INFO] Processing Exotel call recording webhook
[INFO] Call record created and download queued
[INFO] 📥 Processing download job: 1
[INFO] ✅ Download completed
```

### Check ngrok
Open http://localhost:4040 to see incoming webhook requests

### Check Database
```bash
sqlite3 database/app.db "SELECT * FROM calls ORDER BY created_at DESC LIMIT 1;"
```

---

## 🐛 Troubleshooting

### Issue: "No webhook received"

**Check:**
1. Is your server running? `curl http://localhost:3000/health`
2. Is ngrok running? `curl https://YOUR_NGROK_URL.ngrok-free.app/health`
3. Did you check "Make Passthru Async"?
4. Is the flow assigned to your Exotel number?
5. Did you wait 30-60 seconds after call ended?

**Solution:**
- Double-check webhook URL in Passthru applet (no typos!)
- Make sure you're using HTTPS ngrok URL
- Check ngrok web interface (http://localhost:4040) for incoming requests

---

### Issue: "Webhook received but no recording_url"

**Check:**
1. Is recording enabled in Connect applet?
2. Was the call duration at least 1 second?
3. Did both parties answer?

**Solution:**
- Enable "Record this call" in Connect applet
- Make test calls at least 15-20 seconds long
- Ensure call completes successfully

---

### Issue: "Can't find Passthru applet"

**Look for these names:**
- "Passthru"
- "Information Pass Through"
- "Webhook"
- "HTTP Request"
- "Call Log"

**Location:**
- In the applet library/menu on the left side of flow builder
- Under "Advanced" or "Integration" category

---

### Issue: "Recording URL is empty or null"

**Possible causes:**
1. Recording not enabled in Connect applet
2. Call was too short (< 1 second)
3. Call didn't complete successfully
4. Recording still being processed (wait longer)

**Wait time:** Recordings can take 30 seconds to 2 minutes to be processed and available

---

## 💡 Pro Tips

1. **Use Async Mode**: Always check "Make Passthru Async" to avoid blocking call flow
2. **Test with Long Calls**: Make calls at least 15-20 seconds for reliable testing
3. **Watch ngrok**: Keep http://localhost:4040 open to see webhook requests in real-time
4. **Multiple Webhooks**: Add Passthru applets to multiple sections (call end, no answer, failed) for complete coverage
5. **Save Often**: Save your flow frequently while building
6. **Test Before Assigning**: Test the flow before assigning to production numbers

---

## 📖 Alternative: Using API (Without Applets)

If you prefer API-based calling instead of applets, include StatusCallback in your API requests:

```bash
curl -X POST https://api.exotel.com/v1/Accounts/YOUR_SID/Calls/connect.json \
  -u YOUR_API_KEY:YOUR_API_TOKEN \
  -d "From=YOUR_PHONE" \
  -d "To=DESTINATION" \
  -d "CallerId=YOUR_EXOTEL_NUMBER" \
  -d "Record=true" \
  -d "StatusCallback=https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel" \
  -d "StatusCallbackEvents[0]=terminal" \
  -d "StatusCallbackContentType=application/json"
```

---

## 🎯 Quick Reference

| Configuration Item | Value |
|-------------------|-------|
| **Webhook URL** | `https://YOUR_NGROK_URL.ngrok-free.app/webhook/exotel` |
| **Applet Type** | Passthru (Information Pass Through) |
| **When to Trigger** | After Call Conversation Ends |
| **Async Mode** | ✅ Enabled |
| **Recording** | ✅ Enabled in Connect applet |
| **HTTP Method** | POST (or GET) |

---

## 📞 Need Help?

### Check These:
1. **Exotel Support**: https://support.exotel.com
2. **Flow Builder Guide**: Look for "Applet" documentation in Exotel dashboard
3. **Your Logs**: `tail -f logs/app.log`
4. **ngrok Dashboard**: http://localhost:4040

### Common Exotel Applets:
- **Connect**: Dial/connect to another number
- **Gather**: Collect DTMF input
- **Play**: Play audio message
- **Passthru**: Send data to your webhook
- **Hangup**: End the call

---

**🎉 Once configured, your webhook will automatically receive call details with recording URLs!**

**Next:** Make a test call and watch your logs! 🚀
