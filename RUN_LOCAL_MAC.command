#!/bin/bash
cd "$(dirname "$0")"
echo "Mission Companion local server"
echo "Open http://localhost:8000 in your browser."
echo "Press Control-C to stop the server."
python3 -m http.server 8000
