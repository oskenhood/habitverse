#!/usr/bin/env python3
"""Сборка автономного single-file демо из demo/{index.html,styles.css,app.js}.

Запуск:  python3 tools/build-demo.py   (из корня habitverse/)
"""
import os
import sys

import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
parser = argparse.ArgumentParser(description='Сборка автономного single-file демо')
parser.add_argument('--src', default='demo', help='папка-источник (demo или v2)')
parser.add_argument('--out', default=None, help='имя выходного файла')
ARGS = parser.parse_args()

DEMO = os.path.join(ROOT, ARGS.src)
OUT = os.path.join(ROOT, ARGS.out or ('HabitVerse-2.0.html' if ARGS.src == 'v2' else 'HabitVerse-demo.html'))


def read(name):
    with open(os.path.join(DEMO, name), encoding='utf-8') as f:
        return f.read()


def main():
    html, css, js = read('index.html'), read('styles.css'), read('app.js')

    for bad, where in (('</script>', 'app.js'), ('</style>', 'styles.css')):
        if bad in (js if bad == '</script>' else css):
            sys.exit(f'ОШИБКА: {where} содержит {bad} — inline-сборка сломается')

    before = html
    html = html.replace(
        '<link rel="manifest" href="manifest.webmanifest">',
        '<!-- manifest: см. demo/manifest.webmanifest (нужен хостинг, не file://) -->',
    )
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    html = html.replace('<script src="app.js"></script>', '<script>\n' + js + '\n</script>')

    if html == before:
        sys.exit('ОШИБКА: ни одна замена не сработала — проверьте разметку demo/index.html')
    if '<script src=' in html or 'href="styles.css"' in html:
        sys.exit('ОШИБКА: остались внешние ссылки — файл не будет автономным')

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'✓ собран {os.path.relpath(OUT, ROOT)} — {os.path.getsize(OUT) / 1024:.1f} КБ')


if __name__ == '__main__':
    main()
