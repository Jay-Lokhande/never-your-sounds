# Maintainers

## Adding a tool

1. Add a row to the correct file under `guides/`.  
2. Add an object to `data/sound-resources.json` with `name`, `category`, `url` (HTTPS), and when known: `cost`, `platform`, `tags`.  
3. For **edu** rows, set `"reviewed": "YYYY-MM"` when you verify the store page.  
4. Run `python3 scripts/validate-catalog.py`.  
5. Open a PR; CI runs the same validator.

## Allowed JSON fields

| Field | Required | Values |
| --- | --- | --- |
| `name` | yes | unique string |
| `category` | yes | see `scripts/validate-catalog.py` |
| `url` | yes | `https://` official vendor only |
| `cost` | no | `free`, `freemium`, `paid`, `edu`, `varies` |
| `platform` | no | `web`, `win`, `mac`, `linux`, `ios`, `android` |
| `tags` | no | string array |
| `reviewed` | no | `YYYY-MM` for edu pricing |

## Link hygiene

- Prefer manufacturer root or product path — not affiliate or download mirrors.  
- Remove entries when the vendor retires a product; do not link to Internet Archive as primary.  
- AI products: prefer linking from [guides/ai-audio.md](guides/ai-audio.md) and [ai-catalog](https://github.com/Jay-Lokhande/ai-catalog).

## GitHub Pages

Push to `main` runs `scripts/sync-pages-site.sh` then Jekyll on `docs/`. Edit themed files under `docs/_layouts`, `docs/assets`, etc.
