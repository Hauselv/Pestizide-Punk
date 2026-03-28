Original prompt: Build the first playable implementation of "Pestizide Punk" as a browser-based survival strategy prototype based on the approved plan.

- Initialized the workspace from scratch for a Vite + React + Zustand prototype.
- Current target: world map, city slots, research, expeditions, hazards, events, local save/load, and deterministic stepping hooks for browser automation.
- TODO after scaffold: install dependencies, verify build, run the Playwright loop, inspect screenshots, and adjust any broken UI or state transitions.
- Note: the Windows sandbox refresh is flaky on nested file writes, so edits are being applied in smaller steps.
- Added the initial vertical slice code: state store, sector/building/research data, UI shell, and test scaffold.
- Next step: install dependencies, run build/tests, then launch the dev server and validate interactions with the web-game Playwright loop.
- Fixed TypeScript project config, typed numeric flow operations, and the simulation snapshot cloning bug in Zustand.
- Added browser validation artifacts in output/web-game for world, city, and research views.
- Tuned the early economy by slowing per-second rates, removing barracks food drain, and versioning the save key to reset stale local saves.
- Added public/favicon.svg and linked it in index.html to remove the missing-favicon console error.
- Remaining expansion TODOs: richer city interactions (staff reassignment, building upgrades), additional sector actions, stronger event variety, and a dedicated renderer layer if we move beyond the management-first prototype.
