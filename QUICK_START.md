# 🎵 Noir AI - Quick Access Guide

## Quick Access URL
**http://localhost:8080**

Bookmark this URL in your browser for instant access!

## Quick Start Methods

### Method 1: Use the Start Script (Recommended)
```bash
chmod +x start.sh
./start.sh
```
This will:
- Start the dev server
- Automatically open your browser to Noir
- Show you the URL

### Method 2: Manual Start
```bash
npm run dev
```
Then open: **http://localhost:8080**

### Method 3: Create a Desktop Shortcut

**On macOS:**
1. Open Automator
2. Create a new "Application"
3. Add "Run Shell Script" action
4. Paste: `cd /Users/home/lando-ai-production-assistant-v1 && npm run dev && open http://localhost:8080`
5. Save as "Noir.app" in Applications

**On Windows:**
1. Create a new shortcut
2. Target: `cmd /c "cd /d C:\path\to\project && npm run dev && start http://localhost:8080"`
3. Name it "Noir"

## Browser Bookmark
1. Open http://localhost:8080
2. Press `Cmd+D` (Mac) or `Ctrl+D` (Windows)
3. Name it "Noir AI"
4. Save it to your Bookmarks Bar for one-click access

## Always Remember
- **URL**: http://localhost:8080
- **Port**: 8080
- **Command**: `npm run dev`
