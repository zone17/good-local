#!/usr/bin/env python3
"""Inline GVC stylesheets, latin fonts, and logo into artifact HTML pages.
Usage: python3 docs/assets/gvc/inline.py <html-file> [<html-file> ...]
Pages are authored with the two <link rel="stylesheet"> tags; this replaces
them with one embedded <style> block and swaps the logo src for a data URI.
Idempotent: skips files with no stylesheet links remaining."""
import base64, re, os, sys

GVC = os.path.dirname(os.path.abspath(__file__))

def build_css():
    css_main = open(f'{GVC}/colors_and_type.css').read()
    blocks = re.split(r'(@font-face\s*\{[^}]*\})', css_main)
    css = ''.join(b for b in blocks if not ('@font-face' in b and 'latin-ext' in b))
    def embed(m):
        b64 = base64.b64encode(open(f'{GVC}/fonts/{m.group(1)}', 'rb').read()).decode()
        return f"url(data:font/woff2;base64,{b64}) format('woff2')"
    css = re.sub(r"url\('fonts/([^']+)'\)\s*format\('woff2'\)", embed, css)
    return css + '\n\n' + open(f'{GVC}/doc-kit.css').read()

def main(paths):
    combined = build_css()
    logo = base64.b64encode(open(f'{GVC}/brand/logo-mark-teal.svg', 'rb').read()).decode()
    for p in paths:
        html = open(p).read()
        if 'rel="stylesheet"' not in html:
            print(f'{p}: already inlined, skipped'); continue
        html = re.sub(r'<link rel="stylesheet" href="[^"]*colors_and_type\.css">\s*\n<link rel="stylesheet" href="[^"]*doc-kit\.css">',
                      lambda m: '<style>\n' + combined + '\n</style>', html, count=1)
        html = re.sub(r'src="(?:\.\./)?assets/gvc/brand/logo-mark-teal\.svg"',
                      f'src="data:image/svg+xml;base64,{logo}"', html)
        open(p, 'w').write(html)
        print(f'{p}: inlined ({os.path.getsize(p)//1024}KB)')

if __name__ == '__main__':
    main(sys.argv[1:])
