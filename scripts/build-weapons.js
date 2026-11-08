// Extract the weapon tables into small, on-demand JSON shards. No browser or
// third-party HTML parser is required: the original weapon data rows have a
// consistent <tr><td id="lXXXX..."> shape, checked against their table headers.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const directory = path.join(root, "archive/ferias/buki");
const output = path.join(root, "data");
const equipment = JSON.parse(fs.readFileSync(path.join(output, "equipment.json"), "utf8"));
const pages = JSON.parse(fs.readFileSync(path.join(output, "weapon-pages.json"), "utf8"));
const playable = /^[0-9A-D]/;
const groups = Object.fromEntries(Object.entries(equipment.weaponGroups).map(([key, value]) => [key, new Set(value.split(",").filter(Boolean))]));
const categoryAliases = { "ＳＰ": "SP", "ＨＣ": "HC", Prizes: "Prize", Bundles: "Bundle", Subscriptions: "Subscription" };
const index = {};
const details = {};

function write(file, data) {
  const filename = path.join(output, file);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(data) + "\n");
}

function textFromHtml(html) {
  return html.replace(/<br\s*\/?\s*>|<\/li>|<li\b[^>]*>|<\/p>|<p\b[^>]*>|<hr\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (_, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity.toLowerCase()])
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
}
const plain = html => textFromHtml(html).trim();

function cellValue(html) {
  const links = [];
  const parts = [];
  let last = 0;
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const before = textFromHtml(html.slice(last, match.index));
    if (before) parts.push({ text: before });
    const label = plain(match[2]);
    const href = /\bhref=["']?([^"'\s>]+)/i.exec(match[1])?.[1] || "";
    const item = /(?:^|\/)sozai\.htm\?([0-9a-f]{4})/i.exec(href)?.[1].toUpperCase();
    const weapon = /^(?:#l|[a-z_]+\.htm#l)([0-9a-f]{4})/i.exec(href)?.[1].toUpperCase();
    if (item) links.push(item);
    const quantity = item && /^\s*x(\d+)/i.exec(html.slice(match.index + match[0].length))?.[1];
    parts.push({ text: label, ...(item ? { itemId: item, ...(quantity ? { quantity: Number(quantity) } : {}) } : {}), ...(weapon ? { weaponId: weapon, href } : {}) });
    last = match.index + match[0].length;
  }
  const after = textFromHtml(html.slice(last));
  if (after) parts.push({ text: after });
  const sharpness = [...html.matchAll(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi)].map(([, bar]) =>
    [...bar.matchAll(/<li\b[^>]*class=["']([^"']+)["']/gi)].map(([, classes]) => {
      const color = /(?:^|\s)([roygbwps])(?:\s|$)/.exec(classes)?.[1];
      const length = /(?:^|\s)s(\d+)(?:\s|$)/.exec(classes)?.[1];
      return color && length ? { color, length: Number(length) } : null;
    }).filter(Boolean)
  ).filter(bar => bar.length);
  // Store link-bearing cells as ordered parts so item and weapon links survive,
  // and preserve the original text of ambiguous recipes and special fields.
  const text = plain(html);
  const value = { text };
  if (links.length || parts.some(part => part.weaponId)) value.parts = parts;
  if (sharpness.length) value.sharpness = sharpness;
  return value;
}

const files = new Map();
for (const [id, name] of Object.entries(equipment.weaponNames)) {
  if (!playable.test(id)) continue;
  const sources = pages[id] || [];
  const tags = Object.entries(groups).filter(([, keys]) => keys.has(id)).map(([tag]) => tag);
  index[id] = { name, type: id[0], tags, categories: [], hasDetail: sources.length > 0, hasTower: sources.some(file => file.endsWith("_t.htm")) };
  if (!sources.length) continue;
  details[id] = { name, type: id[0], tables: [] };
  for (const file of sources) (files.get(file) || files.set(file, new Map()).get(file)).set(id.slice(1), id);
}

let extracted = 0;
for (const [file, ids] of files) {
  const html = fs.readFileSync(path.join(directory, file), "utf8");
  if (!file.endsWith("_t.htm")) {
    const categoryNames = Object.fromEntries([...html.matchAll(/<span\s+id=["']?t(\d+)["']?[^>]*>([^<]+)<\/span>/gi)]
      .map(([, number, label]) => [number, plain(label)]));
    for (const [, category, block] of html.matchAll(/<div\s+id=["']?t(\d+)L["']?[^>]*>([\s\S]*?)<\/div>/gi)) {
      for (const [, base] of block.matchAll(/href=["']#l([0-9a-f]{4})["']/gi)) {
        const id = ids.get(base.toUpperCase());
        const label = categoryAliases[categoryNames[category]] || categoryNames[category];
        if (id && label && !index[id].categories.includes(label)) index[id].categories.push(label);
      }
    }
  }
  const header = /<thead>\s*<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(html)?.[1];
  if (!header) throw new Error(`Missing weapon header in ${file}`);
  const columns = [...header.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(([, value]) => plain(value));
  const tower = file.endsWith("_t.htm");
  const found = new Set();
  const tables = new Map();
  for (const match of html.matchAll(/<tr\b[^>]*>\s*<td\b[^>]*\bid=["']?l([0-9a-f]{4})([0-9a-f]{1,3})?["']?[^>]*>[\s\S]*?<\/tr>/gi)) {
    const base = match[1].toUpperCase();
    const id = ids.get(base);
    if (!id) continue;
    const suffix = match[2]?.toUpperCase() || "";
    const cells = [...match[0].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map(([, attrs, value]) => ({
      ...cellValue(value), ...(tower && /\bcolspan=["']?(\d+)/i.test(attrs) ? { colSpan: Number(/\bcolspan=["']?(\d+)/i.exec(attrs)[1]) } : {})
    }));
    if (!tower && cells.length !== columns.length) throw new Error(`Wrong column count in ${file} for ${id}`);
    const rng = /RNG Cat Weapon/.test(cells[0].text);
    if (suffix && !tower && !rng && !new RegExp(`<b>Lv${Number(suffix)}<\\/b>`, "i").test(match[0])) continue;
    const row = { anchor: `l${base}${suffix}`, ...(!tower && suffix ? rng ? { variant: suffix } : { level: Number(suffix) } : {}), cells };
    const table = tables.get(id) || { file, kind: tower ? "tower" : "weapon", columns, rows: [] };
    table.rows.push(row);
    tables.set(id, table);
    found.add(id);
    extracted++;
  }
  for (const id of ids.values()) {
    if (!found.has(id)) throw new Error(`Weapon ${id} missing from ${file}`);
    details[id].tables.push(tables.get(id));
  }
}

for (const entry of Object.values(index)) {
  if (!entry.categories.length) {
    if (entry.tags.includes("sp")) entry.categories.push("SP");
    else if (entry.tags.includes("g")) entry.categories.push("G rank");
    else if (entry.tags.includes("sinca")) entry.categories.push("Ravi");
    else if (entry.tags.includes("neko")) entry.categories.push("RNGou");
    else entry.categories.push("Uncategorized");
  }
}

write("weapons-index.json", index);
const shards = {};
for (const [id, record] of Object.entries(details)) (shards[id.slice(0, 3)] ||= {})[id] = record;
write("weapon-details/index.json", Object.keys(shards).sort());
for (const [prefix, records] of Object.entries(shards)) write(`weapon-details/${prefix}.json`, records);
console.log(`Wrote ${Object.keys(shards).length} weapon-detail shards (${Object.keys(details).length} weapons; ${extracted} rows).`);
