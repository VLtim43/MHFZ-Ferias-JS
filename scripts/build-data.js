// Extract the item-first wiki datasets from the preserved, unmodified Ferias files.
// Run from any directory: node scripts/build-data.js
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const original = path.join(root, "archive/ferias/sozai");
const destination = path.join(root, "data");
const context = vm.createContext({});

for (const filename of ["item.js", "mos_sozai.js", "que_sozai.js", "sai_sozai.js", "buki_sozai.js", "bougu_sozai.js", "other_sozai.js"]) {
  vm.runInContext(fs.readFileSync(path.join(original, filename), "utf8"), context, { filename });
}

function write(name, value) {
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, name), JSON.stringify(value) + "\n");
  console.log(`Wrote data/${name}`);
}

const oldItems = context.setItem();
const oldJapaneseItems = context.setItemJP();
const oldMonsters = context.setMonster();
const oldQuests = context.setQuest();
const oldGathering = context.setSaisyu();
const oldWeapons = context.setBuki();
const oldArmor = context.setBougu();
const oldOther = context.setOther();
const ranks = ["Kai", "Zyoui", "Sugo", "G"];
const seasons = ["Warm", "Cold", "Breeding"];
const places = ["General", "Jungle", "Desert", "Swamp", "Snowy Mountains", "Volcano", "Forest and Hills", "Tower", "Great Forest", "Interception Base", "Fortress", "Town", "Battleground", "Arena", "Gorge", "Solitude Island", "Highlands", "Tidal Island", "Polar Sea", "Flower Field", "White Lake", "Painted Falls"];
const placeIds = ["", "mitu", "saba", "numa", "yuki", "kaza", "mori", "tou", "zyu", "def", "toride", "siro", "kessen", "tougi", "kyou", "sima", "kou", "shio", "kyoku", "hana", "bya", "sai"];

const items = {};
for (const [id, item] of Object.entries(oldItems)) {
  items[id] = {
    name: item[0], nameJa: oldJapaneseItems[id]?.[0] || "",
    rarity: item[1], price: item[2], stack: item[3],
    requiredRank: item[4], sortKey: item[5], description: item[6]
  };
}
write("items.json", items);

const monsters = { names: { ...oldMonsters.Name }, pages: {}, images: {}, slugs: {} };
const monsterImageFiles = Object.fromEntries(["monsicons", "monszones"].map(folder => [folder,
  new Map(fs.readdirSync(path.join(root, "archive/ferias/img", folder)).map(filename => [filename.toLowerCase(), filename]))
]));
for (const file of fs.readdirSync(path.join(root, "archive/ferias/mons"))) {
  const match = /^([a-z0-9]+)_(n|nh|ng|ni|nt|h)\.htm$/i.exec(file);
  if (!match || ["mons", "monsF"].includes(match[1])) continue;
  const [ , basename, kind ] = match;
  const id = basename.toLowerCase();
  (monsters.pages[id] ||= {})[kind] = file;
  const html = fs.readFileSync(path.join(root, "archive/ferias/mons", file), "utf8");
  if (kind !== "h") {
    for (const [, imageKind, imagePath] of html.matchAll(/<img\b[^>]*\bid=["']?(icon|hitzones)["']?\s+src=["']?\.\.\/img\/(mons(?:icons|zones)\/[\w.-]+\.(?:png|webp|gif))/gi)) {
      const [folder, filename] = imagePath.split("/");
      const actual = monsterImageFiles[folder]?.get(filename.toLowerCase());
      if (actual) ((monsters.images[id] ||= {})[kind] ||= {})[imageKind] = `${folder}/${actual}`;
    }
  }
  if (!monsters.names[id]) {
    monsters.names[id] = /<div\s+id=["']?monsname["']?[^>]*>([^<]+)/i.exec(html)?.[1] || id;
  }
}
const usedMonsterSlugs = new Set();
const monsterIds = new Set(Object.keys(monsters.pages));
for (const id of monsterIds) {
  const name = monsters.names[id];
  const base = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || id;
  const slug = usedMonsterSlugs.has(base) || monsterIds.has(base) && base !== id ? `${base}-${id}` : base;
  monsters.slugs[id] = slug;
  usedMonsterSlugs.add(slug);
}
write("monsters.json", monsters);

const quests = { names: {}, rewardTypes: oldQuests.Htype };
for (const [id, value] of Object.entries(oldQuests.Name)) {
  const [file, seasonAndTime, category, level, ...title] = value.split(",");
  quests.names[id] = { file, seasonAndTime, category, level, title: title.join(",") };
}
// The item reward index names only quests that participate in item lookups. Many
// event/special quests exist only in the HTML tables; index those too.
const questDirectory = path.join(root, "archive/ferias/quest");
const plain = html => html.replace(/<i\b[^>]*>[\s\S]*?<\/i>/gi, "")
  .replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").trim();
for (const file of fs.readdirSync(questDirectory).filter(name => name.endsWith(".htm"))) {
  const html = fs.readFileSync(path.join(questDirectory, file), "utf8");
  for (const [table] of html.matchAll(/<table\s+class=["']mei["'][\s\S]*?<\/table>/gi)) {
    const id = /<th\b[^>]*\bid=["']?l([0-9a-f]{4})["']?/i.exec(table)?.[1].toUpperCase();
    if (!id) continue;
    const row = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    row.exec(table); // header
    const values = [...(row.exec(table)?.[1] || "").matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (!values[1]) continue;
    const title = plain(values[1].split(/<br\s*\/?\s*>/gi).at(-1));
    if (!quests.names[id]) {
      const rank = /_gr\b|_gr\./i.test(file) ? "GR" : "HR";
      quests.names[id] = { file: file.slice(0, -4), level: `${rank} ${plain(values[0])}`, title: title || `Quest ${id}`, seasonAndTime: "", category: "" };
    } else if (quests.names[id].file === file.slice(0, -4) || !fs.existsSync(path.join(questDirectory, `${quests.names[id].file}.htm`))) {
      quests.names[id].file = file.slice(0, -4);
    }
  }
}
write("quests.json", quests);

const sources = {};
for (const rank of ranks) {
  for (const [id, text] of Object.entries(oldMonsters[rank])) {
    const rows = text.split(",").filter(Boolean).map(value => {
      const separator = value.indexOf("|");
      return { monsterId: value.slice(0, separator), detail: value.slice(separator + 1) };
    });
    (sources[id] ||= {})[rank] ||= {};
    sources[id][rank].monsters = rows;
  }
  for (const [id, text] of Object.entries(oldQuests[rank])) {
    const rows = text.split(",").filter(Boolean).map(value => {
      const reward = value.slice(6).split("%");
      return { questId: value.slice(0, 4), rewardType: parseInt(value.slice(4, 6), 16), quantity: reward[0], chance: reward[1] || null };
    });
    (sources[id] ||= {})[rank] ||= {};
    sources[id][rank].quests = rows;
  }
  for (const [id, text] of Object.entries(oldGathering[rank])) {
    const bySeason = {};
    text.split("^").forEach((season, index) => {
      bySeason[seasons[index]] = season.split(",").filter(Boolean).map(value => {
        const fields = value.split("|");
        const match = fields[3].match(/^(.*?)([hy])(\d*)$/);
        return {
          location: places[Number(fields[0])] || fields[0], mapId: placeIds[Number(fields[0])] || "",
          area: fields[1], point: fields[2], spot: match ? match[1] : fields[3],
          time: match ? (match[2] === "h" ? "Day" : "Night") : null,
          chance: match ? match[3] : null,
          night: fields.length > 4 ? { area: fields[4], point: fields[5], chance: fields[6] } : null,
          original: value // Keep unusual original notation losslessly for later refinement.
        };
      });
    });
    (sources[id] ||= {})[rank] ||= {};
    sources[id][rank].gathering = bySeason;
  }
}
write("item-sources.json", sources);

// These are useful lookup indexes, not yet complete normalized equipment/shops.
// Full stats, recipes, and unusual acquisition methods remain in archive/ferias.
write("equipment.json", {
  weaponNames: oldWeapons.Name, armorAndDecorationNames: oldArmor.Name,
  weaponMaterialsByItem: oldWeapons.Sozai, armorMaterialsByItem: oldArmor.Sozai,
  weaponGroups: { g: oldWeapons.G, sp: oldWeapons.SP, neko: oldWeapons.Neko, sinca: oldWeapons.Sinka }
});
// Weapon IDs include a weapon-type prefix. Locate the actual HTML table holding each
// record instead of guessing from its name or rank; some IDs occur in multiple files.
const weaponTypes = {
  "0": "taiken", "1": "heavy", "2": "hammer", "3": "lance", "4": "katate",
  "5": "right", "6": "souken", "7": "tachi", "8": "horn", "9": "gunlance",
  A: "yumi", B: "tonfa", C: "slaxe", D: "magspike",
  a: "taiken_partnya", c: "hammer_partnya"
};
const filenames = Object.entries(weaponTypes).sort((a, b) => b[1].length - a[1].length);
const weaponPages = {};
for (const file of fs.readdirSync(path.join(root, "archive/ferias/buki"))) {
  if (!file.endsWith(".htm")) continue;
  const type = filenames.find(([, base]) => file === `${base}.htm` || file.startsWith(`${base}_`));
  if (!type) continue;
  const html = fs.readFileSync(path.join(root, "archive/ferias/buki", file), "utf8");
  for (const [, id] of html.matchAll(/<td\s+id=["']?l([0-9a-f]{4})["']?/gi)) {
    const key = type[0] + id.toUpperCase();
    if (oldWeapons.Name[key]) (weaponPages[key] ||= []).push(file);
  }
}
for (const [key, files] of Object.entries(weaponPages)) {
  // Evolutionary/G weapons repeat their IDs for levels; store distinct files only.
  weaponPages[key] = [...new Set(files)].sort((a, b) => Number(a.endsWith("_t.htm")) - Number(b.endsWith("_t.htm")));
}
write("weapon-pages.json", weaponPages);
write("item-extras.json", {
  shopByItem: oldOther.Shop, combinationsByItem: oldOther.Cyougo, otherUsesByItem: oldOther.Riyou
});
