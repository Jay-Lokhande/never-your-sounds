# Catalogue data contracts

The source of truth is `data/`. Run `python scripts/validate-catalog.py` before publishing. Validation is local and does not claim that vendor pages are reachable or their current terms verified. `scripts/sync-pages-site.sh` copies public JSON to `docs/site/data/` and Jekyll data to `docs/_data/`; edit the source, then sync.

The three catalogue files below contain non-empty JSON arrays of objects. Text fields must be non-empty strings without surrounding whitespace. Unknown fields are tolerated for forward compatibility. Duplicate names and titles are compared after Unicode normalization, case folding and whitespace normalization. The Hip-Hop Hub uses a separate versioned object described below.

## `hiphop.json` and the hip-hop notebook

Canonical editorial content is a version-1 object with `sections`, `sources`, `history`, `elements`, `styles`, `scenes`, `albums`, `lessons`, `dictionary`, and `songs`. The staging script copies it into `docs/_data/hiphop.json` for Jekyll and `docs/site/data/hiphop.json` for public access. Edit only the canonical file and then sync.

Entries use stable lowercase hyphenated `id` values, titles, original descriptions, and topic-specific fields. Source IDs resolve through the `sources` object to descriptive titles and HTTPS links. Style/scene album references and lesson term references must resolve. Album questions and lesson exercises are original educational prompts, not transcribed lyrics. Style labels are editorial lenses, and city entries do not claim national representation. Retain nearby source links when updating historical or release metadata. `scripts/test-hiphop.mjs` checks these references and the notebook's supported IDs as part of `npm test`.

Style entries include a navigation `group`, descriptive `kind`, `origin`, three listening `cues`, example `artists`, search `aliases`, an original `exercise`, and two or more unique `related` style IDs. `kind` is one of `Era`, `Style / subgenre`, `Regional umbrella`, `Lyrical approach`, `Production approach`, `Technique`, or `Crossover / neighbour`. Families are browsing aids, not exclusive ancestry claims. Preserve the original ten style IDs when extending the directory.

Each style's `listening` object has `title`, `artist`, `source`, `format`, and an original `prompt`. Its source must resolve to an HTTPS source record. Label a contextual article or producer breakdown accurately instead of presenting it as a playable track. `sources` lists historical or explanatory references; an optional `album` ID connects to a full guided-listening entry. All related IDs must exist and differ from the current entry. Style search combines text, family (`group`) and entry type (`kind`) in shareable URL parameters; anchors reveal and expand their entry even if filters would hide it.

Song entries have stable `id`, `title`, `artist`, release `year`, original `album`, `group` (artist), and `kind` (learning focus). `recording` and `sources` resolve through the source registry. `edition` and `listen_label` identify the linked recording or album route. The `map` is an ordered array of named landmarks with `title` and `body`; it does not claim verified timestamps. `analysis` contains Writing, Flow & delivery, and Production lenses. `diagram` has a title, ordered original teaching steps, and a caption distinguishing an exercise from a transcription. Context, selected credits, mature themes/spoilers, an original exercise, and listening questions accompany each guide. `styles`, `lessons`, and `related` resolve to existing style, lesson, and other song IDs. Historical claims belong with linked sources; editorial interpretations should stay identifiable as readings or listening prompts.

The optional local notebook uses only `nys-hiphop-v1`, with `{version:1, completed:[], draft:{title:'',text:''}, notes:{}}`. `completed` contains unique supported lesson IDs; `notes` maps supported album or song IDs to plain text. The six song IDs are disjoint from the album IDs. This additive extension retains version 1: existing notebooks load unchanged and writes preserve all recognised notes, the draft, and progress across rap, album, and song pages. Bounds are 120 characters for a title, 16,000 for a draft, and 1,500 per listening note. Saved input exceeding 100,000 characters, malformed input, unknown IDs, and unsupported versions are rejected without overwriting the saved value.

There is no device persistence until the visitor opts in. Disabling saving removes this key while retaining current-page edits. Reset requires confirmation and affects only this notebook. Storage failures keep edits in memory and expose a plain-text download; these temporary edits are lost when leaving or reloading. Changes in another tab pause saving and preserve current edits for download; reload reads the latest saved copy. Truly simultaneous writes are not transactional. The text download is a readable personal copy, not an import format or cloud backup.

## `sound-resources.json`

| Field | Required | Contract |
| --- | --- | --- |
| `name` | Yes | Unique display name. |
| `category` | Yes | One category listed below. |
| `url` | Yes | HTTPS URL with a valid host, no embedded credentials, whitespace or backslashes. Use the resource's official source. |
| `id` | No | Unique lowercase identifier such as `open-source-editor`. |
| `cost` | No | `free`, `freemium`, `paid`, `edu`, `varies`, or `unknown`. Missing cost means unknown; it never implies free. |
| `platform` | No | Non-empty array drawn from `web`, `win`, `mac`, `linux`, `ios`, `android`. Missing means not recorded. |
| `tags` | No | Array of non-empty strings; may be empty. |
| `description` | No | Concise factual description. Omit unsupported claims. |
| `license_notes` | No | Known license caveats, with the source identified where useful. Listing a resource does not grant rights. |
| `pricing_notes` | No | Pricing or eligibility caveats; avoid unsupported prices or discounts. |
| `reviewed` | No | Valid calendar month (`YYYY-MM`) or date (`YYYY-MM-DD`) from actual review metadata. Do not update merely because a build ran. |
| `source_url` | No | HTTPS source for descriptive, pricing or licensing metadata. Does not by itself prove a live review. |

Categories: `daw`, `edu`, `notation`, `samples`, `plugin`, `utility`, `game-audio`, `podcast`, `hardware`, `distribution`, `learn`, `community`, `video`, `live`.

Resource URLs must be unique after host casing, default HTTPS port, unreserved percent escapes, trailing slash, fragment and query-order normalization. Path case is preserved because servers may distinguish it. `source_url` may repeat across resources. Platform and tag values may not repeat within one record.

Existing records containing only `name`, `category`, and `url` remain supported. Cost, platform and descriptive fields are optional. The UI should present absent values as unknown or unrecorded rather than inventing metadata. Existing review dates describe recorded reviews, not an assurance of current terms. Always verify the relevant license at its source.

## `guides.json`

| Field | Required | Contract |
| --- | --- | --- |
| `title` | Yes | Unique guide title. |
| `blurb` | Yes | Short description. |
| `path` | Yes | Unique repository-relative path to an existing Markdown file, such as `guides/production.md`. |
| `icon` | No | Existing display symbol retained for compatible consumers. |

## `tracks.json`

| Field | Required | Contract |
| --- | --- | --- |
| `id` | Yes | Unique lowercase hyphenated identifier. Existing IDs are permanent incoming-link anchors. |
| `title` | Yes | Unique pathway title. |
| `description` | No | What the pathway helps the learner practice. |
| `outcome` | No | A concrete project artifact to work toward, not an accredited or guaranteed outcome. |
| `steps` | Yes | Non-empty ordered array of step objects. |

Each step requires `label` (unique within its pathway) and `guide` (an existing local Markdown path). Optional `categories` is an array of category identifiers and may be empty. Optional `action` is a practical instruction shown beside the guide link. Repeating a guide across steps or pathways is allowed. Older `{label, guide}` steps remain valid.

Local references must be repository-relative `.md` paths without traversal, a query, fragment, backslash or percent encoding. The site maps them to `{{ site.baseurl }}/site/<path>.html`. Category explorer links use `{{ site.baseurl }}/browse.html?cat=<category>`.

## Learning progress

See also the independent My Studio backup contract below; learning and checklist data are not included in Studio exports or resets.

`learn.html` renders the complete pathway content through Liquid so guide links remain available without JavaScript. JavaScript adds pathway selection, checkboxes, next actions and progress. The URL fragment selects the pathway; existing IDs `produce`, `game-audio`, `podcast`, `film`, and `release` are preserved.

Progress is temporary until the visitor explicitly enables **Remember my progress on this device**. The `nys-learning-v1` local-storage value is `{ "version": 1, "completed": ["first-beat:0"] }`; the key's presence is the save preference. Step indexes are zero-based. Turning saving off removes that value while retaining checks in the current tab. Reset controls clear either the current pathway or every pathway. There is no account, analytics request or cloud sync.

Unknown saved step keys are ignored. Corrupt data is discarded with a visible message. Storage errors leave the current tab functional and show that progress could not be saved. Do not reorder existing pathway steps without considering a progress-version migration, because stored step indexes would then point to different tasks.

## My Studio collections and comparison

`nys-studio-v1` is the local-storage key. JSON exports use the same versioned shape:

```json
{
  "version": 1,
  "collections": [{
    "id": "a-unique-collection-id",
    "name": "First EP",
    "notes": "Record ideas before mixing.",
    "resources": [{"name": "Audacity", "url": "https://www.audacityteam.org/", "note": "Edit field recordings."}]
  }],
  "compare": [{"name": "Audacity", "url": "https://www.audacityteam.org/"}]
}
```

- Maximum 30 collections, 150 resources per collection, three comparison choices, and 1 MB for the complete formatted export. Names: 80 characters for collections, 200 for resources; notes: 4,000 for collections, 2,000 for resources. IDs: 1–100 letters, digits, underscores or hyphens, unique within the backup. Resource URLs: valid HTTPS, up to 2,048 characters, without credentials, whitespace or backslashes.
- Collection resources and comparison choices deduplicate by the URL canonicalized by the browser URL parser. A resource can belong to multiple collections with different notes. Only name, URL, and personal notes are saved; product details are loaded from the current catalogue. Removed resources retain their saved links and notes and are marked as absent from the catalogue.
- Imports validate the whole file before changing anything. Unsupported versions, unsafe URLs, invalid types, duplicate IDs/URLs, and over-limit values reject the import. Unknown fields are dropped. Text is always rendered with DOM text APIs.
- Import adds collections without replacing existing ones. Identical collection contents are skipped. Conflicting IDs with different content get new IDs. The existing comparison is retained if non-empty; otherwise the backup comparison is restored. Merges exceeding limits are rejected atomically.
- Saving is initiated by user edits. There is no account, upload or automatic cloud sync. Read/corruption failures preserve the original stored value until explicit reset. Write failures retain edits in memory and show an export control on the current page. Reset requires confirmation and affects only this key. Cross-tab storage events refresh views without discarding unsaved note text.
