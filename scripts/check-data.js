// Validate generated indexes without requiring a browser or third-party packages.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, "data", name + ".json"), "utf8"));
const items = read("items");
const sources = read("item-sources");
const monsters = read("monsters");
const monsterArt = require("./monster-art.json");
for (const id of monsterArt.exclude) {
  assert.ok(!monsters.pages[id] && !monsters.art[id] && !monsters.wikiPages[id], `Excluded monster is still listed: ${id}`);
  assert.ok(!fs.existsSync(path.join(root, "data/monster-details", `${id}.json`)), `Excluded monster still has detail data: ${id}`);
}
for (const [id, base] of Object.entries(monsterArt.iconBases)) {
  assert.equal(monsters.art[id]?.icon, monsters.art[base]?.icon, `Missing base icon for ${id}`);
}
for (const name of ["fire", "water", "thunder", "ice", "dragon", "poison", "paralysis", "sleep", "stun"]) {
  const icon = fs.readFileSync(path.join(root, "assets/effects", `${name}.webp`));
  assert.equal(icon.toString("ascii", 0, 4), "RIFF", `Invalid ${name} effect icon`);
  assert.equal(icon.toString("ascii", 8, 12), "WEBP", `Invalid ${name} effect icon`);
}
const quests = read("quests");
const equipment = read("equipment");
const shops = read("item-shops");
const prefixes = read("item-uses/index");
const uses = {};
for (const prefix of prefixes) {
  assert.match(prefix, /^[0-9A-F]{3,4}$/);
  for (const [id, entry] of Object.entries(read(`item-uses/${prefix}`))) {
    assert.ok(id.startsWith(prefix));
    assert.ok(items[id], `Equipment use references unknown item ${id}`);
    uses[id] = entry;
  }
}
for (const id of Object.keys(shops)) assert.ok(items[id], `Shop references unknown item ${id}`);
for (const [id, ranks] of Object.entries(sources)) {
  assert.ok(items[id], `Unknown item source ${id}`);
  for (const group of Object.values(ranks)) {
    for (const entry of group.monsters || []) assert.ok(monsters.names[entry.monsterId], `Unknown monster ${entry.monsterId}`);
    for (const entry of group.quests || []) assert.ok(quests.names[entry.questId], `Unknown quest ${entry.questId}`);
  }
}
let redirectCount = 0;
for (const id of Object.keys(monsters.art || {})) assert.ok(monsters.pages[id], `Art mapped to missing monster: ${id}`);
for (const [id, title] of Object.entries(monsters.wikiPages || {})) {
  assert.ok(monsters.pages[id], `Wiki page mapped to missing monster: ${id}`);
  assert.match(title, /^[\w ()'-]+$/, `Invalid wiki page title: ${id}`);
}
for (const [slug, id] of Object.entries(monsters.legacySlugs || {})) {
  assert.ok(monsters.pages[id], `Old slug points to missing monster: ${slug}`);
  assert.ok(!Object.values(monsters.slugs).includes(slug), `Old slug conflicts with current slug: ${slug}`);
}
for (const [id, pages] of Object.entries(monsters.pages)) {
  for (const [kind, image] of Object.entries(monsters.art?.[id] || {})) {
    assert.ok(["icon", "render"].includes(kind), `Unknown monster art type: ${id}/${kind}`);
    assert.match(image, /^monster-art\/[a-z0-9-]+\.webp$/, `Unsafe monster art path: ${id}/${kind}`);
    const bytes = fs.readFileSync(path.join(root, "assets", image));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", `Invalid monster art: ${id}/${kind}`);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", `Invalid monster art: ${id}/${kind}`);
  }
  if (pages.h) {
    assert.deepEqual(new Set(monsters.dropRanks[id]).size, monsters.dropRanks[id].length, `Duplicate drop rank for ${id}`);
    assert.ok(monsters.dropRanks[id].length, `Missing carve ranks for ${id}`);
  }
  for (const [variant, file] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(root, "archive/ferias/mons", file), "utf8");
    if (variant !== "h") {
      assert.ok(monsters.statLabels[id]?.[variant], `Missing stat label for ${id}/${variant}`);
      assert.doesNotMatch(html, /<meta\b[^>]*http-equiv=["']?refresh\b/i, `Redirect listed as stats: ${file}`);
      assert.match(html, /<table\b[^>]*id=["']?(?:izyo|niku)\b/i, `Empty stat page: ${file}`);
    }
  }
  redirectCount += Object.keys(monsters.redirects[id] || {}).length;
}
console.log(`Monster stats: ${redirectCount} redirect/placeholder files excluded; ${Object.keys(monsters.dropRanks).length} carve tables indexed.`);
assert.deepEqual(monsters.dropRanks.akamu, ["HR", "Elite", "GR"]);
assert.deepEqual(monsters.statLabels.akamu, { n: "Normal", ng: "GR", nh: "Henshu" });
assert.equal(monsters.statLabels.vau.nh, "Goushu");
assert.equal(monsters.statLabels.aquraj.nh, "Kishu");
assert.equal(monsters.statLabels.lavie.nh, "Violent");
assert.equal(monsters.statLabels.bogak.ni, "Musou");
assert.ok(!monsters.pages.amatsu.n && monsters.redirects.amatsu.n);
for (const [source, group] of [["weaponMaterialsByItem", "weapons"], ["armorMaterialsByItem", "armor"]]) {
  let count = 0;
  let extracted = 0;
  for (const encoded of Object.values(equipment[source])) count += encoded.split(",").length;
  for (const entry of Object.values(uses)) extracted += group === "weapons" ? entry.weapons.length : entry.armor.length + entry.decorations.length;
  assert.equal(extracted, count, `${source} did not extract every use`);
  console.log(`${source}: ${extracted.toLocaleString()} uses accounted for`);
}
const missing = Object.entries(quests.names).filter(([, quest]) => !fs.existsSync(path.join(root, "archive/ferias/quest", `${quest.file}.htm`)));
const questFiles = new Map();
const packagedQuestFiles = new Map();
let unsupportedQuestDetails = 0;
let localQuestListings = 0;
let absentQuestEntries = 0;
for (const [id, quest] of Object.entries(quests.names)) {
  assert.equal(quest.sourceAvailable, fs.existsSync(path.join(root, "archive/ferias/quest", `${quest.file}.htm`)));
  if (!quest.sourceAvailable) { assert.equal(quest.detailAvailable, false); assert.equal(quest.sourceAnchorAvailable, false); continue; }
  if (!questFiles.has(quest.file)) questFiles.set(quest.file, fs.readFileSync(path.join(root, "archive/ferias/quest", `${quest.file}.htm`), "utf8"));
  const html = questFiles.get(quest.file);
  assert.equal(quest.sourceAnchorAvailable, new RegExp(`\\bid=["']?l${id}(?=["'\\s>])`, "i").test(html), `Quest source anchor differs: ${id}`);
  if (quest.sourceAnchorAvailable) {
    if (!packagedQuestFiles.has(quest.file)) packagedQuestFiles.set(quest.file, read(`quest-details/${quest.file}`));
    const entry = packagedQuestFiles.get(quest.file)[id];
    assert.ok(entry, `Missing local quest entry ${id}`);
    assert.match(entry, new RegExp(`\\bid=["']?l${id}(?=["'\\s>])`, "i"), `Missing packaged quest anchor ${id}`);
  }
  if (quest.detailAvailable) {
    assert.match(html, new RegExp(`<th\\b[^>]*\\bid=["']?l${id}(?=["'\\s>])`, "i"), `Quest detail anchor missing: ${id}`);
  } else {
    unsupportedQuestDetails++;
    if (quest.sourceAnchorAvailable) localQuestListings++;
    else absentQuestEntries++;
  }
}
console.log(`Quest entries without archived detail files: ${missing.length} (${missing.map(([id]) => id).join(", ")})`);
console.log(`Quest entries without a standard detail table: ${unsupportedQuestDetails} (${localQuestListings} local listings, ${absentQuestEntries} missing source entries).`);
const weaponIndex = read("weapons-index");
const weaponPages = read("weapon-pages");
const weaponPrefixes = read("weapon-details/index");
const weaponNames = Object.entries(equipment.weaponNames).filter(([id]) => /^[0-9A-D][0-9A-F]{4}$/.test(id));
assert.equal(Object.keys(weaponIndex).length, weaponNames.length, "Player-weapon search coverage changed");
assert.equal(weaponPrefixes.length, 602, "Weapon shard count changed");
const seenWeapons = new Set();
let weaponRows = 0;
let towerTables = 0;
let evolutionLevel100 = 0;
const fileAnchors = new Map();
for (const prefix of weaponPrefixes) {
  assert.match(prefix, /^[0-9A-D][0-9A-F]{2}$/);
  const shard = read(`weapon-details/${prefix}`);
  assert.ok(Object.keys(shard).length, `Empty weapon shard ${prefix}`);
  for (const [id, weapon] of Object.entries(shard)) {
    assert.ok(id.startsWith(prefix) && !seenWeapons.has(id), `Duplicate or misplaced weapon ${id}`);
    seenWeapons.add(id);
    assert.equal(weapon.name, weaponIndex[id]?.name, `Weapon name differs: ${id}`);
    assert.equal(weapon.type, id[0]);
    assert.deepEqual(weapon.tables.map(table => table.file), weaponPages[id], `Weapon table coverage differs: ${id}`);
    for (const table of weapon.tables) {
      assert.ok(table.rows.length, `Empty weapon table ${id}/${table.file}`);
      if (table.kind === "tower") towerTables++;
      else assert.equal(table.columns.length, table.rows[0].cells.length, `Weapon header mismatch: ${id}`);
      for (const row of table.rows) {
        weaponRows++;
        assert.match(row.anchor, new RegExp(`^l${id.slice(1)}[0-9A-F]*$`), `Wrong weapon anchor: ${id}`);
        assert.ok(row.cells.length, `Empty weapon row ${id}/${row.anchor}`);
        if (row.level === 100 && table.file.endsWith("_s.htm")) evolutionLevel100++;
        if (!fileAnchors.has(table.file)) fileAnchors.set(table.file, new Set());
        fileAnchors.get(table.file).add(row.anchor);
        for (const cell of row.cells) for (const part of cell.parts || []) {
          if (part.itemId) {
            assert.ok(items[part.itemId], `Unknown weapon material ${part.itemId}`);
            if (part.quantity !== undefined) assert.ok(Number.isInteger(part.quantity) && part.quantity > 0);
          }
          if (part.weaponId) {
            const base = /^(?:([a-z_]+)\.htm)?#l/i.exec(part.href)?.[1];
            const type = base ? Object.entries({ "0": "taiken", "1": "heavy", "2": "hammer", "3": "lance", "4": "katate", "5": "right", "6": "souken", "7": "tachi", "8": "horn", "9": "gunlance", A: "yumi", B: "tonfa", C: "slaxe", D: "magspike" }).find(([, file]) => base === file || base.startsWith(`${file}_`))?.[0] : id[0];
            assert.ok(type && weaponIndex[type + part.weaponId], `Unknown linked weapon ${id} → ${part.href}`);
          }
        }
      }
    }
  }
}
for (const [id, name] of weaponNames) {
  const entry = weaponIndex[id];
  assert.equal(entry.name, name, `Weapon search name differs: ${id}`);
  assert.ok(entry.categories.length, `Uncategorized missing fallback: ${id}`);
  assert.equal(entry.hasDetail, seenWeapons.has(id), `Weapon detail flag differs: ${id}`);
  assert.equal(entry.hasTower, (weaponPages[id] || []).some(file => file.endsWith("_t.htm")));
}
assert.equal(seenWeapons.size, 18831);
assert.equal(towerTables, 63);
assert.equal(weaponRows, 145863);
assert.equal(evolutionLevel100, 754);
for (const [file, anchors] of fileAnchors) {
  const html = fs.readFileSync(path.join(root, "archive/ferias/buki", file), "utf8");
  for (const anchor of anchors) assert.ok(html.includes(`id="${anchor}"`), `Missing original weapon row: ${file}#${anchor}`);
}
console.log(`Weapons: ${seenWeapons.size.toLocaleString()} detailed, ${weaponRows.toLocaleString()} rows, ${towerTables} Tower tables, ${evolutionLevel100} Lv100 evolution rows; all linked items resolve.`);
const gearIndex = read("gear-index");
const gearTrees = read("gear-trees");
const unavailableGear = new Set(read("gear-unavailable"));
for (const id of Object.keys(equipment.armorAndDecorationNames)) assert.equal(unavailableGear.has(id), !gearIndex[id], `Wrong gear availability: ${id}`);
const gearPrefixes = new Set(Object.keys(gearIndex).map(id => id.slice(0, 3)));
let gearCount = 0;
let refinementLinks = 0;
for (const prefix of gearPrefixes) for (const [id, record] of Object.entries(read(`gear-details/${prefix}`))) {
  assert.ok(gearIndex[id], `Unknown gear detail ${id}`);
  assert.equal(record.columns.length, record.cells.length, `Wrong gear columns: ${id}`);
  assert.equal(record.file, gearIndex[id].file, `Wrong gear source: ${id}`);
  for (const cell of record.cells) for (const part of [...(cell.parts || []), ...(cell.lines || []).flatMap(line => line.parts || [])]) {
    if (part.itemId) assert.ok(items[part.itemId], `Unknown gear material ${part.itemId}`);
    if (part.gearId && part.gearId[0] === "d") refinementLinks++;
  }
  gearCount++;
}
assert.ok(refinementLinks >= 4179, `Missing armor refinement links (${refinementLinks})`);
assert.equal(gearCount, Object.keys(gearIndex).length, "Missing gear detail rows");
for (const [id, key] of Object.entries(gearTrees.byGear)) {
  assert.ok(gearIndex[id], `Unknown armor tree piece: ${id}`);
  assert.ok(gearTrees.trees[key]?.some(node => node.pieces.includes(id)), `Missing armor tree node: ${id}`);
}
assert.ok(gearIndex.h0001 && gearIndex.d031F && gearIndex.s0001);
for (const usesForItem of Object.values(uses)) for (const entry of [...usesForItem.armor, ...usesForItem.decorations]) {
  if (entry.nameMissing || gearIndex[entry.id]) continue;
  assert.ok(unavailableGear.has(entry.id), `Item use links to unknown gear ${entry.id}`);
}
console.log(`Armor and decorations: ${gearCount.toLocaleString()} detailed records, ${gearPrefixes.size} shards, ${Object.keys(gearTrees.byGear).length.toLocaleString()} tree links.`);
console.log(`Validated ${Object.keys(items).length.toLocaleString()} items and ${prefixes.length} equipment-use shards.`);
