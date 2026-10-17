# Contributing

Never Your Sounds is a **one-stop hub**: overview in [README.md](README.md), detailed tables in the [guide index](NAVIGATION.md#topic-guides), paths in [resources/start-here.md](resources/start-here.md).

When adding a tool:

1. Add a row to the right **guide** under `guides/`.
2. Add an entry to [data/sound-resources.json](data/sound-resources.json).
3. If it fits a path, consider updating [data/tracks.json](data/tracks.json).

Rules:

- Official URLs only; no piracy, cracks, or warez
- Categories: `daw`, `edu`, `notation`, `samples`, `plugin`, `utility`, `game-audio`, `podcast`, `hardware`, `distribution`, `learn`, `community`, `video`, `live`
- Optional fields: `cost`, `platform`, `tags`, `reviewed`, `description`, `pricing_notes`, `license_notes`, `source_url` (see [SCHEMA.md](SCHEMA.md))
- Run `python3 scripts/validate-catalog.py` before opening a PR
- Full AI product rows stay in [ai-catalog](https://github.com/Jay-Lokhande/ai-catalog); link from [guides/ai-audio.md](guides/ai-audio.md) only

Run `python3 scripts/sync-pages-site.py` (or the existing `./scripts/sync-pages-site.sh` wrapper) before building the Pages mirror. Follow [DEVELOPMENT.md](DEVELOPMENT.md) for local preview and checks. Preserve incoming page URLs, original pathway IDs and step order. Verify factual metadata against an official source; never advance review dates just because you edited a record.
