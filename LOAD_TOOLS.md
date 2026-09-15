# How to Load Noir Audio Tools

## Quick Start

### Step 1: Start the Server

```bash
cd /Users/home/lando-ai-production-assistant-v1
npm run dev
```

Wait for the message: `Local: http://localhost:8080/`

### Step 2: Open in Browser

**Option A: Use the Tools Index Page (Easiest)**

- Open: [http://localhost:8080/audio-tools.html](http://localhost:8080/audio-tools.html)
- Click on any tool you want to use

**Option B: Direct Links**

- Reverse Audio: [http://localhost:8080/reverse-audio.html](http://localhost:8080/reverse-audio.html)
- Speed/Tempo: [http://localhost:8080/speed-audio.html](http://localhost:8080/speed-audio.html)
- Pitch Shift: [http://localhost:8080/pitch-audio.html](http://localhost:8080/pitch-audio.html)

**Option C: Main App**

- Main Noir App: [http://localhost:8080](http://localhost:8080)

## All Available URLs

1. **Main Noir Application**
  - URL: [http://localhost:8080](http://localhost:8080)
  - Full music production platform
2. **Audio Tools Index** (Links to all tools)
  - URL: [http://localhost:8080/audio-tools.html](http://localhost:8080/audio-tools.html)
  - Quick access to all standalone tools
3. **Reverse Audio Tool**
  - URL: [http://localhost:8080/reverse-audio.html](http://localhost:8080/reverse-audio.html)
  - Reverse audio playback
4. **Speed/Tempo Tool**
  - URL: [http://localhost:8080/speed-audio.html](http://localhost:8080/speed-audio.html)
  - Change speed (0.25x to 4x)
  - Custom input for precise control
5. **Pitch Shift Tool**
  - URL: [http://localhost:8080/pitch-audio.html](http://localhost:8080/pitch-audio.html)
  - Change pitch (-12 to +12 semitones)
  - Custom input for precise control

## Bookmark These URLs

Save these URLs in your browser bookmarks for quick access:

- [http://localhost:8080](http://localhost:8080) (Main App)
- [http://localhost:8080/audio-tools.html](http://localhost:8080/audio-tools.html) (Tools Index)

## Troubleshooting

**Server not running?**

```bash
npm run dev
```

**Port 8080 already in use?**

```bash
lsof -ti:8080 | xargs kill -9
npm run dev
```

**Can't access the tools?**

- Make sure the server is running
- Check that you're using [http://localhost:8080](http://localhost:8080) (not https)
- Try refreshing the page

