#!/usr/bin/env python3
"""Regression tests for malformed catalogue input and backwards compatibility."""
from __future__ import annotations

import contextlib
import copy
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate-catalog.py")
SPEC = importlib.util.spec_from_file_location("catalog_validator", SCRIPT)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class CatalogueValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "data").mkdir()
        (self.root / "guides").mkdir()
        (self.root / "guides/example.md").write_text("# Example", encoding="utf-8")
        self.resources = [{"name": "Example Tool", "url": "https://example.com/tool", "category": "daw"}]
        self.guides = [{"title": "Example", "blurb": "A guide", "path": "guides/example.md"}]
        self.tracks = [{"id": "example", "title": "Example pathway", "steps": [{"label": "Start here", "guide": "guides/example.md"}]}]

    def write(self, name, data):
        path = self.root / "data" / name
        path.write_text(json.dumps(data), encoding="utf-8")
        return path

    def resources_valid(self, data=None):
        with contextlib.redirect_stdout(io.StringIO()):
            validator.validate_resources(self.write("sound-resources.json", self.resources if data is None else data))

    def tracks_valid(self, data=None):
        with contextlib.redirect_stdout(io.StringIO()):
            validator.validate_tracks(self.write("tracks.json", self.tracks if data is None else data), self.root)

    def guides_valid(self, data=None):
        with contextlib.redirect_stdout(io.StringIO()):
            validator.validate_guides(self.write("guides.json", self.guides if data is None else data), self.root)

    def test_minimal_legacy_records_are_valid(self):
        self.resources_valid()
        self.tracks_valid()
        self.guides_valid()

    def test_supported_optional_resource_metadata(self):
        self.resources[0].update(cost="unknown", platform=["web"], tags=[], description="An editor.",
                                 license_notes="Read the source terms.", pricing_notes="Check current pricing.",
                                 source_url="https://example.com/pricing", reviewed="2024-02-29", id="example-tool")
        self.resources_valid()

    def test_valid_month_date(self):
        self.resources[0]["reviewed"] = "2026-01"
        self.resources_valid()

    def test_empty_or_wrong_root(self):
        for bad in ([], {}, None, "not an array"):
            with self.subTest(bad=bad), self.assertRaises(validator.CatalogError):
                path = self.write("bad.json", bad)
                validator.json_array(path)

    def test_entry_objects_required(self):
        for method in (self.resources_valid, self.tracks_valid, self.guides_valid):
            with self.subTest(method=method.__name__), self.assertRaises(validator.CatalogError):
                method(["wrong"])

    def test_required_fields_have_string_types(self):
        for key in ("name", "url", "category"):
            for value in (None, {}, [], 0, True, "", "  "):
                data = copy.deepcopy(self.resources)
                data[0][key] = value
                with self.subTest(key=key, value=value), self.assertRaises(validator.CatalogError):
                    self.resources_valid(data)

    def test_missing_required_fields(self):
        for key in ("name", "url", "category"):
            data = copy.deepcopy(self.resources)
            del data[0][key]
            with self.subTest(key=key), self.assertRaises(validator.CatalogError):
                self.resources_valid(data)

    def test_invalid_urls(self):
        for url in ("http://example.com", "javascript:alert(1)", "https:///x", "https://user:pass@example.com", "https://example.com:bad", "https://example.com:99999", "https://exa mple.com", "https://example.com/\npath", "https://example.com\\path", "https://bad_host.com"):
            with self.subTest(url=url), self.assertRaises(validator.CatalogError):
                validator.https_url(url, "test")

    def test_duplicate_url_normalization(self):
        pairs = [
            ("https://example.com/tool", "https://EXAMPLE.com:443/tool/#section"),
            ("https://example.com/tool?a=1&b=2", "https://example.com/tool?b=2&a=1"),
            ("https://example.com/~user", "https://example.com/%7euser/"),
        ]
        for first, second in pairs:
            data = [dict(self.resources[0], url=first), dict(self.resources[0], name="Another Tool", url=second)]
            with self.subTest(second=second), self.assertRaisesRegex(validator.CatalogError, "duplicate URL"):
                self.resources_valid(data)

    def test_path_case_remains_distinct(self):
        self.resources_valid(self.resources + [dict(self.resources[0], name="Other Tool", url="https://example.com/Tool")])

    def test_normalized_duplicate_names(self):
        for name in ("example tool", "EXAMPLE  TOOL", "Ｅxample Tool"):
            with self.subTest(name=name), self.assertRaisesRegex(validator.CatalogError, "duplicate name"):
                self.resources_valid(self.resources + [dict(self.resources[0], name=name, url="https://other.example.com")])

    def test_invalid_optional_metadata_types(self):
        for key in ("description", "license_notes", "pricing_notes", "source_url", "reviewed", "id", "cost"):
            for value in ([], {}, 2, None, ""):
                with self.subTest(key=key, value=value), self.assertRaises(validator.CatalogError):
                    self.resources_valid([dict(self.resources[0], **{key: value})])

    def test_invalid_optional_arrays(self):
        for key in ("platform", "tags"):
            for value in ("web", None, [None], [[]], [""], ["web", "WEB"]):
                with self.subTest(key=key, value=value), self.assertRaises(validator.CatalogError):
                    self.resources_valid([dict(self.resources[0], **{key: value})])

    def test_invalid_enums(self):
        for key, value in (("category", "invalid"), ("cost", "cheap"), ("platform", ["console"])):
            with self.subTest(key=key), self.assertRaises(validator.CatalogError):
                self.resources_valid([dict(self.resources[0], **{key: value})])

    def test_impossible_review_dates(self):
        for reviewed in ("2026-13", "2026-00", "2026-02-29", "0000-01", "2026-1", "2026-01-32", "yesterday"):
            with self.subTest(reviewed=reviewed), self.assertRaises(validator.CatalogError):
                self.resources_valid([dict(self.resources[0], reviewed=reviewed)])

    def test_invalid_local_references(self):
        for reference in ("guides/missing.md", "../outside.md", "/guides/example.md", "guides\\example.md", "guides/example.md#part", "https://example.com/guide.md", "guides/%65xample.md"):
            with self.subTest(reference=reference), self.assertRaises(validator.CatalogError):
                validator.local_reference(reference, self.root, "test")

    def test_duplicate_track_ids(self):
        with self.assertRaisesRegex(validator.CatalogError, "duplicate track id"):
            self.tracks_valid(self.tracks + [dict(self.tracks[0], title="Other pathway")])

    def test_duplicate_resource_ids(self):
        data = [dict(self.resources[0], id="same"), dict(self.resources[0], id="same", name="Other", url="https://other.example.com")]
        with self.assertRaisesRegex(validator.CatalogError, "duplicate id"):
            self.resources_valid(data)

    def test_step_shapes_and_category_values(self):
        for steps in (None, [], {}, [None], [{"label": 12}], [{"label": "Start", "guide": "guides/example.md", "categories": ["invalid"]}]):
            with self.subTest(steps=steps), self.assertRaises(validator.CatalogError):
                self.tracks_valid([dict(self.tracks[0], steps=steps)])

    def test_duplicate_steps(self):
        with self.assertRaisesRegex(validator.CatalogError, "duplicate step label"):
            self.tracks_valid([dict(self.tracks[0], steps=self.tracks[0]["steps"] * 2)])

    def test_guide_refs_and_duplicates(self):
        for data in ([dict(self.guides[0], path="guides/missing.md")], self.guides * 2):
            with self.subTest(data=data), self.assertRaises(validator.CatalogError):
                self.guides_valid(data)

    def test_malformed_json_cli_fails_cleanly(self):
        path = self.write("sound-resources.json", self.resources)
        path.write_text("[{broken", encoding="utf-8")
        self.write("tracks.json", self.tracks)
        self.write("guides.json", self.guides)
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.root)], text=True, capture_output=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("cannot read JSON", result.stderr)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
