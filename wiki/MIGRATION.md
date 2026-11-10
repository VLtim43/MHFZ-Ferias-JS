# Archive migration plan

## Direction and current audit

The committed `data/` and `assets/` files will become the editable source of truth; the Ferias snapshot is not a future build dependency. Do not delete it until the existing JSON has been audited and the archive-dependent checks have been replaced with JSON-only checks. Original-page links in the UI point to the external Ferias English Project, not the local archive.

Audit of the current committed data (against the snapshot):

- 7,393 indexed quests: 6,983 standard details, 315 local listing-only entries, 78 entries absent from their source pages, and 17 entries whose source file is absent. None of the 95 missing source entries occur in another archived quest file. Missing source content must not be invented. The other 7,298 entries are packaged in `quest-details/`.
- 101 packaged quest anchors differ in case from their indexed ID. The UI now finds these case-insensitively and corrects the external fragment link once the record loads. Persist the original anchor in typed JSON during migration.
- 18,831 of 18,840 indexed player weapons have detail records; 9 do not. All 55,553 entries in `gear-index.json` have details, but 62 additional names referenced by item uses have no source detail row and are listed separately in `gear-unavailable.json`. These are distinct from the 92 companion weapons without a new browser.
- `item-extras.json` retains 4,400 combination entries and 2,648 other-use entries, but the wiki does not decode or display them. Seven referenced gathering-map images are missing in both the snapshot and `assets/`.

### Optional future data shape (not required for archive removal)

The wiki already renders the packaged HTML fragments in `quest-details/*` and `monster-details/*` without fetching archived pages. Keep them as-is for archive removal. If a later change needs typed records, migrate one section at a time and compare rendered output against current pages. Keep original IDs, labels, unknown values, and absent-data flags; do not guess missing facts.

- Quest: `{ kind: "detail" | "listing", title, fields: [{ label, value }], sections: [{ kind: "requirement" | "supplies" | "rewards" | "listing", rows: [{ cells: [...] }] }] }`. Preserve source order, spans, line breaks, and item links in cell values.
- Monster: `{ stats: { variant: { status, hitzones, breaks } }, drops: { ranks, rows } }`. Each table has explicit header cells and rows; drops keep source/rank association and item links rather than an HTML table blob.
- Shared cell values: plain text or ordered `{ text, itemId? }` parts plus explicit line breaks. Render with DOM text nodes and internal links, never by injecting HTML. Treat opaque source text as text until its meaning is verified.
- Add JSON-only validation for every indexed detail reference, IDs in item/gear/weapon links, available ranks, and asset paths. Then retire source-based build and validation scripts. Keep `sourceAvailable`-style flags only where they express actual missing content, not as a requirement to retain the snapshot.

The public wiki covers items, monsters, quests, weapons, armor, decorations and skills. The Ferias archive is a build-time extraction source, **not** a runtime dependency or feature checklist. Do not delete archive files until local data, assets and source links have been checked.

| Wiki feature | Current JSON | Remaining gaps | Source inputs still needed for regeneration |
| --- | --- | --- | --- |
| Item search and acquisition | `items`, `item-sources`, `item-shops`, `item-uses/*` | Combination recipes and other special uses still link to the upstream project | `sozai/{item,mos_sozai,que_sozai,sai_sozai,buki_sozai,bougu_sozai,other_sozai}.js` |
| Monster details | `monsters`, `monster-details/*`; diagrams copied into `assets/` | Source redirects and placeholders remain excluded | `mons/*.htm`, `img/monsicons`, `img/monszones`, `sozai/mos_sozai.js` |
| Quest details | `quests`, `quest-details/*` | 17 indexed quests have no source file; 78 more have no entry in their existing source file | `quest/*.htm`, `sozai/que_sozai.js` |
| Weapon details | `weapons-index`, `weapon-details/*`, `weapon-trees`, `equipment`, `weapon-pages` | 9 named weapons have no located detail row; companion weapons have no new UI | `buki/*.htm`, `sozai/buki_sozai.js` |
| Armor and decorations | `gear-index`, `gear-details/*`, `gear-trees`, `gear-unavailable` | 62 item-use names outside the searchable index lack a source detail row; some upgrade targets are absent from the index | `bougu/*.htm`, `sozai/bougu_sozai.js` |
| Regular and Zenith skills | `skills` | Labels absent from the source description tables remain plain text | `koneta/skill.htm`, `koneta/skill_zenith.htm` (one-time import only) |
| Gathering maps on item pages | `item-sources` and `assets/saisyu` | Some source map images do not exist | `sozai/sai_sozai.js`; map images already copied into `assets/saisyu` |

Monster stat labels come from each actual page title, not its filename suffix. Redirect-only or empty stat files are recorded in `monsters.redirects` and are not shown as variants. `monsters.dropRanks` records independent carve-table columns; never infer them from stat file names. Part-zone diagrams are tied to stat variants, not carve ranks, and should not be substituted from another variant.

## Monster source audit

- 56 `n` files are redirects or empty placeholders, not Normal stat pages; do not show them as selectable variants.
- The real `nh` files are not all Henshu: 39 Goushu, 30 Henshu, 12 Kishu, 10 Normal, 2 Supremacy, 1 Gou and 1 Violent. Three `ng` files and one `ni` file are titled Musou rather than GR/Zenith. Display the source variant title.
- Carve tables use separate columns (HR, Elite, GR, Arena, Zenith★1–4, etc.). A monster can have a drop column without a stat page with a matching name; this is not evidence of a missing page. Bogabadorumu has a GR stat page but only Zenith drop columns in its carve table. Do not invent a GR drop column.
- Some **source names themselves disagree**: `hipusiro` is “White Hypnoc” in the name index but “Silver Hypnoc” in its stat-page title; `mira` is “Black Fatalis” in the index but “Fatalis” in the title. Keep the indexed name until those are reviewed manually rather than silently renaming IDs.

## Additional source gaps

- Quest index: 17 entries refer to absent files; 78 more IDs do not occur in their existing source files. Event/lottery listings and ordinary detail tables are packaged as local JSON; unavailable source entries link to the upstream file without a nonexistent anchor.
- Nine weapon records in `*_n.htm` have only numbered RNG Cat Weapon rows, not a plain base-ID row. Those rows can be displayed, but their source names sometimes differ from the weapon name index. Nine other named weapons still have no indexed HTML row.
- The player-weapon migration extracts 18,831 details (145,863 level/variant/upgrade rows), including 63 separate Tower tables. Source headers vary across 13 layouts, and several fields and alternative crafting recipes are ambiguous; retain their source labels and text rather than assigning unsupported interpretations. 138 indexed weapons have no source-tree category or known group and are labeled `Uncategorized`. The 92 companion weapons are still outside the new browser.
- Seven referenced gathering-map filenames are absent from both `assets/saisyu` and the original image directory: `shio-bcd.png` and `sai-1.png` through `sai-6.png`. The UI should state when a preview is unavailable, not imply the source has an image.

Optional future work: refine weapon-specific stats only where source semantics can be verified, and decode combination/other-use indexes before removing the external original item link. Keep a record of absent source pages rather than fabricating details. Converting packaged quest and monster fragments to typed records is not a prerequisite for deleting the archive.

Before deleting the archive, check that neither runtime code nor retained validation depends on it, required images have moved into `assets/`, and a JSON-only validator passes. Compare representative details in each section against the original. Delete only after these checks, in a separate change.
