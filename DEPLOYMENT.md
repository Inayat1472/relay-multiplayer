# Hosting Relay

## Live game

The multiplayer game is available at **[relay-together.inayat121786.chatgpt.site](https://relay-together.inayat121786.chatgpt.site)**. It uses a server and D1 database to share room state across devices.

## GitHub Pages showcase

The `docs/` folder is a complete static site. Its Play buttons open the existing multiplayer app. It uses relative asset paths, so it works under a GitHub project URL without a build step.

After publishing this repository to GitHub:

1. Open **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Select **main** and **/docs**, then **Save**.
4. Wait for GitHub's Pages deployment to finish and open the URL shown in Settings.

GitHub Pages serves static HTML, CSS, and JavaScript. It cannot run this game's Worker API or D1 database. Do not point the full multiplayer app at Pages without also providing a compatible backend.

References: [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [Configure a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Local development

Follow the README's install, build, local migration, and start commands. A clean clone selects the portable execution profile. No production database, room tokens, or local session data are included in this repository.

## Deploying another multiplayer instance

The checked-in manifest declares a logical `DB` binding. The identifier in `vite.config.ts` is a local placeholder; it is not a production database or a usable deployment configuration for your Cloudflare account.

The current live instance is deployed with Sites. To self-host a separate instance, provide a Cloudflare Worker deployment and D1 database, bind the database as `DB`, apply the SQL migrations, and update the app's canonical URL. Verify two independent player sessions before replacing the public Play link. Cloudflare account setup and provisioning are separate from enabling GitHub Pages.

Keep `.env` files, local databases, authentication tokens, generated output, and deployment credentials out of commits. Production migration history is append-only after deployment.
