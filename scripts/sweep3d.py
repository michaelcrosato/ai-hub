#!/usr/bin/env python3
"""
sweep3d.py — run scripts/check3d.py over many games and group what breaks.

  python3 scripts/sweep3d.py run [games...] [--jobs 4] [--out DIR] [--force]
      Every game that loads the kit (or the given games), 4 at a time: boot, press the
      game's start button, play W and Space, read errors, pipelines and fps. Resumable:
      a game with a report in DIR is skipped unless --force. Costs no model
      tokens: headless browsers do the work.
  python3 scripts/sweep3d.py triage [--out DIR]
      Sort every report into ok / broken, group the problems by a normalised
      signature (so one kit bug shows up as one line with many games).
      Writes DIR/triage.json and prints a compact summary.

Default DIR: /tmp/ai-hub-qa/sweep (results are disposable; never inside the repo).
"""
import argparse, json, re, subprocess, time
from check3d import PIPELINE_CHURN
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_OUT = Path('/tmp/ai-hub-qa/sweep')


def stem_of(entry):
    p = Path(entry)
    return p.name[:-5] if p.suffix == '.html' and p.name != 'index.html' else (p.parent.name if p.name == 'index.html' else p.name)


def kit_games():
    r = subprocess.run(['node', 'scripts/audit3d.mjs', '--json'], cwd=REPO, capture_output=True, text=True)
    return [g['game'] for g in json.loads(r.stdout)['report']]


def run_one(entry, out, force):
    stem = stem_of(entry)
    d = out / stem
    rep = d / 'report.json'
    if rep.exists() and not force:
        return stem, 'cached'
    d.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    try:
        subprocess.run(['python3', 'scripts/check3d.py', entry, '--out', str(d), '--start', '--keys', 'KeyW,Space', '--wait', '14'],
                       cwd=REPO, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        rep.write_text(json.dumps({'game': entry, 'ok': False, 'problems': ['sweep: check3d timed out (300 s)']}))
    if not rep.exists():
        rep.write_text(json.dumps({'game': entry, 'ok': False, 'problems': ['sweep: check3d wrote no report']}))
    return stem, f'{time.time() - t0:.0f}s'


def cmd_run(a):
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    games = a.games or kit_games()
    print(f'sweeping {len(games)} game(s) into {out}, {a.jobs} at a time', flush=True)
    done = 0
    with ThreadPoolExecutor(a.jobs) as pool:
        for stem, how in pool.map(lambda g: run_one(g, out, a.force), games):
            done += 1
            if how != 'cached':
                print(f'[{done}/{len(games)}] {stem[:70]} {how}', flush=True)
    print('sweep done', flush=True)


# Numbers, quoted names, URLs and positions differ per game; the shape of the error does not.
NORMALISE = [
    (re.compile(r'https?://\S+'), '<url>'),
    (re.compile(r'(?:[\w.-]+/)*[\w.-]+\.(?:html|m?js)(?::\d+)*'), '<file>'),
    (re.compile(r"'[^']{1,60}'|\"[^\"]{1,60}\"|`[^`]{1,60}`"), '<q>'),
    (re.compile(r'\b\d+(?:\.\d+)?\b'), '<n>'),
    (re.compile(r'\s+'), ' '),
]


def signature(text):
    s = str(text)
    s = s.split('\n')[0]
    for rx, rep in NORMALISE:
        s = rx.sub(rep, s)
    return s.strip()[:160]


def problems_of(report):
    """(path, kind, detail) triples from a check3d report, finer grained than its verdict strings."""
    out = []
    for path in ('webgl2', 'webgpu', 'mobile'):
        r = report.get(path)
        if not r:
            continue
        if r.get('crash'):
            out.append((path, 'checker-crash', signature(r['crash'])))
            continue
        if r.get('skipped'):
            continue
        kit = (r.get('probe') or {}).get('kit') if path == 'webgpu' else r.get('kit')
        errs = []
        if path == 'webgpu':
            pr = r.get('probe') or {}
            if not pr:
                out.append((path, 'no-probe', 'page never finished loading'))
                continue
            errs = [e for e in pr.get('errors', []) if not re.search(r'favicon|AudioContext|autoplay|\[kit\] WebGPU start failed', e)]
        else:
            errs = r.get('pageErrors', []) + [c[7:] for c in r.get('console', []) if c.startswith('error:') and not re.search(r'favicon|AudioContext|autoplay|GL Driver|swiftshader|GroupMarker', c, re.I)]
        if not kit:
            out.append((path, 'no-kit', 'window.__kit never appeared (boot failed before the kit ran)'))
        else:
            if (kit.get('frames') or 0) < 5:
                out.append((path, 'no-frames', 'kit booted but the loop did not run (title waits for input, or a throw)'))
            if path == 'webgpu' and kit.get('backend') != 'webgpu':
                out.append((path, 'fell-back', signature(kit.get('fellBack') or 'webgl2')))
            for e in (kit.get('errors') or [])[:3]:
                out.append((path, 'kit-error', signature(e.get('message'))))
            if (kit.get('pipelines') or 0) > PIPELINE_CHURN:
                log = kit.get('pipelineLog') or []
                top = max(set(e['material'] for e in log), key=lambda m: sum(e['material'] == m for e in log)) if log else '?'
                out.append((path, 'shader-churn', f"{kit['pipelines']} pipelines, most recent mostly {top}"))
            if path == 'webgpu' and (kit.get('frames') or 0) >= 5 and (r.get('probe') or {}).get('rafFps') is not None and r['probe']['rafFps'] < 30:
                out.append((path, 'slow', f"{r['probe']['rafFps']} fps on the real GPU"))
        started = (r.get('probe') or {}).get('started') if path == 'webgpu' else r.get('started')
        if started == [] and kit and (kit.get('frames') or 0) < 5:
            out.append((path, 'no-start', 'no start button found and no frames (the title may need a key or a click)'))
        for e in errs[:3]:
            out.append((path, 'page-error', signature(e)))
        if (r.get('canvas') or {}).get('blank'):
            out.append((path, 'blank', 'screenshot is a flat colour'))
    return out


def cmd_triage(a):
    out = Path(a.out)
    games, clusters = [], {}
    for rep in sorted(out.glob('*/report.json')):
        stem = rep.parent.name
        try:
            report = json.loads(rep.read_text())
        except Exception:
            report = {'problems': ['unreadable report']}
        probs = problems_of(report) if 'webgl2' in report or 'webgpu' in report else [('sweep', 'sweep', p) for p in report.get('problems', [])]
        games.append({'stem': stem, 'game': report.get('game'), 'problems': probs})
        for path, kind, detail in probs:
            key = f'{kind} | {detail}'
            c = clusters.setdefault(key, {'kind': kind, 'detail': detail, 'games': set(), 'paths': set()})
            c['games'].add(stem)
            c['paths'].add(path)
    broken = [g for g in games if g['problems']]
    serial = sorted(({'kind': c['kind'], 'detail': c['detail'], 'paths': sorted(c['paths']), 'count': len(c['games']), 'games': sorted(c['games'])} for c in clusters.values()), key=lambda c: -c['count'])
    (out / 'triage.json').write_text(json.dumps({'games': len(games), 'broken': len(broken), 'clusters': serial, 'perGame': games}, indent=1))
    print(f'{len(games)} game(s) swept: {len(games) - len(broken)} clean, {len(broken)} with problems\n')
    kinds = {}
    for g in broken:
        for k in {p[1] for p in g['problems']}:
            kinds[k] = kinds.get(k, 0) + 1
    print('games per problem kind:', ', '.join(f'{k} {v}' for k, v in sorted(kinds.items(), key=lambda x: -x[1])))
    print('\ntop signatures (games, paths, signature):')
    for c in serial[: a.top]:
        print(f"  {c['count']:3d}  {'/'.join(c['paths']):20s} {c['kind']}: {c['detail'][:110]}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('run')
    r.add_argument('games', nargs='*')
    r.add_argument('--jobs', type=int, default=4)
    r.add_argument('--out', default=str(DEFAULT_OUT))
    r.add_argument('--force', action='store_true')
    t = sub.add_parser('triage')
    t.add_argument('--out', default=str(DEFAULT_OUT))
    t.add_argument('--top', type=int, default=30)
    a = ap.parse_args()
    cmd_run(a) if a.cmd == 'run' else cmd_triage(a)


if __name__ == '__main__':
    main()
