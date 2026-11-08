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

On GitHub Pages, publish `main` from the repository root; `/` opens the new wiki and `/archive/ferias/` retains the original site. The new wiki currently links to original detail pages for information it has not yet migrated.
