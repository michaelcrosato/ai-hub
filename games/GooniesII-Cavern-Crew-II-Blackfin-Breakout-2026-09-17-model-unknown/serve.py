#!/usr/bin/env python3
"""Serve the whole wall (the game loads the shared /lib/three and /lib/kit) and print this game's URL."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

game = Path(__file__).resolve().parent
repo = game.parents[1]
os.chdir(repo)
print(f'Cavern Crew II: http://localhost:8765/games/{game.name}/')
ThreadingHTTPServer(('0.0.0.0', 8765), SimpleHTTPRequestHandler).serve_forever()
