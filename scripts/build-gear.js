// Build searchable armor and decoration records from the archived Ferias tables.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "archive/ferias/bougu");
const output = path.join(root, "data");
const names = JSON.parse(fs.readFileSync(path.join(output, "equipment.json"), "utf8")).armorAndDecorationNames;
const index = {};
const shards = {};
const trees = {};
const treeByGear = {};
const types = {
  head: "h", body: "b", arm: "a", wst: "w", leg: "l",
  headsp: "h", bodysp: "b", armsp: "a", wstsp: "w", legsp: "l",
  head_partnya: "H", body_partnya: "B",
  deco: "d", decosp: "p", decocf: "c", decotf: "f", deconk: "n",
  decotr: "t", decotk: "k", decocz: "z", sigil: "s"
};

function plain(html) {
  return html.replace(/<br\s*\/?\s*>|<li\b[^>]*>|<\/li>|<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (_, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, value) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[value.toLowerCase()])
    .replace(/\ufeff/g, "").replace(/[ \t]+/g, " ").trim();
}

function value(html, type) {
  const parts = [];
  let last = 0;
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const before = plain(html.slice(last, match.index));
    if (before) parts.push({ text: before });
    const href = /\bhref=["']([^"']+)["']/i.exec(match[1])?.[1] || "";
    const itemId = /(?:^|\/)sozai\.htm\?([0-9a-f]{4})/i.exec(href)?.[1].toUpperCase();
    const gear = /^(?:([a-z_]+)\.htm)?#l([0-9a-f]{4})$/i.exec(href);
    const gearType = gear && (gear[1] ? types[gear[1].toLowerCase()] : type);
    const gearId = gearType && gearType + gear[2].toUpperCase();
    parts.push({ text: plain(match[2]), ...(itemId ? { itemId } : {}), ...(gearId ? { gearId } : {}) });
    last = match.index + match[0].length;
  }
  const after = plain(html.slice(last));
  if (after) parts.push({ text: after });
  return parts.some(part => part.itemId || part.gearId) ? { parts } : { text: plain(html) };
}

for (const [file, type] of Object.entries(types)) {
  const html = fs.readFileSync(path.join(source, `${file}.htm`), "utf8");
  const heading = /<thead>\s*<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(html)?.[1];
  if (!heading) throw new Error(`Missing gear table heading in ${file}`);
  const columns = [...heading.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(([, cell]) => plain(cell).replace(/\n/g, " "));
  for (const [, code, row] of html.matchAll(/<tr\b[^>]*>\s*<td\b[^>]*\bid=["']?l([0-9a-f]{4})["']?[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const id = type + code.toUpperCase();
    if (!names[id]) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell], index) => {
      const lines = cell.split(/<br\s*\/?\s*>/i);
      return index + 1 >= 5 && index + 1 <= 8 && lines.length > 1 ? { lines: lines.map(line => value(line, type)) } : value(cell, type);
    });
    // The first cell starts before the name's closing td, so include it separately.
    const name = /^([\s\S]*?)<\/td>/i.exec(row)?.[1];
    if (!name || cells.length + 1 !== columns.length) continue;
    const record = { file: `${file}.htm`, columns, cells: [value(name, type), ...cells] };
    (shards[id.slice(0, 3)] ||= {})[id] = record;
    index[id] = { name: type === "s" ? plain(name.split(/<div\b/i)[0]) : names[id], type, file: `${file}.htm`, ...(type === "s" ? { originalName: names[id] } : {}) };
  }
}

for (const file of ["tree.htm", "tree_partnya.htm"]) {
  const html = fs.readFileSync(path.join(source, file), "utf8");
  for (const [, category, block] of html.matchAll(/<div\s+id=["']?t(\d+)L["']?[^>]*>([\s\S]*?)<\/div>/gi)) {
    for (const [position, [, branch]] of [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].entries()) {
      const nodes = [];
      for (const line of branch.split(/<br\s*\/?\s*>/i)) {
        const first = /<a\b/i.exec(line);
        if (!first) continue;
        const raw = line.slice(0, first.index);
        const prefix = /^[　 │├└┝↓→]+/.exec(raw)?.[0] || "";
        const name = plain(raw.slice(prefix.length)).replace(/[（(]\s*$/, "").trim();
        const pieces = [];
        for (const [, href] of line.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
          const direct = /^#([hbawlHB][0-9a-f]{4})$/i.exec(href);
          const partnya = /^(head|body)_partnya\.htm#l([0-9a-f]{4})$/i.exec(href);
          const id = direct?.[1] || (partnya ? (partnya[1] === "head" ? "H" : "B") + partnya[2] : "");
          if (index[id]) pieces.push(id[0] + id.slice(1).toUpperCase());
        }
        if (name && pieces.length) nodes.push({ depth: prefix.trimEnd().length, name, pieces });
      }
      if (nodes.length < 2) continue;
      const key = `${file}:${category}:${position}`;
      trees[key] = nodes;
      for (const node of nodes) for (const id of node.pieces) treeByGear[id] ||= key;
    }
  }
}

function write(file, data) {
  fs.writeFileSync(path.join(output, file), JSON.stringify(data) + "\n");
}
write("gear-index.json", index);
write("gear-unavailable.json", Object.keys(names).filter(id => !index[id]));
write("gear-trees.json", { byGear: treeByGear, trees });
fs.mkdirSync(path.join(output, "gear-details"), { recursive: true });
for (const [prefix, records] of Object.entries(shards)) write(`gear-details/${prefix}.json`, records);
console.log(`Wrote ${Object.keys(index).length} armor and decoration records in ${Object.keys(shards).length} shards (${Object.keys(treeByGear).length} tree links).`);
