#!/usr/bin/env python3
"""
check3d.py — boot a game from ai-hub and report whether its 3D actually runs.

Needs Python Playwright with Chromium (machine-wide here, not a project
dependency) and, for the WebGPU path, Windows Chrome reachable from WSL.

  check3d.py games/Foo.html                 # WebGL2 path (Linux headless Chromium) + WebGPU path (Windows Chrome, real GPU)
  check3d.py games/Foo.html --only webgl2   # just one path: webgl2 | webgpu | mobile
  check3d.py games/Foo.html --keys KeyW,Space --click   # also drive input on the WebGL2 path
  check3d.py games/Foo.html --wait 12       # seconds to let it boot (default 9)
  check3d.py games/Foo.html --out /tmp/x    # where screenshots + report.json go

Paths:
  webgl2  Playwright Chromium, forced WebGL2 (?kit-backend=webgl2). Screenshot, console errors,
          window.__kit diagnostics, blank-canvas check, optional key/click input.
  webgpu  Windows Chrome headless on the real RTX 3060 Ti via --dump-dom with an injected probe,
          plus a --screenshot run. Reports the backend the kit chose, frames, errors. --keys/--click
          are replayed there too as synthetic events once the game has booted (the screenshot is
          taken after them, so it shows gameplay if the keys start the game).
  mobile  Playwright Chromium with a Pixel 7 profile (touch, coarse pointer): checks the kit's touch
          controls appear and nothing throws.

Exit code 0 when every requested path booted, rendered frames and logged no errors; 1 otherwise.
The report prints as JSON on stdout.
"""
import argparse, http.server, json, os, random, re, shutil, socket, socketserver, subprocess, sys, threading, time, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CHROME = os.environ.get('CHECK3D_CHROME', '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe')
WIN_USER = os.environ.get('CHECK3D_WIN_USER', 'micha')
WIN_TEMP_WSL = Path(f'/mnt/c/Users/{WIN_USER}/AppData/Local/Temp')
WIN_TEMP = f'C:\\Users\\{WIN_USER}\\AppData\\Local\\Temp'

MIME = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json',
        '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
        '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff',
        '.ttf': 'font/ttf', '.bin': 'application/octet-stream', '.txt': 'text/plain'}

PROBE = r"""<script>(()=>{const P={errors:[],contexts:[],gpu:null};window.__probe=P;
const oe=console.error;console.error=(...a)=>{try{P.errors.push(a.map(x=>x&&x.stack?x.stack:String(x)).join(' ').slice(0,400))}catch(e){};oe.apply(console,a)};
addEventListener('error',e=>P.errors.push('error: '+(e.message||e.error)));
addEventListener('unhandledrejection',e=>P.errors.push('rejection: '+(e.reason&&e.reason.message||e.reason)));
const gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...r){P.contexts.push(t);return gc.call(this,t,...r)};
if(navigator.gpu){const ra=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=async(...a)=>{const ad=await ra(...a);P.gpu=ad?{vendor:ad.info&&ad.info.vendor,arch:ad.info&&ad.info.architecture}:'null';return ad}}
setTimeout(()=>{const k=window.__kit||null;const pre=document.createElement('pre');pre.id='__probe_out';pre.textContent='@@PRO'+'BE@@'+JSON.stringify({...P,kit:k,title:document.title})+'@@E'+'ND@@';document.documentElement.append(pre)},__WAIT__);
})();</script>"""


# Input for the WebGPU path, where the page runs in Windows Chrome with no automation channel:
# after the game has booted, click the middle of the screen, then hold each key for 0.6 s.
DRIVE = r"""<script>addEventListener('load',()=>{},{once:true});setTimeout(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const keys=__KEYS__;const click=__CLICK__;const X=innerWidth/2,Y=innerHeight/2;
if(click){const t=document.elementFromPoint(X,Y)||document.body;const o={bubbles:true,cancelable:true,clientX:X,clientY:Y,pointerId:1,pointerType:'mouse',button:0,buttons:1,isPrimary:true};
t.dispatchEvent(new PointerEvent('pointerdown',o));t.dispatchEvent(new MouseEvent('mousedown',o));await sleep(80);
t.dispatchEvent(new PointerEvent('pointerup',{...o,buttons:0}));t.dispatchEvent(new MouseEvent('mouseup',{...o,buttons:0}));t.dispatchEvent(new MouseEvent('click',{...o,buttons:0}));await sleep(300)}
for(const code of keys){const key=code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code.startsWith('Digit')?code.slice(5):code;
const tgt=document.activeElement||document.body;tgt.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true}));await sleep(600);
tgt.dispatchEvent(new KeyboardEvent('keyup',{code,key,bubbles:true,cancelable:true}));await sleep(200)}},__DELAY__);</script>"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(REPO), **kw)

    def log_message(self, *a):
        pass

    def guess_type(self, path):
        return MIME.get(os.path.splitext(str(path))[1].lower(), super().guess_type(path))

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/__slow':
            time.sleep(float(q.get('ms', ['9000'])[0]) / 1000)
            body = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
            self.send_response(200); self.send_header('Content-Type', 'image/gif'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
            return
        if 'probe' in q and u.path.endswith(('.html', '/')):
            fs = REPO / urllib.parse.unquote(u.path.lstrip('/'))
            if fs.is_dir():
                fs = fs / 'index.html'
            if fs.is_file():
                wait = int(q.get('probe', ['9000'])[0])
                html = fs.read_text(encoding='utf-8', errors='replace')
                probe = PROBE.replace('__WAIT__', str(wait))
                keys = [k for k in q.get('drive', [''])[0].split(',') if k]
                clickq = q.get('click', ['0'])[0] == '1'
                if keys or clickq:
                    delay = max(1500, int(wait * 0.4))
                    probe += DRIVE.replace('__KEYS__', json.dumps(keys)).replace('__CLICK__', 'true' if clickq else 'false').replace('__DELAY__', str(delay))
                m = re.search(r'<head[^>]*>', html, re.I)
                html = html[:m.end()] + probe + html[m.end():] if m else probe + html
                slow = f'<img src="/__slow?ms={wait + 1500}" style="position:fixed;width:1px;height:1px;opacity:0" alt="">'
                i = html.lower().rfind('</body>')
                html = html[:i] + slow + html[i:] if i >= 0 else html + slow
                body = html.encode('utf-8')
                self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
                return
        return super().do_GET()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # Browsers drop connections they no longer need (favicon, aborted fetches); that is not an error.
        if isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
            return
        super().handle_error(request, client_address)


def start_server():
    for _ in range(40):
        port = random.randint(20000, 40000)
        try:
            srv = Server(('0.0.0.0', port), Handler)
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            return srv, port
        except OSError:
            continue
    raise RuntimeError('no free port')


def game_url(rel):
    rel = rel.strip('/')
    if rel.startswith(str(REPO)):
        rel = str(Path(rel).relative_to(REPO))
    p = REPO / rel
    if p.is_dir():
        rel = rel + '/'
    return '/' + urllib.parse.quote(rel)



def png_stats(data):
    """Distinct coarse colours in a PNG (pure Python: 8-bit RGB/RGBA, non-interlaced)."""
    import struct, zlib
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return {'error': 'not a png'}
    pos, idat, w, h, ctype, depth = 8, b'', 0, 0, 0, 0
    while pos < len(data):
        ln, typ = struct.unpack('>I4s', data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT':
            idat += chunk
        pos += 12 + ln
    if depth != 8 or ctype not in (2, 6):
        return {'error': f'unsupported png type {ctype}/{depth}'}
    bpp = 3 if ctype == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * bpp
    prev = bytearray(stride)
    rows = []
    i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    seen = set()
    for y in range(0, h, max(1, h // 36)):
        row = rows[y]
        for x in range(0, w, max(1, w // 64)):
            o = x * bpp
            seen.add((row[o] >> 4, row[o + 1] >> 4, row[o + 2] >> 4))
    return {'distinctColours': len(seen), 'blank': len(seen) < 3}

def canvas_stats(page):
    try:
        return png_stats(page.screenshot())
    except Exception as e:
        return {'error': str(e)}


def run_playwright(url_path, port, out, wait, keys, click, mobile=False):
    from playwright.sync_api import sync_playwright
    res = {'console': [], 'pageErrors': []}
    with sync_playwright() as pw:
        args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
        browser = pw.chromium.launch(args=args)
        if mobile:
            ctx = browser.new_context(**pw.devices['Pixel 7'])
        else:
            ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = ctx.new_page()
        page.on('console', lambda m: res['console'].append(f'{m.type}: {m.text[:400]}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: res['pageErrors'].append(str(e)[:600]))
        sep = '&' if '?' in url_path else '?'
        url = f'http://127.0.0.1:{port}{url_path}{sep}kit-backend=webgl2'
        t0 = time.time()
        try:
            page.goto(url, wait_until='load', timeout=60000)
        except Exception as e:
            res['gotoError'] = str(e)[:300]
        deadline = t0 + wait
        while time.time() < deadline:
            try:
                k = page.evaluate('window.__kit && window.__kit.frames')
                if k and k > 60:
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if click:
            try:
                page.mouse.click(640, 360)
                time.sleep(0.5)
            except Exception as e:
                res['clickError'] = str(e)[:200]
        for key in keys:
            try:
                page.keyboard.down(key); time.sleep(0.6); page.keyboard.up(key); time.sleep(0.2)
            except Exception as e:
                res.setdefault('keyErrors', []).append(str(e)[:200])
        time.sleep(1.0)
        try:
            res['kit'] = page.evaluate('window.__kit ? JSON.parse(JSON.stringify(window.__kit)) : null')
        except Exception as e:
            res['kit'] = None
            res['evalError'] = str(e)[:200]
        if mobile:
            res['touchVisible'] = page.evaluate("!!document.querySelector('.kit-touch.is-visible')")
            res['touchButtons'] = page.evaluate("[...document.querySelectorAll('.kit-touch__btn,.kit-touch__pill')].map(b=>b.textContent)")
            res['touchSticks'] = page.evaluate("document.querySelectorAll('.kit-touch__stick').length")
        res['canvas'] = canvas_stats(page)
        shot = out / ('mobile.png' if mobile else 'webgl2.png')
        page.screenshot(path=str(shot))
        res['screenshot'] = str(shot)
        res['seconds'] = round(time.time() - t0, 1)
        browser.close()
    return res


def run_windows(url_path, port, out, wait, keys=(), click=False):
    if not os.path.exists(CHROME):
        return {'skipped': 'Windows Chrome not found'}
    tag = f'kitcheck-{os.getpid()}-{random.randint(0, 99999)}'
    prof_wsl = WIN_TEMP_WSL / tag
    prof_win = WIN_TEMP + '\\' + tag
    sep = '&' if '?' in url_path else '?'
    url = f'http://localhost:{port}{url_path}{sep}probe={wait * 1000}'
    if keys:
        url += '&drive=' + urllib.parse.quote(','.join(keys))
    if click:
        url += '&click=1'
    base = [CHROME, '--headless=new', '--no-first-run', '--no-default-browser-check', '--window-size=1280,720',
            '--autoplay-policy=no-user-gesture-required', f'--user-data-dir={prof_win}']
    res = {}
    try:
        t0 = time.time()
        # WSL's localhost relay notices a new listening port after a moment; retry until Windows can connect.
        for attempt in range(8):
            p = subprocess.run(base + ['--dump-dom', url], capture_output=True, timeout=wait + 60)
            if b'ERR_CONNECTION_REFUSED' not in p.stderr:
                break
            time.sleep(1.5)
        dom = p.stdout.decode('utf-8', 'replace')
        m = re.search(r'@@PROBE@@(.*?)@@END@@', dom, re.S)
        if m:
            import html as H
            res['probe'] = json.loads(H.unescape(m.group(1)))
        else:
            res['probeMissing'] = True
            res['stderr'] = p.stderr.decode('utf-8', 'replace')[-800:]
        res['seconds'] = round(time.time() - t0, 1)
        shot_win = prof_win + '\\shot.png'
        subprocess.run(base + [f'--screenshot={shot_win}', url], capture_output=True, timeout=wait + 60)
        shot_wsl = prof_wsl / 'shot.png'
        if shot_wsl.exists():
            dest = out / 'webgpu.png'
            shutil.copy(shot_wsl, dest)
            res['screenshot'] = str(dest)
            res['canvas'] = png_stats(dest.read_bytes())
    except subprocess.TimeoutExpired:
        res['timeout'] = True
    finally:
        shutil.rmtree(prof_wsl, ignore_errors=True)
    return res


IGNORABLE = re.compile(r'favicon|AudioContext was not allowed|The AudioContext|autoplay|Download the React DevTools|\[kit\] WebGPU start failed|DevTools|GPU stall due to ReadPixels|Automatic fallback to software WebGL|WebGL: CONTEXT_LOST|GroupMarkerNotSet|swiftshader', re.I)


def verdict(report):
    problems = []
    w = report.get('webgl2')
    if w:
        k = w.get('kit') or {}
        if not k:
            problems.append('webgl2: no window.__kit (not on the kit?)')
        else:
            if k.get('backend') != 'webgl2':
                problems.append(f"webgl2: backend {k.get('backend')}")
            if (k.get('frames') or 0) < 5:
                problems.append(f"webgl2: only {k.get('frames')} frames")
            if k.get('errors'):
                problems.append(f"webgl2: kit errors {k['errors'][:3]}")
        errs = [e for e in w.get('pageErrors', [])] + [c for c in w.get('console', []) if c.startswith('error') and not IGNORABLE.search(c)]
        if errs:
            problems.append(f'webgl2: console/page errors {errs[:4]}')
        if (w.get('canvas') or {}).get('blank'):
            problems.append('webgl2: screen looks blank')
    g = report.get('webgpu')
    if g and not g.get('skipped'):
        pr = g.get('probe') or {}
        k = pr.get('kit') or {}
        if not pr:
            problems.append('webgpu: probe missing (page never loaded?)')
        elif not k:
            problems.append('webgpu: no window.__kit')
        else:
            if k.get('backend') != 'webgpu':
                problems.append(f"webgpu: backend {k.get('backend')} (fellBack={k.get('fellBack')})")
            if (k.get('frames') or 0) < 5:
                problems.append(f"webgpu: only {k.get('frames')} frames")
            if k.get('errors'):
                problems.append(f"webgpu: kit errors {k['errors'][:3]}")
        perr = [e for e in pr.get('errors', []) if not IGNORABLE.search(e)]
        if perr:
            problems.append(f'webgpu: console errors {perr[:4]}')
        if (g.get('canvas') or {}).get('blank'):
            problems.append('webgpu: screen looks blank')
    m = report.get('mobile')
    if m:
        k = m.get('kit') or {}
        if (k.get('frames') or 0) < 5:
            problems.append(f"mobile: only {k.get('frames')} frames")
        errs = m.get('pageErrors', [])
        if errs:
            problems.append(f'mobile: page errors {errs[:3]}')
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('game')
    ap.add_argument('--only', default='webgl2,webgpu,mobile')
    ap.add_argument('--wait', type=int, default=9)
    ap.add_argument('--keys', default='')
    ap.add_argument('--click', action='store_true')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    only = set(a.only.split(','))
    slug = re.sub(r'[^A-Za-z0-9]+', '-', a.game)[-60:].strip('-')
    out = Path(a.out or f'/tmp/claude-1000/check3d/{slug}-{int(time.time())}')
    out.mkdir(parents=True, exist_ok=True)
    srv, port = start_server()
    url_path = game_url(a.game)
    report = {'game': a.game, 'url': url_path, 'out': str(out)}
    keys = [k for k in a.keys.split(',') if k]
    threads = []
    def job(name, fn, *args):
        try:
            report[name] = fn(*args)
        except Exception as e:
            report[name] = {'crash': str(e)[:500]}
    if 'webgpu' in only:
        threads.append(threading.Thread(target=job, args=('webgpu', run_windows, url_path, port, out, a.wait, keys, a.click)))
    if 'webgl2' in only:
        threads.append(threading.Thread(target=job, args=('webgl2', run_playwright, url_path, port, out, a.wait + 6, keys, a.click)))
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    if 'mobile' in only:
        job('mobile', run_playwright, url_path, port, out, a.wait + 6, [], False, True)
    srv.shutdown()
    report['problems'] = verdict(report)
    report['ok'] = not report['problems']
    (out / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    sys.exit(0 if report['ok'] else 1)


if __name__ == '__main__':
    main()
