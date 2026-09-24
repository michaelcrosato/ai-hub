from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

os.chdir(Path(__file__).parent)
port = int(os.environ.get('PORT', '8765'))
print(f'RopeBurn Rumble: http://127.0.0.1:{port}')
ThreadingHTTPServer(('127.0.0.1', port), SimpleHTTPRequestHandler).serve_forever()
