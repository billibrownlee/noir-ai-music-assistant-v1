#!/bin/bash

# Noir AI Music Production Assistant - Quick Start Script
# This script starts the dev server and opens the app in your browser

echo "🎵 Starting Noir AI Music Production Assistant..."
echo ""

# Start the dev server in the background
npm run dev &
DEV_PID=$!

# Wait a moment for the server to start
sleep 3

# Open the browser
echo "🌐 Opening http://localhost:8080 in your browser..."
open http://localhost:8080

echo ""
echo "✅ Noir is running at http://localhost:8080"
echo "📌 Bookmark this URL for quick access: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for the process
wait $DEV_PID
