# Contributing

Sound Student is a **one-stop hub**: overview in [README.md](README.md), detailed tables in [guides/](guides/), paths in [resources/start-here.md](resources/start-here.md).

When adding a tool:

1. Add a row to the right **guide** under `guides/`.
2. Add an entry to [data/sound-resources.json](data/sound-resources.json).
3. If it fits a path, consider updating [data/tracks.json](data/tracks.json).

Rules:

- Official URLs only; no piracy, cracks, or warez
- Categories: `daw`, `edu`, `notation`, `samples`, `plugin`, `utility`, `game-audio`, `podcast`, `hardware`, `distribution`, `learn`
- Full AI product rows stay in [ai-catalog](https://github.com/Jay-Lokhande/ai-catalog); link from [guides/ai-audio.md](guides/ai-audio.md) only

Run `./scripts/sync-pages-site.sh` before pushing if you want to preview the Pages mirror locally under `docs/site/`.
