#!/usr/bin/env python3
"""
matrix3d.py — run kit games under several settings profiles and group what breaks.

The sweep (sweep3d.py) checks each game at its default settings. Many bugs only
show elsewhere: AO or other Advanced extras on ultra, the low tier, MSAA on one
backend, or a quality change while the game runs (kit.onQuality handlers). This
runs those paths in Linux Chromium only (WebGPU on SwiftShader), so it needs no
Windows browser or GPU and costs no model tokens. It does not measure speed.

  python3 scripts/matrix3d.py run [games...] [--profiles a,b] [--jobs 3] [--out DIR] [--force]
  python3 scripts/matrix3d.py triage [--out DIR]

Profiles (default: all):
  gpu-ultra-adv   WebGPU, ultra, Advanced on (MSAA, AO and the other opt-in extras)
  gpu-low         WebGPU, low
  gl-ultra-adv    WebGL2, ultra, Advanced on
  gl-low          WebGL2, low
  gpu-switch      WebGPU, starts on high, then low, then ultra + Advanced while playing

Default DIR: ~/dev/ai-hub-migration/matrix
"""
import argparse, json, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check3d import START_JS, IGNORABLE, start_server, game_url  # noqa: E402
from sweep3d import signature, stem_of, kit_games  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
DEFAULT_OUT = Path.home() / 'dev/ai-hub-migration/matrix'
GPU_ARGS = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
            '--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
PROFILES = {
    'gpu-ultra-adv': {'args': GPU_ARGS, 'query': 'kit-backend=webgpu&kit-quality=ultra&kit-advanced=1'},
    'gpu-low': {'args': GPU_ARGS, 'query': 'kit-backend=webgpu&kit-quality=low'},
    'gl-ultra-adv': {'args': GL_ARGS, 'query': 'kit-backend=webgl2&kit-quality=ultra&kit-advanced=1'},
    'gl-low': {'args': GL_ARGS, 'query': 'kit-backend=webgl2&kit-quality=low'},
    'gpu-switch': {'args': GPU_ARGS, 'query': 'kit-backend=webgpu&kit-quality=high',
                   'switch': [{'quality': 'low'}, {'quality': 'ultra', 'advanced': True}]},
}
NOISE = r'GL Driver|swiftshader|GroupMarker|Automatic fallback|ReadPixels'


def run_one(entry, profile, port, out):
    """One game under one profile, in its own browser. Writes out/<profile>.json."""
    from playwright.sync_api import sync_playwright
    prof = PROFILES[profile]
    res = {'game': entry, 'profile': profile, 'console': [], 'pageErrors': []}
    path = game_url(entry)
    url = f'http://127.0.0.1:{port}{path}{"&" if "?" in path else "?"}{prof["query"]}'
    t0 = time.time()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=prof['args'])
        page = browser.new_page(viewport={'width': 960, 'height': 540})
        page.on('console', lambda m: res['console'].append(m.text[:300]) if m.type == 'error' else None)
        page.on('pageerror', lambda e: res['pageErrors'].append(str(e)[:300]))
        try:
            page.goto(url, wait_until='load', timeout=60000)
            for _ in range(45):
                if page.evaluate('!!(window.__kit && window.__kit.ready)'):
                    break
                time.sleep(1)
            res['started'] = page.evaluate(START_JS)
            page.keyboard.down('w'); time.sleep(2); page.keyboard.up('w')
            for step in prof.get('switch', []):
                page.evaluate(f'window.__kitSettings && window.__kitSettings.set({json.dumps(step)})')
                time.sleep(3)
            time.sleep(3)
            res['kit'] = page.evaluate('window.__kit ? JSON.parse(JSON.stringify(window.__kit)) : null')
            page.screenshot(path=str(out / f'{profile}.png'))
        except Exception as e:
            res['crash'] = str(e)[:300]
        browser.close()
    res['seconds'] = round(time.time() - t0, 1)
    (out / f'{profile}.json').write_text(json.dumps(res, indent=1))
    return res


def problems_of(res):
    import re
    out = [('crash', signature(res['crash']))] if res.get('crash') else []
    kit = res.get('kit')
    if not kit:
        return out or [('no-kit', 'window.__kit never appeared')]
    if (kit.get('frames') or 0) < 3:
        out.append(('no-frames', 'kit loop did not run'))
    for e in (kit.get('errors') or [])[:4]:
        out.append(('kit-error', signature(e.get('message'))))
    for e in (res.get('pageErrors') or [])[:3]:
        out.append(('page-error', signature(e)))
    for e in [c for c in res.get('console', []) if not IGNORABLE.search(c) and not re.search(NOISE, c)][:3]:
        out.append(('console-error', signature(e)))
    return out


def cmd_run(a):
    out = Path(a.out)
    games = a.games or kit_games()
    profiles = a.profiles.split(',') if a.profiles else list(PROFILES)
    srv, port = start_server()
    jobs = []
    for g in games:
        d = out / stem_of(g)
        d.mkdir(parents=True, exist_ok=True)
        for p in profiles:
            if a.force or not (d / f'{p}.json').exists():
                jobs.append((g, p, d))
    print(f'{len(jobs)} run(s): {len(games)} game(s) x {len(profiles)} profile(s), {a.jobs} at a time', flush=True)

    def job(j):
        g, p, d = j
        try:
            # A subprocess per run keeps Playwright's sync API to one thread and a hung page contained.
            subprocess.run([sys.executable, __file__, 'one', g, p, str(port), str(d)], cwd=REPO, timeout=240,
                           capture_output=True)
        except subprocess.TimeoutExpired:
            (d / f'{p}.json').write_text(json.dumps({'game': g, 'profile': p, 'crash': 'timed out (240 s)'}))
        return g, p
    done = 0
    with ThreadPoolExecutor(a.jobs) as pool:
        for g, p in pool.map(job, jobs):
            done += 1
            print(f'[{done}/{len(jobs)}] {p:14s} {stem_of(g)[:60]}', flush=True)
    srv.shutdown()
    print('matrix done', flush=True)


def cmd_triage(a):
    out = Path(a.out)
    clusters, broken = {}, {}
    runs = 0
    for f in sorted(out.glob('*/*.json')):
        if f.name == 'triage.json':
            continue
        res = json.loads(f.read_text())
        runs += 1
        stem = f.parent.name
        for kind, detail in problems_of(res):
            key = f'{kind} | {detail}'
            c = clusters.setdefault(key, {'kind': kind, 'detail': detail, 'profiles': set(), 'games': set()})
            c['profiles'].add(res.get('profile'))
            c['games'].add(stem)
            broken.setdefault(stem, set()).add(res.get('profile'))
    serial = sorted(({**c, 'profiles': sorted(c['profiles']), 'games': sorted(c['games'])} for c in clusters.values()),
                    key=lambda c: -len(c['games']))
    (out / 'triage.json').write_text(json.dumps({'runs': runs, 'clusters': serial,
                                                 'broken': {k: sorted(v) for k, v in broken.items()}}, indent=1))
    print(f'{runs} run(s); {len(broken)} game(s) with problems\n')
    for c in serial[: a.top]:
        print(f"  {len(c['games']):3d}  {','.join(c['profiles']):40s} {c['kind']}: {c['detail'][:100]}")
        if len(c['games']) <= 3:
            print('         ' + ', '.join(g[:50] for g in c['games']))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'one':
        _, _, entry, profile, port, out = sys.argv
        run_one(entry, profile, int(port), Path(out))
        return
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('run')
    r.add_argument('games', nargs='*')
    r.add_argument('--profiles', default='')
    r.add_argument('--jobs', type=int, default=3)
    r.add_argument('--out', default=str(DEFAULT_OUT))
    r.add_argument('--force', action='store_true')
    t = sub.add_parser('triage')
    t.add_argument('--out', default=str(DEFAULT_OUT))
    t.add_argument('--top', type=int, default=30)
    a = ap.parse_args()
    cmd_run(a) if a.cmd == 'run' else cmd_triage(a)


if __name__ == '__main__':
    main()
