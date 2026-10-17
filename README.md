# Never Your Sounds

**Your entire audio world. One place.** Discover audio resources, use practical browser tools, and follow a learning path from a first idea to a finished project.

**Find your sound. Build your craft. Ship with confidence.**

[Open the platform](https://jay-lokhande.github.io/never-your-sounds/) · [Discover](https://jay-lokhande.github.io/never-your-sounds/browse.html) · [Create](https://jay-lokhande.github.io/never-your-sounds/create.html) · [Learn](https://jay-lokhande.github.io/never-your-sounds/learn.html) · [Trust & licensing](https://jay-lokhande.github.io/never-your-sounds/trust.html)

## What works in the browser

- **Discover:** all 60 catalogue records, text search across metadata, combined category/cost/platform filters, five sort modes, shareable query URLs, and resource details with cost and license caveats. Invalid records are safely omitted; empty or failed loads offer a retry.
- **[My Studio](https://jay-lokhande.github.io/never-your-sounds/studio.html):** save resources to named collections, keep project and resource notes, and export/import portable JSON backups. Imports preserve existing collections and notes. Saving uses this browser, with recovery exports if storage is unavailable.
- **[Compare tools](https://jay-lokhande.github.io/never-your-sounds/compare.html):** choose up to three resources from Discover or My Studio and compare their recorded purpose, platforms, cost model, limitations, and sources. Missing information stays explicitly unrecorded.
- **Create:** tap tempo, a Web Audio metronome with accents and time signatures, bars/beats/seconds conversion, six scales with correct note spelling, production vocabulary, signal flow, and loudness/export references. The metronome starts on a button press and stops when the page is hidden.
- **Prepare a release:** browser-local licensing and release checklists with project names, progress, reset, and print layouts. These are personal checklists, not legal clearance or audio measurement.
- **Learn:** eight self-guided pathways for a first beat, production/mixing, recording artists, responsible sampling, games, podcasts/streams, video/dialogue, and release. Guide links remain available without JavaScript. Progress is saved only when the visitor opts in.

There is no account, backend, API key, analytics, microphone access, or audio upload. Personal storage stays in the current browser; it does not automatically sync across devices. My Studio backups can be exported and imported manually. Read [development and verification instructions](DEVELOPMENT.md), the [data schema](SCHEMA.md), and the [implementation report](IMPLEMENTATION.md).

> **Disclaimer:** Student pricing and license terms change on vendor sites only.

> **Scams:** Fake DAW “full versions” and stolen sample packs → [resources/audio-scams.md](resources/audio-scams.md)

You can [navigate](NAVIGATION.md), use **[Start here](resources/start-here.md)**, find [Hub](https://jay-lokhande.github.io/student-dev-catalogs/) (all dev catalogs), and browse [Sister repos](resources/sister-repos.md).

**Pages:** [student-dev-catalogs](https://jay-lokhande.github.io/student-dev-catalogs/) · [oss-programs-and-hackathons](https://jay-lokhande.github.io/oss-programs-and-hackathons/) · [build-grants](https://jay-lokhande.github.io/build-grants/) · [hack-safe](https://jay-lokhande.github.io/hack-safe/) · [ai-catalog](https://jay-lokhande.github.io/ai-catalog/) · [coding-platforms](https://jay-lokhande.github.io/coding-platforms/) · [public-apis](https://jay-lokhande.github.io/public-apis/) · [design-for-devs](https://jay-lokhande.github.io/design-for-devs/) · [cloud-student](https://jay-lokhande.github.io/cloud-student/) · [maker-student](https://jay-lokhande.github.io/maker-student/) · [game-dev-student](https://jay-lokhande.github.io/game-dev-student/) · [never-your-sounds](https://jay-lokhande.github.io/never-your-sounds/)

---

## What do you need?

```mermaid
flowchart TD
  start([Never Your Sounds — start])
  start --> prod[Produce beats / songs]
  start --> game[Game or interactive audio]
  start --> pod[Podcast or YouTube audio]
  start --> stream[Live stream / Discord audio]
  start --> theory[Notation and theory]
  start --> ai[AI voice / music / transcription]
  start --> release[Release on Bandcamp / streaming]
  start --> film[Film or YouTube mix]
  start --> safe[Deals that look too good]

  prod --> g1[guides/production.md]
  game --> g2[guides/game-audio.md]
  pod --> g3[guides/podcast-and-streaming.md]
  stream --> g3
  theory --> g4[guides/learn-and-theory.md]
  ai --> g5[guides/ai-audio.md]
  release --> g6[guides/release-and-distribution.md]
  film --> g7[guides/film-and-video.md]
  safe --> scam[resources/audio-scams.md]
  scam --> g1
```

**Plain text:** unsure → [Start here](resources/start-here.md) · suspicious download → [audio-scams](resources/audio-scams.md) · sample license questions → [samples & licensing](guides/samples-and-licensing.md)

---

## Topic guides (full tables live here)

| Path | Guide |
| --- | --- |
| DAWs, plugins, MIDI, FFmpeg | [guides/production.md](guides/production.md) |
| Student / edu store pricing | [guides/edu-pricing.md](guides/edu-pricing.md) |
| FMOD, Wwise, engine docs | [guides/game-audio.md](guides/game-audio.md) |
| OBS, podcast hosts, Riverside | [guides/podcast-and-streaming.md](guides/podcast-and-streaming.md) |
| CC samples, SFX, attribution | [guides/samples-and-licensing.md](guides/samples-and-licensing.md) |
| Theory, MOOCs, vendor learn portals | [guides/learn-and-theory.md](guides/learn-and-theory.md) |
| Film, YouTube, dialog & LUFS | [guides/film-and-video.md](guides/film-and-video.md) |
| Captions & accessible media | [guides/accessibility.md](guides/accessibility.md) |
| AI TTS / music (bridge to ai-catalog) | [guides/ai-audio.md](guides/ai-audio.md) |
| Before you ship (checklist) | [resources/license-checklist.md](resources/license-checklist.md) |
| Interfaces, mics (official brands) | [guides/hardware.md](guides/hardware.md) |
| Bandcamp, distributors | [guides/release-and-distribution.md](guides/release-and-distribution.md) |
| Programs, jams, scholarships | [guides/programs-and-community.md](guides/programs-and-community.md) |

---

## Quick picks by workflow

| Goal | Start with |
| --- | --- |
| First recording / edit | [BandLab](https://www.bandlab.com/) or [Audacity](https://www.audacityteam.org/) |
| Free beats (FOSS) | [LMMS](https://lmms.io/) |
| Game jam SFX | [Freesound](https://freesound.org/) + [Sonniss GDC packs](https://sonniss.com/gameaudiogdc) (read license) |
| Stream game + mic mix | [OBS](https://obsproject.com/) + [Voicemeeter](https://vb-audio.com/Voicemeeter/) (Windows) or [BlackHole](https://existential.audio/blackhole/) (macOS) |
| Notation | [MuseScore](https://musescore.org/) |

---

## Machine-readable index

| File | Use |
| --- | --- |
| [data/sound-resources.json](data/sound-resources.json) | All tools by `category` |
| [data/tracks.json](data/tracks.json) | Recommended path steps per goal |
| [data/guides.json](data/guides.json) | Preserved topic-guide navigation |
| [SCHEMA.md](SCHEMA.md) | Compatible data contracts and metadata rules |

---

## Outside this repo (on purpose)

| Need | Where |
| --- | --- |
| Full AI product list | [ai-catalog](https://github.com/Jay-Lokhande/ai-catalog) |
| Game engines & itch jams | [game-dev-student](https://github.com/Jay-Lokhande/game-dev-student) |
| MOOCs & interview prep | [coding-platforms](https://github.com/Jay-Lokhande/coding-platforms) |
| Captions & accessible media | [design-for-devs](https://github.com/Jay-Lokhande/design-for-devs) |
| Paid OSS summers / hackathons | [oss-programs-and-hackathons](https://github.com/Jay-Lokhande/oss-programs-and-hackathons) |

[CONTRIBUTING.md](CONTRIBUTING.md) · [LICENSE](LICENSE)
