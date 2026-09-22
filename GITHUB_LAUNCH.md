# Relay · GitHub launch

## Repository details

- **Suggested name:** `relay-multiplayer`
- **Description:** A cooperative circuit puzzle for two players on separate devices. Rotate your half, guide your partner, and bring the network to life.
- **Website:** https://relay-together.inayat121786.chatgpt.site
- **Topics:** `multiplayer`, `cooperative-game`, `puzzle-game`, `typescript`, `react`, `cloudflare-workers`, `cloudflare-d1`, `chatgpt`
- **Default branch:** `main`
- **Pages publishing source:** `main` → `/docs`

The project includes source code, locked dependencies, SQL schema, regression tests, artwork, a README, and a static GitHub Pages showcase. Private deployment identifiers, local databases, credentials, and build caches are excluded.

## Publish with GitHub CLI

Run these commands from the project directory after signing in with `gh auth login`. If the repository already exists, inspect it before choosing a destination; do not overwrite its history.

```sh
git init -b main
git add .
git commit -m "Launch Relay cooperative multiplayer puzzle"
gh repo create relay-multiplayer --public --source=. --remote=origin --push --description "A cooperative circuit puzzle for two players on separate devices."
gh repo edit --homepage "https://relay-together.inayat121786.chatgpt.site"
```

Then enable Pages from **Settings → Pages → Deploy from a branch → main → /docs**. The confirmed repository and Pages addresses can be added to the README once GitHub assigns them.

## Showcase

- Pin the repository on your GitHub profile.
- Use `docs/assets/relay-cover.png` as the optional repository social preview.
- Share the live game link with one friend per room.
- Include the playable URL in a contest submission; a source repository alone does not demonstrate live multiplayer.

## Short project description

Relay is a cooperative circuit puzzle for two players, wherever they are. Each player controls half the tiles. Together, they rotate wires, ping useful moves, and connect the input to every numbered relay and the output across three growing networks. Shared rooms, server-authoritative actions, and persistent progress make it a real multiplayer experience. Created by Inayat Abbas Malla with ChatGPT Work.
