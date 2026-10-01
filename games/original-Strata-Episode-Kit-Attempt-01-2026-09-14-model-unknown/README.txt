STRATA / EPISODE KIT

One story in four episodes, each with its own rules:
  01 Loading Bay      first person, Rapier rigid bodies, local sentry AI
  02 Coast Road       arcade car on a local collision model (no Rapier)
  03 Breakwater Light first person, built from the starter's signal blocks
  04 The Handoff      reads the run contract; no scene of its own

The page runs on the wall's shared 3D stack: three.js r186 (WebGPU with a
WebGL2 fallback) and Rapier 0.20 from /lib, booted through /lib/kit. Each
episode is a separate module under src/episodes/, loaded when it starts.
Only JSON crosses from one episode to the next (src/campaign/).

Serve the repository root over HTTP (the import map points at /lib/...):
  python3 -m http.server 8000 --bind 127.0.0.1
then open http://localhost:8000/games/<this folder>/
Add #yard, #drive, #breakwater or #debrief to open an episode directly.
