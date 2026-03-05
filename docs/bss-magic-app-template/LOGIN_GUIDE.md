# BSS Magic Dashboard - Login Guide

## 🔐 Authentication Options

The BSS Magic Dashboard supports two authentication modes:

### ✅ Option 1: Development Mode (NO LOGIN REQUIRED) - **ACTIVE NOW**

**Status:** 🟢 **ENABLED** - Server running on http://localhost:3002/

I've already configured the dashboard to run in **development mode**, which bypasses authentication completely. You can access it right away!

**What you get:**
- ✅ **No login required** - Direct access to dashboard
- ✅ Auto-authenticated as "Development User"
- ✅ Full admin privileges
- ✅ All 5 remediation modules available
- ✅ TMF API integration active

**To access:**
```
Open your browser: http://localhost:3002/
```

The dashboard will load immediately without asking for credentials!

**Configuration:**
The `.env.local` file is now set with:
```bash
VITE_DEV_MODE=true  # This bypasses authentication
```

---

### 🔒 Option 2: Production Mode (AWS Cognito Required)

If you need to use real AWS Cognito authentication:

#### Step 1: Configure Cognito Credentials

Edit `.env.local` and add your Cognito details:

```bash
# Disable dev mode
VITE_DEV_MODE=false

# AWS Cognito Configuration
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-user-pool-id-here
VITE_COGNITO_CLIENT_ID=your-client-id-here

# TMF API Configuration (keep these)
VITE_TMF_API_URL=http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
VITE_BSSMAGIC_API_KEY=bssmagic-d58d6761265b01accc13e8b21bae8282
VITE_TMF_ENVIRONMENT=production
```

#### Step 2: Get Your Cognito Credentials

1. **AWS Console** → **Cognito** → **User Pools**
2. Select your BSS Magic User Pool
3. Copy **User Pool ID**
4. Go to **App Integration** → **App Clients**
5. Copy **Client ID**

#### Step 3: Restart the Server

```bash
# Stop the current server (Ctrl+C in terminal)
npm run dev
```

#### Step 4: Login

You'll see a login screen. Use your Cognito credentials:
- **Email:** Your registered email in Cognito
- **Password:** Your Cognito password

**First-time users:**
- If prompted for "New Password Required", set a new password
- Follow the AWS Cognito password requirements

---

## 🚀 Quick Start (Current Setup)

Since dev mode is already enabled, just:

1. **Open browser:** http://localhost:3002/
2. **Dashboard loads automatically!**
3. **No login needed!**

You'll see:
- 5 module buttons at the top (colorful icons)
- Default module: "Order Not Generated" (⚠️)
- Click any module to switch views

---

## 🔧 Switching Between Modes

### To Switch to Dev Mode:
```bash
# Edit .env.local
VITE_DEV_MODE=true

# Restart server
npm run dev
```

### To Switch to Production Mode:
```bash
# Edit .env.local
VITE_DEV_MODE=false
VITE_COGNITO_USER_POOL_ID=your-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id

# Restart server
npm run dev
```

---

## 🆘 Troubleshooting

### "Cognito is not configured" Error
**Solution:** You're in production mode without Cognito credentials
- Either set `VITE_DEV_MODE=true` in `.env.local`
- Or add your Cognito credentials

### Login Screen Shows Instead of Dashboard
**Solution:** Check `.env.local` has `VITE_DEV_MODE=true`
- Restart the dev server after changing

### "Network Error" on Login
**Solution:** Cognito credentials are invalid or network issue
- Verify User Pool ID and Client ID are correct
- Check AWS region matches your Cognito setup

---

## 📊 What's Available

Once logged in (or in dev mode), you have access to:

### 5 Remediation Modules:

1. **🔧 1867 OE Data Patcher**
   - Patch missing OE attributes
   - 4 scenarios: Fibre+Voice, Fibre-Only, Mobile+ESMS, Access+Voice

2. **📦 1147 Solution Empty**
   - Fix failed migration products
   - Automatic remediation with "Fix" button

3. **⚠️ Order Not Generated** (Default)
   - Fix stuck baskets
   - Shows root cause and manual steps

4. **🔌 IoT QBS Remediator**
   - Repair corrupted PC linkages
   - Shows services and orders

5. **📋 Service Problems**
   - Track all TMF656 issues
   - Filter by status and category

---

## 🎉 You're All Set!

**Current Status:**
- ✅ Server: Running on port 3002
- ✅ Auth Mode: Development (no login)
- ✅ TMF APIs: Configured
- ✅ Dashboard: Ready to use

**Access Now:** http://localhost:3002/

Enjoy exploring the BSS Magic Dashboard! 🚀
