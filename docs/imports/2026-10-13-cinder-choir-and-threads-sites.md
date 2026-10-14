# Cinder Choir and Threads of the Last Dawn Site imports

Imported the owner-requested published Sites as playable static projects:

| Site | Saved version | Game version | Destination | Runtime files | Bytes |
| --- | --- | --- | --- | --- | --- |
| https://cinder-choir.michaelcrosato.chatgpt.site | 8 | 6.0.0, The Living Roads | `games/cinder-choir/index.html` | 28 | 2,146,097 |
| https://threads-of-the-last-dawn.michaelcrosato.chatgpt.site | 6 | 1.4.0, The Small Hours | `games/threads-of-the-last-dawn/index.html` | 436 | 34,363,177 |

Cinder Choir project: `appgprj_6acbd15219008191a7460d4ca9eac3c3`.
Saved version: `appgprj_6acbd15219008191a7460d4ca9eac3c3~appgver_8caf2c5b51208191af264f37929434ec`.
Source commit: `6107f28ff8bb8b40c5e09f0ec9e1d0e9c0eaab64`, dated
`2026-10-12T14:57:52-07:00`.

Threads project: `appgprj_6acbcfeb7c0c8191a158677ef81dbd9d`.
Saved version: `appgprj_6acbcfeb7c0c8191a158677ef81dbd9d~appgver_843826be24dc8191acdf7e0a4e725fb4`.
Source commit: `af422b97f9020f1204827cd0393130e220c03b4f`, dated
`2026-10-12T15:04:29-07:00`.

Each Site declares `dist/` as its static directory. Runtime code, styles,
images, engine files and licenses are copied unchanged. Nested source ZIPs,
visual-evidence ZIPs, unused render captures, Markdown documentation, and
build records are excluded from the public game directories. Original source
checkouts remain in the local import cache. Registry raw/output fingerprints
cover the sanitized runtime input; they do not claim to fingerprint the entire
source repository or its original archive. Every installed runtime file was
verified against its registry SHA-256 and size.

Catalogue source/model metadata is backed by each source README and embedded
About information: Final Fantasy VI for Cinder Choir, Chrono Trigger for Threads,
and GPT-6 Astra Pro / ChatGPT for both. Cinder Choir's existing Work of Returning
entry is an explicitly separate standalone side story with separate saves;
it remains unchanged. Runtime save identifiers are preserved.

Validation:

- Hub build and all 197 hub tests pass; both entries appear in the catalogue.
- Cinder Choir: 157 source logic tests passed. Its terrain-render suite initially
  lacked `@napi-rs/canvas`; all four checks passed after supplying that dependency
  from an ignored local QA cache. No runtime change was needed.
- Threads: all 89 source tests passed, plus the source validator (no errors).
- Headless Chrome starts both games inside the hub player, chooses Normal /
  Standard difficulty, completes opening dialogue, and renders Low Quay /
  Larkspur Quay respectively. No page errors or failed HTTP responses occurred.
- Screenshots are local ignored QA artifacts under `.cache/morrowglass/`.
