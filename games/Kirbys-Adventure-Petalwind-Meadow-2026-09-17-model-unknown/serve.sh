#!/usr/bin/env sh
set -eu
python3 -m http.server "${PORT:-8080}"
