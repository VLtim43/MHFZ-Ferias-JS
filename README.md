# Frontier Wiki

The new wiki lives in `wiki/`. Run `node wiki/dev-server.js` and visit `http://localhost:8000/`. No dependencies are required.

| Directory | Purpose |
| --- | --- |
| `wiki/` | Static wiki UI for items, quests, weapons, armor, decorations, and monsters. |
| `data/` | Generated, item-first JSON lookup indexes for the new wiki. |
| `assets/` | UI icons, monster images and diagrams, and gathering maps. |
| `scripts/` | Node-only extractors that rebuild `data/` from the archive. |
| `archive/ferias/` | Complete original Ferias website, including retired features and the original data. Kept intact as source material and a fallback. |

See `data/README.md` for dataset coverage and IDs. To regenerate JSON and referenced images after editing source data, run `node scripts/build-data.js`, then `node scripts/check-data.js`. Do not edit generated JSON by hand.

Monster renders and icons in `assets/monster-art/` come from the [Monster Hunter Wiki Frontier monster category](https://monsterhunter.fandom.com/wiki/Category:Frontier_Monsters) and its linked image pages. `node scripts/import-monster-art.js` refreshes the local copies through the wiki's MediaWiki API (and an image proxy when the Fandom CDN blocks downloads); `scripts/monster-art.json` records the mapping. Image rights belong to their respective owners.

Element and ailment icons in `assets/effects/` come from the [Monster Hunter Wiki Status Effects page](https://monsterhunter.fandom.com/wiki/Status_Effects). Refresh with `node scripts/import-effect-icons.js`.

For GitHub Pages, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow in `.github/workflows/pages.yml` validates generated data and deploys `index.html`, `wiki/`, `assets/`, and runtime JSON from `data/` on pushes to `main` (or manually from the Actions tab). Build-only JSON and the archive remain in Git for regeneration but are not published; original-page links go to the upstream Ferias project.
