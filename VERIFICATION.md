# Export verification

Checked on September 22, 2026.

| Check | Result |
| --- | --- |
| Pure game regression suite | Passed: 1,000 generated puzzles plus rules and progression checks |
| Server regression suite | Passed: SQLite schema, authentication, concurrency, replay handling, rounds, and expiry |
| TypeScript | `tsc --noEmit` passed |
| Portable production build | Vinext build passed for the clean export |
| Fresh local D1 schema | All four SQL statements applied successfully through Wrangler |
| Static showcase | Local assets, fragment links, unique IDs, image alternatives, and section labels checked; published page visually reviewed |
| Export hygiene | Private deployment ID removed; dependencies, local databases, build output, caches, and credentials excluded |

The build used the existing installed dependency tree matching the source lockfile. Installing every package from the public registry in a fresh machine was not repeated. The game engine and multiplayer behavior are unchanged from the original playtested source.

The original game was tested with two independently authenticated browser sessions, all three sectors, rematches, hints, pings, quick signals, reload recovery, solo practice, keyboard navigation, and a narrow viewport. Physical phones, every browser engine, and load capacity were not tested.

The public repository was created and GitHub Pages deployed successfully on September 22, 2026. The live showcase was visually reviewed at a 1348-pixel browser viewport: all three images loaded, the page had no horizontal overflow, the rules anchor worked, and the Play links pointed to the existing multiplayer host. The repository was pinned to the creator's profile.

- Repository: https://github.com/Inayat1472/relay-multiplayer
- Showcase: https://inayat1472.github.io/relay-multiplayer/
- Multiplayer game: https://relay-together.inayat121786.chatgpt.site
