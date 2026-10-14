# Morrowglass Site import

Imported https://morrowglass-hollow-bell.michaelcrosato.chatgpt.site into
`games/morrowglass-hollow-bell/index.html` as a complete static project.
The published title is **Morrowglass: The Lantern Roads v5.0.0** and includes
The Hollow Bell, The Unwritten Tide, The Rootbound Atlas, and The Lantern Accord.

- Sites project: `appgprj_6acb2802a9bc81918acb6dcd7fe7f467`.
- Saved version: `appgprj_6acb2802a9bc81918acb6dcd7fe7f467~appgver_6fdd698be01481919f3773f7034002ee` (version 5).
- Source commit: `2ab967374541a55de17ebff2813339ccabb6f462`.
- Source commit date: `2026-10-12T14:54:45-07:00`.
- Runtime: all 51 files from the source manifest's `dist/` directory,
  85,899,000 bytes. Raw and installed bundle SHA-256:
  `51d120c8e5f5350ecaebb83e57ff1f9bec3d4f3d319d10e18ce760f16244f2b1`.
- The ingest registry retains project, version, date, identity evidence, and
  individual file hashes. Every installed file was checked against those hashes.
- Catalogue metadata comes from the runtime and its embedded provenance:
  RPG, GPT-6 Astra Pro, ChatGPT, inspired by Final Fantasy IX.
- Existing `Morrowglass-Living-Places.html` is a separate recovered-v2 branch
  and remains its own entry. Save identifiers and runtime files are unchanged.

Verification: the hub build succeeds and includes the new entry. All 197 hub
tests pass. Source checks confirm all 18 runtime scripts parse and HTML/image
dependencies exist. Battle and card logic suites passed (10 and 7 checks);
campaign battles passed 14 groups with 51 simulated fights, and Accord battles
passed 18 groups with 83 simulated fights.

Headless Chrome verification through the hub player confirms the game starts,
completes its opening dialogue, and renders Lantern Quay with the party,
interaction hotspots, and the mission to speak with Edda. No page errors or
failed HTTP responses occurred. Screenshot: local ignored artifact
`.cache/morrowglass/hub-gameplay.png`.
