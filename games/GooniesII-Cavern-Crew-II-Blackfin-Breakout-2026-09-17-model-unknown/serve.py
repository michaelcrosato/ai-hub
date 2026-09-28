#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

root = Path(__file__).resolve().parent
os.chdir(root)
print('Cavern Crew II: http://localhost:8765')
ThreadingHTTPServer(('0.0.0.0', 8765), SimpleHTTPRequestHandler).serve_forever()
