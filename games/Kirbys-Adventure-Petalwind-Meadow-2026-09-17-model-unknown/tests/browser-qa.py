from pathlib import Path
from playwright.sync_api import sync_playwright
import re, json, sys

ROOT = Path(__file__).resolve().parents[1]


def make_html(route: str) -> str:
    html = (ROOT / 'index.html').read_text()
    css = (ROOT / 'src/style.css').read_text()
    html = re.sub(r'<link rel="stylesheet"[^>]+>', f'<style>{css}</style>', html)
    html = re.sub(r'<script type="importmap">.*?</script>\s*', '', html, flags=re.S)
    html = re.sub(r'<script type="module" src="\.\/src\/main\.js"></script>', '', html)

    bal = (ROOT / 'src/balance.js').read_text().replace('export const BALANCE', 'const BALANCE').replace('export function levelForXP', 'function levelForXP').replace('export function damageForLevel', 'function damageForLevel')
    game = (ROOT / 'src/game.js').read_text()
    game = re.sub(r"import \{ BALANCE, levelForXP, damageForLevel \} from './balance.js';\s*", '', game)
    game = game.replace('export function startGame', 'function startGame')
    stub = (ROOT / 'src/headless-three.js').read_text().replace('export const THREE', 'const THREE').replace('export class HeadlessRenderer', 'class HeadlessRenderer')
    head = (ROOT / 'src/headless.js').read_text()
    head = re.sub(r"import \{ THREE, HeadlessRenderer \} from './headless-three.js';\s*", '', head)
    head = re.sub(r"import \{ startGame \} from './game.js';\s*", '', head)
    head = head.replace('export async function bootHeadless', 'async function bootHeadless')
    head = head.replace("const params = new URLSearchParams(location.search);\n  if (params.get('autotest') === '1') {\n    const route = params.get('route') === 'upper' ? 'upper' : 'lower';\n    await runAutotest(route);\n  }", "await runAutotest(window.__QA_ROUTE__ || 'lower');")

    script = '\n'.join([bal, stub, game, head, 'bootHeadless();'])
    return html.replace('</body>', f'<script>window.__QA_ROUTE__={json.dumps(route)};</script><script type="module">{script}</script></body>')


def main() -> int:
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-gpu'])
        for route in ('upper', 'lower'):
            page = browser.new_page(viewport={'width': 1280, 'height': 720})
            errors = []
            page.on('console', lambda m, errors=errors: errors.append(f'console {m.type}: {m.text}') if m.type == 'error' else None)
            page.on('pageerror', lambda e, errors=errors: errors.append(f'pageerror: {e}'))
            page.set_content(make_html(route), wait_until='domcontentloaded', timeout=10000)
            page.wait_for_selector('#test-output', timeout=15000)
            result = json.loads(page.locator('#test-output').inner_text())
            result['errors'] = errors
            results.append(result)
            page.screenshot(path=str(ROOT / f'qa-{route}.png'), full_page=True)
            page.close()
        browser.close()

    print(json.dumps(results, indent=2))
    return 0 if all(r['pass'] and not r['errors'] for r in results) else 1


if __name__ == '__main__':
    sys.exit(main())
