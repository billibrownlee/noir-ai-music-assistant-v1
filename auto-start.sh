#!/bin/bash

# Noir Auto-Start Script
# This script automatically starts the dev server when you open the project

echo "🎵 Starting Noir AI Music Production Platform..."
echo ""

# Check if port 8080 is already in use
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Server already running on port 8080"
    echo "🌐 Access at: http://localhost:8080"
    echo "🛠️  Tools: http://localhost:8080/audio-tools.html"
    exit 0
fi

# Start the dev server
echo "🚀 Starting dev server..."
npm run dev
