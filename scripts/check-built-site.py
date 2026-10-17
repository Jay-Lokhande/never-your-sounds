#!/usr/bin/env python3
"""Check rendered HTML, assets, local links and fragments without network access."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.links, self.ids, self.counts, self.duplicates = [], set(), {}, []
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        self.counts[tag] = self.counts.get(tag, 0) + 1
        attrs = dict(attrs)
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                self.duplicates.append(attrs['id'])
            self.ids.add(attrs['id'])
        for key in ('href', 'src', 'action'):
            if attrs.get(key):
                self.links.append(attrs[key])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--baseurl', default='/never-your-sounds')
    args = parser.parse_args()
    root, base = args.directory.resolve(), args.baseurl.rstrip('/')
    if not root.is_dir() or not (root / 'index.html').is_file():
        raise SystemExit('Expected a built site directory containing index.html')
    pages, errors, count = {}, [], 0
    for path in root.rglob('*.html'):
        source = path.read_text(encoding='utf-8')
        page = pages[path] = Page(source)
        # Code examples in repository documentation may deliberately contain Liquid.
        if path.parent == root and ('{{' in source or '{%' in source):
            errors.append(f'{path.name}: unrendered template')
        for tag in ('title', 'main', 'h1'):
            if page.counts.get(tag) != 1:
                errors.append(f'{path.relative_to(root)}: expected one {tag}, got {page.counts.get(tag, 0)}')
        for identifier in page.duplicates:
            errors.append(f'{path.relative_to(root)}: duplicate ID {identifier}')
    for path, page in pages.items():
        origin = 'https://local.test' + base + '/' + path.relative_to(root).as_posix()
        for link in page.links:
            url = urlsplit(urljoin(origin, link))
            if url.netloc != 'local.test' or url.scheme not in ('http', 'https'):
                continue
            if not url.path.startswith(base + '/'):
                errors.append(f'{path.relative_to(root)}: link escapes base path: {link}')
                continue
            target = (root / unquote(url.path[len(base) + 1:])).resolve()
            if not target.is_relative_to(root):
                errors.append(f'{path.name}: link escapes output: {link}')
                continue
            if target.is_dir():
                target /= 'index.html'
            count += 1
            if not target.is_file():
                errors.append(f'{path.relative_to(root)}: missing {link}')
            elif url.fragment and target.suffix == '.html' and target in pages and unquote(url.fragment) not in pages[target].ids:
                errors.append(f'{path.relative_to(root)}: missing fragment {link}')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'Built-site checks passed: {len(pages)} HTML pages, {count} local links/assets at {base or "/"}.')

if __name__ == '__main__':
    main()
