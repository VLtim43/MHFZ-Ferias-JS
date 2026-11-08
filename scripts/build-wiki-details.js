// Package only the archived quest and monster fragments the wiki renders.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const archive = path.join(root, "archive/ferias");
const data = path.join(root, "data");
const monsters = JSON.parse(fs.readFileSync(path.join(data, "monsters.json"), "utf8"));
const quests = JSON.parse(fs.readFileSync(path.join(data, "quests.json"), "utf8"));

function write(folder, file, value) {
  const destination = path.join(data, folder, `${file}.json`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(value) + "\n");
}

// Some Ferias tables contain nested tables; find the matching closing tag.
function tableAt(html, start) {
  let depth = 0;
  for (const match of html.slice(start).matchAll(/<\/?table\b[^>]*>/gi)) {
    depth += /^<\/table/i.test(match[0]) ? -1 : 1;
    if (!depth) return html.slice(start, start + match.index + match[0].length);
  }
  return "";
}

const questFiles = new Set(Object.values(quests.names).filter(quest => quest.detailAvailable).map(quest => quest.file));
for (const file of questFiles) {
  const html = fs.readFileSync(path.join(archive, "quest", `${file}.htm`), "utf8");
  const headers = [...html.matchAll(/<table\s+class=["']mei["'][^>]*>/gi)];
  const entries = {};
  for (let i = 0; i < headers.length; i++) {
    const id = /<th\b[^>]*\bid=["']?l([0-9a-f]{4})["']?/i.exec(tableAt(html, headers[i].index))?.[1].toUpperCase();
    if (!id || quests.names[id]?.file !== file || !quests.names[id].detailAvailable) continue;
    const end = html.search(/<\/body>/i);
    entries[id] = html.slice(headers[i].index, headers[i + 1]?.index ?? (end < 0 ? html.length : end)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  }
  write("quest-details", file, entries);
}

for (const [id, pages] of Object.entries(monsters.pages)) {
  const records = {};
  for (const file of new Set(Object.values(pages))) {
    const html = fs.readFileSync(path.join(archive, "mons", file), "utf8");
    const tables = [];
    if (file === pages.h) {
      const first = /<table\b[^>]*>/i.exec(html);
      if (first) tables.push(tableAt(html, first.index));
    } else {
      for (const name of ["izyo", "niku", "down"]) {
        const match = new RegExp(`<table\\b[^>]*\\bid=["']?${name}["']?[^>]*>`, "i").exec(html);
        if (match) tables.push(tableAt(html, match.index));
      }
    }
    records[file] = tables.join("\n");
  }
  write("monster-details", id, records);
}

const images = new Set(Object.values(monsters.images).flatMap(variants => Object.values(variants).flatMap(variant => Object.values(variant))));
for (const image of images) {
  const source = path.join(archive, "img", image);
  const destination = path.join(root, "assets", image);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
console.log(`Packaged ${questFiles.size} quest files, ${Object.keys(monsters.pages).length} monsters, and ${images.size} images.`);
