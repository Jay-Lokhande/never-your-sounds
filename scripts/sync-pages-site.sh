#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/docs/site"
rm -rf "$SITE"
mkdir -p "$SITE"
for f in README.md NAVIGATION.md; do [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$SITE/"; done
mkdir -p "$SITE/resources" "$SITE/data"
for f in "$ROOT/resources/"*.md; do [ -f "$f" ] && cp "$f" "$SITE/resources/"; done
for f in "$ROOT/data/"*.json; do [ -f "$f" ] && cp "$f" "$SITE/data/"; done
echo "Synced $(find "$SITE" -type f | wc -l) files"
