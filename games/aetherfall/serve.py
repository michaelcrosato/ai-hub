#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser

root = Path(__file__).resolve().parent
os.chdir(root)
url = 'http://127.0.0.1:8080/'
print(f'Aetherfall: Windshard running at {url}')
try:
    webbrowser.open(url)
except Exception:
    pass
ThreadingHTTPServer(('127.0.0.1', 8080), SimpleHTTPRequestHandler).serve_forever()
