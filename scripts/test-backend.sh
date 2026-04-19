#!/usr/bin/env bash
# Smoke-test the backend end-to-end against the local emulator.
# - Hits SvelteKit health
# - Hits Cloud Functions health (via emulator URL)
# - If a token is piped in via stdin or TOKEN env var, exercises /chat
set -euo pipefail

FE_BASE="${FE_BASE:-http://localhost:5260}"
PROJECT_ID="${ADMIN_PROJECT_ID:-prompt-to-api}"
FN_BASE="${FN_BASE:-http://localhost:9232/$PROJECT_ID/us-central1/api/v1}"

echo "== SvelteKit health =="
curl --silent --show-error "$FE_BASE/api/health" | sed 's/^/  /'
echo
echo

echo "== Functions API health =="
curl --silent --show-error "$FN_BASE/health" | sed 's/^/  /'
echo
echo

if [[ -n "${TOKEN:-}" && -n "${ASSISTANT_ID:-}" ]]; then
	echo "== Chat round-trip =="
	curl --silent --show-error -X POST "$FN_BASE/assistants/$ASSISTANT_ID/chat" \
		-H "Authorization: Bearer $TOKEN" \
		-H "Content-Type: application/json" \
		-d '{"messages":[{"role":"user","content":"ping"}]}' | sed 's/^/  /'
	echo
fi

echo "done."
