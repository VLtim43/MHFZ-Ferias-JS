# New wiki (item-first prototype)

Run `node wiki/dev-server.js` from the repository root, then visit `http://localhost:8000/` or `/wiki/`. No dependencies or Python required. Set `PORT` to use another port.

The wiki reads generated JSON in `../data/` and selected images in `../assets/`. The complete original site has moved, intact, to `../archive/ferias/`; item details link there as a fallback. See the root README and `data/README.md` for the migration plan and data formats.

Item links are `wiki/#/items/0188`. Hash-based routing works on static hosts without rewrites; a later deployment with URL rewrite support can use clean `/items/0188` URLs. The four-character item ID remains canonical; rank and variant describe sources, not the identity of the item.

Items, quests, weapons, and monsters have searchable indexes and shareable detail links. Monster pages offer independent stat-variant and carve-rank selection, including Zenith tiers where the archive provides them. Quest, weapon, and monster details still load the selected original HTML tables on demand from `archive/ferias/`. Missing original entries show a notice rather than invented data. Armor pages are not implemented yet.
