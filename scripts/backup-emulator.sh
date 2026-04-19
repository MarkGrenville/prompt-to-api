#!/usr/bin/env bash
# Exports the Firebase emulator's in-memory auth + Firestore state to
# ./emulator-data so that a restart (or `emulators:start --import=./emulator-data`)
# can resume from the last known snapshot.
#
# Runs every 5 minutes under PM2 (see ecosystem.config.cjs :: prompt-to-api-backup).
# Safe to run standalone: if the emulator isn't up, it exits silently.

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

HUB_PORT=9234
EXPORT_DIR="./emulator-data"

if ! curl --silent --max-time 2 "http://localhost:$HUB_PORT/emulators" >/dev/null; then
    echo "[backup] Emulator hub not reachable on :$HUB_PORT — skipping."
    exit 0
fi

mkdir -p "$EXPORT_DIR"

PROJECT_ID="$(node -e 'const fs=require("fs");console.log(JSON.parse(fs.readFileSync("./.firebaserc","utf8")).projects.default)')"

# The emulator hub exposes an `/functions/disable` + export trigger that
# firebase-tools uses when you run `firebase emulators:export`. Use the CLI
# wrapper so auth/firestore (and anything else running) are all exported.
if firebase emulators:export "$EXPORT_DIR" --project "$PROJECT_ID" --force >/tmp/pta-backup.log 2>&1; then
    echo "[backup] Emulator exported to $EXPORT_DIR at $(date -u +%FT%TZ)"
else
    echo "[backup] Export failed — see /tmp/pta-backup.log"
    tail -n 10 /tmp/pta-backup.log || true
    exit 1
fi
