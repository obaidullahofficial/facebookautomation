# 🌙 Islamic Facebook Automation System

An AI-powered system that generates daily Quranic posts (Arabic ayat + Urdu tarjuma + tafseer + image) and lets you approve them before publishing to your Facebook Page.

## ✨ Features

- 🤖 **AI-powered** captions via Google Gemini (or built-in fallback — no key required to start)
- 🖼️ **Free image generation** via Pollinations.ai (zero cost, no API key needed)
- 📖 **30+ curated Quranic ayat** rotating daily
- ✅ **Approval dashboard** — review before publishing
- 📤 **One-click Facebook publish** via Graph API
- 🎭 **Mock mode** — test everything without real Facebook
- ⏰ **Daily scheduler** at 9:00 AM PKT (configurable)
- 📊 **Post history** with status tracking

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open your browser
# http://localhost:3000
```

## ⚙️ Configuration

All settings can be configured from the **Settings** page in the dashboard, or via `.env`:

| Setting | Description |
|---|---|
| Gemini API Key | Free key from https://aistudio.google.com |
| Facebook Page ID | Your FB Page numeric ID |
| Facebook Access Token | Long-lived Page Access Token |
| Schedule Time | Daily generation time (default: 09:00 PKT) |
| Mock Mode | Test without real publishing |

## 📋 Setup Guide

See the **Setup Guide** tab inside the dashboard for step-by-step Facebook API instructions.

## 📁 Project Structure

```
fb-automation/
├── backend/
│   ├── server.js        # Express REST API
│   ├── database.js      # JSON flat-file database
│   ├── aiGenerator.js   # Gemini + Pollinations AI
│   ├── facebookApi.js   # Facebook Graph API
│   └── scheduler.js     # Daily cron job
├── frontend/
│   ├── index.html       # Dashboard UI
│   ├── style.css        # Dark glassmorphism styles
│   └── app.js           # Dashboard JavaScript
├── data/
│   └── db.json          # All posts & settings stored here
└── .env                 # Environment variables
```

## 🔄 Daily Workflow

1. Every day at your scheduled time, the AI generates a new Quranic post
2. You receive a notification (or check the dashboard)
3. Review the post — Arabic ayat, Urdu translation, tafseer, image
4. Click **Approve** then **Publish to Facebook**
5. Done! بارک اللہ فیک 🌙

## 🛑 Requirements

- Node.js v16+
- No Visual Studio / native build tools needed
