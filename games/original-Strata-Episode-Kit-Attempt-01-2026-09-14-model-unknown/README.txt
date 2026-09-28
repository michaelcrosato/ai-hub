CDN PREVIEW: internet is required for Three.js and Rapier. The DOM pages work without those libraries. This preview is transpiled, not a substitute for a dependency-aware build.

Serve this directory with HTTP. For example:
  python -m http.server 8000 --bind 127.0.0.1
Then open http://localhost:8000/
Do not use file://.
Each episode is an HTML entry under episodes/.
Build report bytes are raw module bytes, plus per-file gzip estimates. They exclude CDN packages in preview mode.
