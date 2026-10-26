#!/usr/bin/env bash
# Records app clips; needs the app dev server on :5173 (npm run dev in the repo root).
set -euo pipefail
export PUPPETEER_CORE="${PUPPETEER_CORE:-$(ls -d ~/.npm/_npx/*/node_modules/puppeteer-core | head -1)}"
export CHROME="${CHROME:-$(ls -d ~/.cache/puppeteer/chrome/*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing | head -1)}"
node "$(dirname "$0")/record.mjs" "$@"
