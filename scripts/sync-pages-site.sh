#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/docs/site"
rm -rf "$SITE"
mkdir -p "$SITE"
for f in README.md NAVIGATION.md; do [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$SITE/"; done
mkdir -p "$SITE/resources" "$SITE/data" "$SITE/guides"
for f in "$ROOT/resources/"*.md; do [ -f "$f" ] && cp "$f" "$SITE/resources/"; done
for f in "$ROOT/guides/"*.md; do [ -f "$f" ] && cp "$f" "$SITE/guides/"; done
for f in "$ROOT/data/"*.json; do [ -f "$f" ] && cp "$f" "$SITE/data/"; done
mkdir -p "$ROOT/docs/_data"
[ -f "$ROOT/data/tracks.json" ] && cp "$ROOT/data/tracks.json" "$ROOT/docs/_data/tracks.json"
[ -f "$ROOT/data/guides.json" ] && cp "$ROOT/data/guides.json" "$ROOT/docs/_data/guides.json"
echo "Synced $(find "$SITE" -type f | wc -l) site files (+ docs/_data)"
