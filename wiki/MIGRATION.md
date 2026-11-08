# Archive migration plan

The public wiki targets items, monsters, quests, weapons, armor and decorations. The Ferias archive is the extraction source and temporary detail fallback, **not** a feature checklist. Do not delete any archive files until the replacement data and links have been checked.

| Wiki feature | Current JSON | Still needs archive at runtime | Source inputs still needed for regeneration |
| --- | --- | --- | --- |
| Item search and acquisition | `items`, `item-sources`, `item-shops`, `item-uses/*` | Original item link for combinations, other uses and special acquisition; no archive HTML needed for the migrated sections | `sozai/{item,mos_sozai,que_sozai,sai_sozai,buki_sozai,bougu_sozai,other_sozai}.js` |
| Monster details | `monsters` (index, slugs, artwork paths) | `mons/*.htm` for stats, hitzones, drops; `img/monsicons`, `img/monszones` for diagrams | `mons/*.htm`, `img/monsicons`, `img/monszones`, `sozai/mos_sozai.js` |
| Quest details | `quests` (index) | `quest/*.htm` for details and rewards; 17 indexed quests have no archived detail file | `quest/*.htm`, `sozai/que_sozai.js` |
| Weapon details | `weapons-index`, `weapon-details/*`, `equipment`, `weapon-pages`, item-use shards | No HTML fetch required for migrated player-weapon details; original-page links remain. 9 named weapons have no located detail row; companion weapons have no new UI | `buki/*.htm`, `sozai/buki_sozai.js` |
| Armor and decorations | `equipment` (names/material lookup), item-use shards | No new detail page yet; original `bougu` pages remain the reference | `bougu/*.htm`, `sozai/bougu_sozai.js` |
| Gathering maps on item pages | `item-sources` and `assets/saisyu` | No archive HTML for the migrated map preview | `sozai/sai_sozai.js`; map images already copied into `assets/saisyu` |

Monster stat labels come from each actual page title, not its filename suffix. Redirect-only or empty stat files are recorded in `monsters.redirects` and are not shown as variants. `monsters.dropRanks` records independent carve-table columns; never infer them from stat file names. Part-zone diagrams are tied to stat variants, not carve ranks, and should not be substituted from another variant.

## Monster source audit

- 56 `n` files are redirects or empty placeholders, not Normal stat pages; do not show them as selectable variants.
- The real `nh` files are not all Henshu: 39 Goushu, 30 Henshu, 12 Kishu, 10 Normal, 2 Supremacy, 1 Gou and 1 Violent. Three `ng` files and one `ni` file are titled Musou rather than GR/Zenith. Display the source variant title.
- Carve tables use separate columns (HR, Elite, GR, Arena, Zenith★1–4, etc.). A monster can have a drop column without a stat page with a matching name; this is not evidence of a missing page. Bogabadorumu has a GR stat page but only Zenith drop columns in its carve table. Do not invent a GR drop column.
- Some **source names themselves disagree**: `hipusiro` is “White Hypnoc” in the name index but “Silver Hypnoc” in its stat-page title; `mira` is “Black Fatalis” in the index but “Fatalis” in the title. Keep the indexed name until those are reviewed manually rather than silently renaming IDs.

## Additional source gaps

- Quest index: 17 entries refer to absent files; 78 more IDs do not occur in their existing source files; 315 event/lottery entries appear as listings rather than `table.mei` details. `quests.json` distinguishes file presence from supported detail-table availability.
- Nine weapon records in `*_n.htm` have only numbered RNG Cat Weapon rows, not a plain base-ID row. Those rows can be displayed, but their source names sometimes differ from the weapon name index. Nine other named weapons still have no indexed HTML row.
- The player-weapon migration extracts 18,831 details (145,863 level/variant/upgrade rows), including 63 separate Tower tables. Source headers vary across 13 layouts, and several fields and alternative crafting recipes are ambiguous; retain their source labels and text rather than assigning unsupported interpretations. 138 indexed weapons have no source-tree category or known group and are labeled `Uncategorized`. The 92 companion weapons are still outside the new browser.
- Seven referenced gathering-map filenames are absent from both `assets/saisyu` and the original image directory: `shio-bcd.png` and `sai-1.png` through `sai-6.png`. The UI should state when a preview is unavailable, not imply the source has an image.

Next: extract typed monster, quest, armor and decoration detail JSON, then switch their UI paths off archived HTML. Refine weapon-specific stats only where source semantics can be verified. Decode combination/other-use indexes before removing the original item link. Keep a record of absent source pages rather than fabricating details.

Before deleting a directory, check that neither `wiki/` nor `scripts/` references it, required images have moved into `assets/`, and `node scripts/build-data.js` followed by `node scripts/check-data.js` passes. Compare representative details in each section against the original. Delete only after these checks, in a separate change.
