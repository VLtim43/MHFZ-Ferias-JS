# New wiki (item-first prototype)

Run `node wiki/dev-server.js` from the repository root, then visit `http://localhost:8000/wiki/`. No dependencies or Python required. Set `PORT` to use another port.

The original site is unchanged. This prototype reads `../sozai/item.js` for the item index and loads the existing monster, quest, and gathering item indexes when viewing an item. Original pages are linked as a fallback for information not yet migrated.

Item links are `wiki/#/items/0188`. Hash-based routing works on static hosts without rewrites; a later deployment with URL rewrite support can use clean `/items/0188` URLs. The four-character item ID should remain the canonical item identifier; rank and variant describe sources, not the identity of the item.

Only items are implemented. The other sidebar entries are intentionally disabled until their data and pages are migrated.
