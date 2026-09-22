# Export verification

Checked on September 22, 2026.

| Check | Result |
| --- | --- |
| Pure game regression suite | Passed: 1,000 generated puzzles plus rules and progression checks |
| Server regression suite | Passed: SQLite schema, authentication, concurrency, replay handling, rounds, and expiry |
| TypeScript | `tsc --noEmit` passed |
| Portable production build | Vinext build passed for the clean export |
| Fresh local D1 schema | All four SQL statements applied successfully through Wrangler |
| Static showcase | Local assets, fragment links, unique IDs, image alternatives, and section labels checked |
| Export hygiene | Private deployment ID removed; dependencies, local databases, build output, caches, and credentials excluded |

The build used the existing installed dependency tree matching the source lockfile. Installing every package from the public registry in a fresh machine was not repeated. The game engine and multiplayer behavior are unchanged from the original playtested source.

The original game was tested with two independently authenticated browser sessions, all three sectors, rematches, hints, pings, quick signals, reload recovery, solo practice, keyboard navigation, and a narrow viewport. Physical phones, every browser engine, and load capacity were not tested.

The static GitHub Pages showcase received source and asset checks. A new visual browser review could not be completed in this environment. GitHub repository creation and Pages deployment remain separate from these local checks; this file is not deployment confirmation.
