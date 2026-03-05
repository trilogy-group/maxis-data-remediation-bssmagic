# BSS Magic App Template - Quick Start Guide

## Overview

This is the **BSS Magic Dashboard** - a React application for monitoring and remediating CloudSense/Salesforce data issues. It connects to the BSS Magic Runtime on AWS to fetch TMF API data.

## Prerequisites

- **Node.js 18+** (recommended: Node.js 20)
- **npm** (comes with Node.js)

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
# For Sandbox environment (recommended for testing)
cp .env.sandbox .env.local

# OR for Production environment
cp .env.production .env.local
```

### 3. Start the Application

```bash
npm run dev
```

The app will open at **http://localhost:3001** (or next available port).

---

## Environment Configuration

### Sandbox vs Production

| File | Target | Use Case |
|------|--------|----------|
| `.env.sandbox` | AWS Sandbox Runtime | Development & Testing |
| `.env.production` | AWS Production Runtime | Demo & Production |

### Key Environment Variables

```bash
# TMF API Configuration
VITE_TMF_API_URL=http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
VITE_BSSMAGIC_API_KEY=bssmagic-d58d6761265b01accc13e8b21bae8282
VITE_TMF_ENVIRONMENT=sandbox  # or "production"

# Development Mode (bypasses Cognito auth)
VITE_DEV_MODE=true

# Local Gateway URLs (optional - for OE patching features)
VITE_GATEWAY_CLOUDSENSE_URL=http://localhost:8080
VITE_GATEWAY_1147_URL=http://localhost:8081
```

---

## Features

### Modules Available

1. **Executive Dashboard** - Overview of data issues and business impact
2. **1867 OE Patcher** - Fix missing Order Entry data
3. **1147 Solution Empty** - Remediate empty solutions
4. **Order Not Generated** - Fix stuck orders
5. **IoT QBS Remediator** - IoT-specific issue fixes
6. **Service Problems** - TMF656 Service Problem Management

### Data Source

The app fetches data from the **BSS Magic Runtime** via TMF APIs:
- TMF638 - Service Inventory
- TMF637 - Product Inventory
- TMF663 - Shopping Cart
- TMF622 - Product Ordering
- TMF666 - Billing Account
- TMF656 - Service Problem Management

---

## Troubleshooting

### CORS Errors

The app uses a Vite proxy to avoid CORS issues. The proxy is configured in `vite.config.ts` and automatically:
- Adds the `X-API-Key` header
- Adds `X-Environment: sandbox` header when configured

### "Gateway not running" Errors

Some features require local gateway services. If you see gateway errors:
1. These features are optional
2. Contact the development team for gateway setup instructions

### Port Already in Use

If port 3001 is busy, Vite will automatically use the next available port (3002, 3003, etc.)

---

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder, ready for static hosting.

---

## Support

For questions or issues, contact the BSS Magic team.
