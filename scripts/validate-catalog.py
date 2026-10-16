#!/usr/bin/env python3
"""Validate data/sound-resources.json and data/tracks.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]

ALLOWED_CATEGORIES = frozenset(
    {
        "daw",
        "edu",
        "notation",
        "samples",
        "plugin",
        "utility",
        "game-audio",
        "podcast",
        "hardware",
        "distribution",
        "learn",
        "community",
        "video",
        "live",
    }
)
ALLOWED_COST = frozenset({"free", "freemium", "paid", "edu", "varies"})
ALLOWED_PLATFORM = frozenset({"web", "win", "mac", "linux", "ios", "android"})


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def validate_resources(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        fail(f"{path}: root must be an array")

    names: set[str] = set()
    for i, row in enumerate(data):
        if not isinstance(row, dict):
            fail(f"{path}[{i}]: entry must be an object")
        for key in ("name", "category", "url"):
            if key not in row or not str(row[key]).strip():
                fail(f"{path}[{i}]: missing {key}")

        name = str(row["name"]).strip()
        if name in names:
            fail(f"duplicate name: {name}")
        names.add(name)

        cat = str(row["category"]).strip()
        if cat not in ALLOWED_CATEGORIES:
            fail(f"{name}: invalid category {cat!r}")

        url = str(row["url"]).strip()
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            fail(f"{name}: url must be https with host ({url!r})")

        if "cost" in row and row["cost"] not in ALLOWED_COST:
            fail(f"{name}: invalid cost {row['cost']!r}")

        if "platform" in row:
            plats = row["platform"]
            if not isinstance(plats, list) or not plats:
                fail(f"{name}: platform must be a non-empty array")
            for p in plats:
                if p not in ALLOWED_PLATFORM:
                    fail(f"{name}: invalid platform {p!r}")

        if "tags" in row and not isinstance(row["tags"], list):
            fail(f"{name}: tags must be an array")

        if "reviewed" in row and not isinstance(row["reviewed"], str):
            fail(f"{name}: reviewed must be a string (YYYY-MM)")

    print(f"OK: {len(data)} resources in {path.name}")


def validate_tracks(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        fail(f"{path}: root must be an array")
    for i, track in enumerate(data):
        if not track.get("id") or not track.get("title"):
            fail(f"track[{i}]: needs id and title")
        steps = track.get("steps")
        if not isinstance(steps, list) or not steps:
            fail(f"track {track.get('id')}: needs steps")
        for step in steps:
            if "label" not in step or "guide" not in step:
                fail(f"track {track['id']}: step missing label or guide")
    print(f"OK: {len(data)} tracks in {path.name}")


def main() -> None:
    validate_resources(ROOT / "data" / "sound-resources.json")
    validate_tracks(ROOT / "data" / "tracks.json")
    print("Catalog validation passed.")


if __name__ == "__main__":
    main()
