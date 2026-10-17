# Development and verification

The application remains a static Jekyll site. Source pages live in `docs/`, canonical content in `guides/` and `resources/`, and canonical data in `data/`. There are no client framework or production npm dependencies. Browser scripts use native ES modules and Web Audio.

## Local development

Use Python 3.10+, Node 20+ (checks only), and Ruby with Bundler. Windows Ruby installations need the RubyInstaller Devkit for the normal dependency installation. The Gemfile targets Jekyll 3.10, matching the current Pages build generation used by this repository.

```sh
python scripts/validate-catalog.py
python scripts/test-validator.py
npm test
python scripts/sync-pages-site.py
bundle install
bundle exec jekyll build --source docs --destination _site
python scripts/check-built-site.py _site
bundle exec jekyll serve --source docs --port 4000
```

Open `http://127.0.0.1:4000/never-your-sounds/`. Do not preview source HTML directly: Liquid must be rendered, and catalogue JSON must be staged. Re-run the staging script after editing data or Markdown. `bash scripts/sync-pages-site.sh` remains an equivalent entry point.

## Browser regression checks

The npm dependency is for development tests only and is never shipped to visitors.

```sh
npm install
npx playwright install chromium
BASE_URL=http://127.0.0.1:4000/never-your-sounds/ npm run test:browser
```

PowerShell equivalent: set `$env:BASE_URL = 'http://127.0.0.1:4000/never-your-sounds/'` before `npm run test:browser`. Set `BROWSER_CHANNEL=msedge` to use an installed Edge, or `PLAYWRIGHT_MODULE` to an existing Playwright package path. Screenshots go to ignored `test-results/` (override with `TEST_OUTPUT`).

The suite checks home-to-catalogue search, combined filters/sorting/URL restoration, keyboard details, empty/error/retry states, safe untrusted text, learning persistence/reset/opt-out, blocked/corrupt storage, tap tempo, metronome scheduling against the real Web Audio API, calculator input, scale spelling, checklist persistence/printing, mobile layout/menu, and no-JavaScript fallbacks. Scheduled audio is inspected programmatically; this does not establish perceived loudness, physical audio-device output, or precise hardware latency.

## Build and base-path checks

`check-built-site.py` checks rendered HTML landmarks, IDs, local links, fragments, asset existence, and the project base path. It makes no network requests. To verify a deployment at a domain root:

```sh
bundle exec jekyll build --source docs --destination _site-root --baseurl ""
python scripts/check-built-site.py _site-root --baseurl ""
```

Do not change the committed project base path for a local preview. `docs/site/` is a generated mirror; the staging script only replaces that bounded directory. Never edit it as the source of truth.

## GitHub Pages deployment

Keep repository **Settings → Pages → Build and deployment → Source = GitHub Actions**. `.github/workflows/pages.yml` preserves the established pipeline: stage content, build `docs/` with `actions/jekyll-build-pages`, validate generated links, upload `_site`, deploy. A push to `main` or a manual workflow dispatch triggers it. This is an Actions deployment, not branch-based `/docs` publishing.

No backend, environment secrets, API keys, or paid services are needed. For a fork or renamed repository, update `url` and `baseurl` in `docs/_config.yml`, social metadata and the explicit repository/sister links as appropriate. Keep the original guide paths or add redirects if paths change.

## Data, privacy, and limitations

- `data/` remains authoritative; see [SCHEMA.md](SCHEMA.md). Retain original records and historical review metadata unless there is a supported correction.
- Learning uses opt-in `nys-learning-v1`. Creator checklists use `nys.creator.checklists.v1` and save when changed. Storage failures leave the current session usable. There is no cloud synchronization.
- The metronome is foreground only. It closes its audio context when stopped, hidden, interrupted, or navigated away from. Browser timing and audio permissions vary.
- Loudness/export content is educational. There is no LUFS measurement, audio-file processing, mastering, DAW, or audio generation.
- Vendor links are not monitored for live uptime; labels and descriptions are not guarantees of current pricing or permissions. Network checks are not required for local development.
- Fonts, styles, images, and scripts are served locally. Normal HTTP/browser caching applies; there is no service worker or promise of offline access.
