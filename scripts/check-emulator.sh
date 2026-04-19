#!/usr/bin/env bash
# Quick health check for all Firebase emulator ports.
set -euo pipefail

check() {
	local name="$1"; local url="$2"
	if curl --silent --max-time 2 "$url" -o /dev/null -w '%{http_code}' | grep -qE '^(2|3|4)[0-9][0-9]$'; then
		echo "  ✓ $name  ($url)"
	else
		echo "  ✗ $name  ($url)  — NOT RESPONDING"
		return 1
	fi
}

echo "Checking Prompt To API emulators..."
check "Auth     " "http://localhost:9230"
check "Firestore" "http://localhost:9231"
check "Functions" "http://localhost:9232"
check "UI       " "http://localhost:9233"
check "Hub      " "http://localhost:9234/emulators"
check "Frontend " "http://localhost:5260"
