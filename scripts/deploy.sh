#!/usr/bin/env bash
# Deploy Prompt To API to Firebase.
#
# What this does:
#   1. Verifies the currently-selected Firebase project matches .firebaserc.
#   2. Builds the shared package, Cloud Functions, and SvelteKit app (adapter-node).
#   3. Copies the SvelteKit build output into functions/build/ so the `ssr`
#      function can handler() against it.
#   4. Runs firebase deploy for hosting + functions + firestore rules/indexes.
#
# Never run automatically — the user runs this manually.

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

EXPECTED_PROJECT="$(node -e 'const fs=require("fs");console.log(JSON.parse(fs.readFileSync("./.firebaserc","utf8")).projects.default)')"
CURRENT_PROJECT="$(firebase use --json 2>/dev/null | node -e 'let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{try{const j=JSON.parse(s);console.log(j.status==="success"?j.result.active:"")}catch(e){console.log("")}})' || true)"

if [[ -z "$CURRENT_PROJECT" ]]; then
	echo "No active Firebase project — running \`firebase use $EXPECTED_PROJECT\`"
	firebase use "$EXPECTED_PROJECT"
	CURRENT_PROJECT="$EXPECTED_PROJECT"
fi

if [[ "$CURRENT_PROJECT" != "$EXPECTED_PROJECT" ]]; then
	echo "Refusing to deploy: active Firebase project ($CURRENT_PROJECT) != .firebaserc default ($EXPECTED_PROJECT)"
	echo "Run: firebase use $EXPECTED_PROJECT"
	exit 1
fi

read -r -p "Deploy to $EXPECTED_PROJECT? [y/N] " ans
if [[ ! "$ans" =~ ^[Yy]$ ]]; then
	echo "Cancelled."
	exit 0
fi

echo "==> Install deps (if needed)"
pnpm install --frozen-lockfile || pnpm install

echo "==> Build Cloud Functions"
pnpm --filter functions build

echo "==> Build SvelteKit"
pnpm run build

echo "==> Copy SvelteKit build to functions/build for SSR function"
rm -rf functions/build
mkdir -p functions/build
cp -R build/* functions/build/

echo "==> firebase deploy"
firebase deploy \
	--only hosting,functions,firestore:rules,firestore:indexes \
	--project "$EXPECTED_PROJECT"

echo "Done."
