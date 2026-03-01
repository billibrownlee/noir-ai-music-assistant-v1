# Auto-Start Server Setup

The Noir dev server can now automatically start when you open the project!

## Option 1: VS Code/Cursor Auto-Start (Recommended)

The project is configured to automatically start the server when you open it in VS Code or Cursor.

**How it works:**
- When you open the project folder, the server will automatically start
- You'll see a notification asking to allow the task
- Click "Allow" and the server will start automatically

**To enable:**
1. Open the project in VS Code/Cursor
2. When prompted, click "Allow" to run the automatic task
3. The server will start automatically!

**If it doesn't auto-start:**
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type "Tasks: Run Task"
- Select "Start Noir Dev Server"

## Option 2: Manual Script

Run the auto-start script:
```bash
npm run auto-start
```

Or directly:
```bash
./auto-start.sh
```

## Option 3: Quick Start Command

Just run:
```bash
npm run dev
```

## Access URLs

Once the server is running:
- **Main App:** http://localhost:8080
- **Tools Index:** http://localhost:8080/audio-tools.html
- **Reverse Audio:** http://localhost:8080/reverse-audio.html
- **Speed/Tempo:** http://localhost:8080/speed-audio.html
- **Pitch Shift:** http://localhost:8080/pitch-audio.html

## Troubleshooting

**Server not starting automatically?**
- Make sure you clicked "Allow" when prompted
- Check VS Code/Cursor settings: `task.allowAutomaticTasks` should be "on"
- Manually run: `npm run dev`

**Port 8080 already in use?**
- The auto-start script will detect this and tell you
- Or kill the process: `lsof -ti:8080 | xargs kill -9`

**Want to disable auto-start?**
- Remove or rename `.vscode/tasks.json`
- Or change `"runOn": "folderOpen"` to `"runOn": "default"`
