#!/usr/bin/env python3
"""Validate the local resource, guide and learning-path catalogues (no network)."""
from __future__ import annotations

import argparse
import ipaddress
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path, PurePosixPath
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_CATEGORIES = frozenset({
    "daw", "edu", "notation", "samples", "plugin", "utility", "game-audio",
    "podcast", "hardware", "distribution", "learn", "community", "video", "live",
})
ALLOWED_COST = frozenset({"free", "freemium", "paid", "edu", "varies", "unknown"})
ALLOWED_PLATFORM = frozenset({"web", "win", "mac", "linux", "ios", "android"})
ID_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")


class CatalogError(ValueError):
    """A predictable, human-readable catalogue validation error."""


def fail(message: str) -> None:
    raise CatalogError(message)


def normalized(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def text_field(row: dict, key: str, context: str, required: bool = True) -> str | None:
    if key not in row:
        if required:
            fail(f"{context}: missing {key}")
        return None
    value = row[key]
    if not isinstance(value, str) or not value.strip():
        fail(f"{context}: {key} must be a non-empty string")
    if value != value.strip():
        fail(f"{context}: {key} must not have surrounding whitespace")
    return value


def unique(value: str, seen: set[str], context: str, label: str) -> None:
    key = normalized(value)
    if key in seen:
        fail(f"{context}: duplicate {label} {value!r}")
    seen.add(key)


def json_array(path: Path) -> list:
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail(f"{path}: cannot read JSON ({error})")
    if not isinstance(data, list) or not data:
        fail(f"{path}: root must be a non-empty array")
    return data


def object_row(row: object, context: str) -> dict:
    if not isinstance(row, dict):
        fail(f"{context}: entry must be an object")
    return row


def string_array(row: dict, key: str, context: str, *, required: bool = False,
                 allow_empty: bool = True, allowed: frozenset | None = None) -> list:
    if key not in row:
        if required:
            fail(f"{context}: missing {key}")
        return []
    values = row[key]
    if not isinstance(values, list) or (not values and not allow_empty):
        fail(f"{context}: {key} must be {'a non-empty' if not allow_empty else 'an'} array")
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str) or not value.strip() or value != value.strip():
            fail(f"{context}: {key} entries must be non-empty strings without surrounding whitespace")
        if allowed is not None and value not in allowed:
            fail(f"{context}: invalid {key} value {value!r}")
        unique(value, seen, context, f"{key} entry")
    return values


def https_url(value: str, context: str) -> str:
    """Validate an HTTPS URL and return a conservative duplicate-detection key."""
    if any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value) or "\\" in value:
        fail(f"{context}: URL must not contain whitespace, control characters or backslashes")
    try:
        parsed = urlsplit(value)
        hostname = parsed.hostname
        port = parsed.port
        if parsed.scheme != "https" or not hostname or parsed.username is not None or parsed.password is not None:
            fail(f"{context}: URL must use HTTPS with a host and no credentials")
        hostname = hostname.encode("idna").decode("ascii").lower().rstrip(".")
        try:
            ipaddress.ip_address(hostname)
        except ValueError:
            if not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in hostname.split(".")):
                fail(f"{context}: URL has an invalid hostname")
        if port is not None and port < 1:
            fail(f"{context}: URL has an invalid port")
    except (ValueError, UnicodeError) as error:
        if isinstance(error, CatalogError):
            raise
        fail(f"{context}: invalid URL ({error})")
    host = f"[{hostname}]" if ":" in hostname else hostname
    if port is not None and port != 443:
        host += f":{port}"
    # Fragments and trailing slashes do not make a second catalogue resource.
    # Preserve path case and encoded reserved characters: servers may distinguish them.
    path = re.sub(r"%[0-9a-fA-F]{2}", lambda match: unquote(match.group())
                  if re.fullmatch(r"[A-Za-z0-9._~-]", unquote(match.group())) else match.group().upper(), parsed.path)
    path = path.rstrip("/") or "/"
    return urlunsplit(("https", host, path, urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True))), ""))


def local_reference(value: str, root: Path, context: str) -> None:
    if "\\" in value or any(part in value for part in ("?", "#", "%", ":")):
        fail(f"{context}: local reference must be a repository-relative Markdown path")
    parts = PurePosixPath(value)
    if parts.is_absolute() or ".." in parts.parts or parts.suffix != ".md":
        fail(f"{context}: local reference must be a repository-relative Markdown path")
    resolved = (root / value).resolve()
    if not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
        fail(f"{context}: local reference does not exist inside the repository: {value!r}")


def reviewed_date(value: str, context: str) -> None:
    if not re.fullmatch(r"\d{4}-\d{2}(?:-\d{2})?", value):
        fail(f"{context}: reviewed must be YYYY-MM or YYYY-MM-DD")
    try:
        date.fromisoformat(value + "-01" if len(value) == 7 else value)
    except ValueError:
        fail(f"{context}: reviewed is not a valid calendar date")


def validate_resources(path: Path) -> None:
    data = json_array(path)
    names: set[str] = set()
    urls: set[str] = set()
    ids: set[str] = set()
    for index, value in enumerate(data):
        context = f"{path.name}[{index}]"
        row = object_row(value, context)
        name = text_field(row, "name", context)
        context = f"{context} ({name})"
        unique(name, names, context, "name")
        category = text_field(row, "category", context)
        if category not in ALLOWED_CATEGORIES:
            fail(f"{context}: invalid category {category!r}")
        url = text_field(row, "url", context)
        canonical = https_url(url, context)
        if canonical in urls:
            fail(f"{context}: duplicate URL {url!r}")
        urls.add(canonical)
        if "cost" in row:
            cost = text_field(row, "cost", context)
            if cost not in ALLOWED_COST:
                fail(f"{context}: invalid cost {cost!r}")
        string_array(row, "platform", context, allow_empty=False, allowed=ALLOWED_PLATFORM)
        string_array(row, "tags", context)
        for key in ("description", "license_notes", "pricing_notes"):
            text_field(row, key, context, required=False)
        identifier = text_field(row, "id", context, required=False)
        if identifier is not None:
            if not ID_PATTERN.fullmatch(identifier):
                fail(f"{context}: id must be a lowercase hyphenated identifier")
            unique(identifier, ids, context, "id")
        reviewed = text_field(row, "reviewed", context, required=False)
        if reviewed is not None:
            reviewed_date(reviewed, context)
        source = text_field(row, "source_url", context, required=False)
        if source is not None:
            https_url(source, f"{context} source_url")
    print(f"OK: {len(data)} resources in {path.name}")


def validate_guides(path: Path, root: Path = ROOT) -> None:
    data = json_array(path)
    titles: set[str] = set()
    paths: set[str] = set()
    for index, value in enumerate(data):
        context = f"{path.name}[{index}]"
        guide = object_row(value, context)
        title = text_field(guide, "title", context)
        unique(title, titles, context, "guide title")
        text_field(guide, "blurb", context)
        text_field(guide, "icon", context, required=False)
        reference = text_field(guide, "path", context)
        unique(reference, paths, context, "guide path")
        local_reference(reference, root, context)
    print(f"OK: {len(data)} guides in {path.name}")


def validate_tracks(path: Path, root: Path = ROOT) -> None:
    data = json_array(path)
    ids: set[str] = set()
    titles: set[str] = set()
    for index, value in enumerate(data):
        context = f"{path.name}[{index}]"
        track = object_row(value, context)
        identifier = text_field(track, "id", context)
        if not ID_PATTERN.fullmatch(identifier):
            fail(f"{context}: id must be a lowercase hyphenated identifier")
        unique(identifier, ids, context, "track id")
        title = text_field(track, "title", context)
        unique(title, titles, context, "track title")
        for key in ("description", "outcome"):
            text_field(track, key, context, required=False)
        steps = track.get("steps")
        if not isinstance(steps, list) or not steps:
            fail(f"{context}: steps must be a non-empty array")
        labels: set[str] = set()
        for step_index, step_value in enumerate(steps):
            step_context = f"{context} ({identifier}) step[{step_index}]"
            step = object_row(step_value, step_context)
            label = text_field(step, "label", step_context)
            unique(label, labels, step_context, "step label")
            reference = text_field(step, "guide", step_context)
            local_reference(reference, root, step_context)
            # Preserve earlier consumers of the minimal {label, guide} schema.
            string_array(step, "categories", step_context, allowed=ALLOWED_CATEGORIES)
            text_field(step, "action", step_context, required=False)
    print(f"OK: {len(data)} tracks in {path.name}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root (default: parent of scripts)")
    root = parser.parse_args().root.resolve()
    errors = []
    for validator, path, needs_root in (
        (validate_resources, root / "data/sound-resources.json", False),
        (validate_guides, root / "data/guides.json", True),
        (validate_tracks, root / "data/tracks.json", True),
    ):
        try:
            validator(path, root) if needs_root else validator(path)
        except CatalogError as error:
            errors.append(str(error))
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Catalog validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
