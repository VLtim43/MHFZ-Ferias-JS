# New wiki (item-first prototype)

Run `node wiki/dev-server.js` from the repository root, then visit `http://localhost:8000/` or `/wiki/`. No dependencies or Python required. Set `PORT` to use another port.

The wiki reads generated JSON in `../data/` and images in `../assets/`. Original Ferias files remain in `../archive/ferias/` as build-time source material; original-page links point to the upstream project. See the root README and `data/README.md` for data formats.

Item links are `wiki/#/items/0188`. Hash-based routing works on static hosts without rewrites; a later deployment with URL rewrite support can use clean `/items/0188` URLs. The four-character item ID remains canonical; rank and variant describe sources, not the identity of the item.

Items, quests, weapons, armor, decorations, and monsters have searchable indexes and shareable detail links. Armor details include level selection and linked set trees; decorations include cuffs and sigils. Monster pages offer independent stat-variant and carve-rank selection, including Zenith tiers where the source provides them. Quest and monster details load extracted HTML fragments from local JSON on demand; the wiki never requests archived pages at runtime. Missing original entries show a notice rather than invented data.
