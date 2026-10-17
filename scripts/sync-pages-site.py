#!/usr/bin/env python3
"""Stage the existing Markdown and JSON for Jekyll, on any OS."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'docs' / 'site'

def main():
    # Only this generated mirror may be replaced. Reject symlinked destinations.
    if SITE.is_symlink() or SITE.resolve() != ROOT / 'docs' / 'site':
        raise SystemExit('Refusing to replace an unexpected staging path')
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir(parents=True)
    for name in ('README.md', 'NAVIGATION.md', 'CONTRIBUTING.md', 'MAINTAINERS.md', 'SCHEMA.md', 'DEVELOPMENT.md', 'IMPLEMENTATION.md', 'LICENSE'):
        source = ROOT / name
        if source.exists():
            shutil.copy2(source, SITE / name)
    for folder, pattern in (('resources', '*.md'), ('guides', '*.md'), ('data', '*.json')):
        destination = SITE / folder
        destination.mkdir()
        for source in (ROOT / folder).glob(pattern):
            shutil.copy2(source, destination / source.name)
    # Explicit front matter makes every guide render locally and on Pages,
    # independent of implicit github-pages plugin defaults.
    for path in SITE.rglob('*.md'):
        content = path.read_text(encoding='utf-8')
        if not content.startswith('---\n'):
            title = next((line[2:].strip() for line in content.splitlines() if line.startswith('# ')), path.stem)
            path.write_text('---\nlayout: page\ntitle: ' + json.dumps(title, ensure_ascii=False) + '\n---\n' + content, encoding='utf-8')
    (ROOT / 'docs' / '_data').mkdir(exist_ok=True)
    for name in ('tracks.json', 'guides.json'):
        shutil.copy2(ROOT / 'data' / name, ROOT / 'docs' / '_data' / name)
    print(f'Synced {sum(p.is_file() for p in SITE.rglob("*"))} site files (+ docs/_data)')

if __name__ == '__main__':
    main()
