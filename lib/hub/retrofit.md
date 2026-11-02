# Upgrading an existing game to parallel

The prompt `scripts/retrofit.mjs` gives a model for each game, after its tool
step has put the session client and the parallel metas at the top of the
page. The model works in a copy of the game in a folder of its own: `{{file}}`
is the game's page there, `{{contract}}` the protocol in
[`README.md`](README.md) from *Modes* to *Rules*, word for word (the same text
for every game, so a batch reads it from the cache), `{{budget}}` the most lines a try may change,
and `{{notes}}` what the last try's check said, if there was one.

---

You are upgrading one existing browser game, `{{file}}`, so friends can play it
in parallel mode in AI Hub sessions: each friend plays their own copy at the same
time, and the hub keeps the score. Change as little as possible. Never change
how the game plays or feels: movement, physics, timing, controls, menus, art,
audio and difficulty stay exactly as they are.

A tool has already put the session client (`session.js`, which defines
`window.AIHub`) and the `hub:session` meta tags at the top of `<head>`. This is
the protocol; the game is upgraded to its parallel mode, and the hub checks it
against it:

<protocol>
{{contract}}
</protocol>

Do only this:

1. Find how the game is won or scored. Use a time (lower wins) if it has a
   clear finish, otherwise its score (higher wins).
2. Fill `hub:session-goal` (how to win, at most 60 characters) and
   `hub:session-howto` (the controls, at most 80 characters), in plain words
   for someone who has never seen the game. If a round of the game has a
   fixed length, add `<meta name="hub:session-minutes" content="…">` with it.
   If the game cannot run at all without WebGPU, also add
   `<meta name="hub:webgpu" content="required">`.
3. In session mode (`AIHub.active` is true): skip the title screen, attract
   mode and menus; `await AIHub.connect({ mode: 'parallel', seats: [1, 4] })`;
   build the game; call `AIHub.ready()` as soon as it can start, with no "press
   start" prompt; begin play only once `AIHub.time() >= 0`. If `connect()`
   answers `null`, carry on as when `AIHub.active` is false.
4. Whenever the score changes, call
   `AIHub.progress({ score: <number>, label: <short text> })`, where a higher
   score is further ahead and `label` is short text for the scoreboard.
5. When the run ends (finished, died, out of lives), call
   `AIHub.result({ time })` or `AIHub.result({ score })` once. In
   `AIHub.on('time-up', …)`, report the current score at once if the run is
   still going.
6. In `AIHub.on('end', …)`, stop input and sound.
7. If the game deals its pieces, cards, board or level layout from one
   function using `Math.random`, make that function draw from
   `AIHub.rng('deal')` in session mode, so every copy gets the same deal all
   round. Leave every other random call alone.
8. When `AIHub.active` is false, the game must behave exactly as before.

Don't add features, refactor, reformat, rename or upgrade anything, and don't
touch code these steps don't need: change at most {{budget}} lines. Never edit
the session client between its `/*! aihub-session` banner and its last line,
the names of the meta tags, or a bundled library (three.js, Rapier and the
like). Saved progress is already hidden in a session (the client gives the
game an empty storage), and `Math.random` is already seeded: add no code for
either. You are done when the game would pass the checks the protocol
describes; you need not run them, the hub does.

If the game has no score and no finish, change nothing and reply with one
line: `NOT PARALLEL: <why>`.

Otherwise reply with: the score or time used, the end condition, and every line
you changed.

{{notes}}
