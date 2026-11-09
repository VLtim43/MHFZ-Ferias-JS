// One-time (and repeatable) Fandom import. Run after build-data.js.
// Source: https://monsterhunter.fandom.com/wiki/Category:Frontier_Monsters
// Images are downloaded locally; no Fandom requests are made by wiki visitors.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(__dirname, "monster-art.json");
const manifest = require(manifestPath);
const monsters = require(path.join(root, "data/monsters.json"));
const folder = path.join(root, "assets/monster-art");
fs.mkdirSync(folder, { recursive: true });

const aliases = {
  espsiro: "Espinas Rare Species", espcya: "Flaming Espinas", miraru: "White Fatalis", mira: "Fatalis",
  dolem1: "Duremudira", dolem2: "Duremudira", dolem: "Arrogant Duremudira",
  bogak: "Bombardier Boggerbadorme", nalgak: "Blinking Nargacuga",
  zeruk: "Sparkling Zerureusu", joek: "Starving Deviljho",
  lavieg: "Berserk Laviente", volaka: "Lavasioth Subspecies",
  geryoao: "Purple Gypceros", reusugin: "Silver Rathalos",
  reiakin: "Gold Rathian", hipuao: "Breeding Season Hypnocatrice"
};
// These category thumbnails are screenshots, not the available official renders.
const renderOverrides = {
  kukku: "MHWilds-Yian_Kut-Ku_Render_001.png",
  qual: "FrontierGen-Kuarusepusu_Render_001.png",
  reia: "MHRise-Rathian_Render_001.png"
};
const iconOverrides = {
  akamu: "MH4U-Akantor_Icon.png", mira: "MHWI-Fatalis_Icon.png", miraru: "MHFU-Question_Mark_Icon.png",
  boga: "FrontierGen-Bogabadorumu_Icon.png", elze: "FrontierGen-Eruzerion_Icon.png"
};
const key = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const api = async params => {
  const url = new URL("https://monsterhunter.fandom.com/api.php");
  for (const [name, value] of Object.entries({ action: "query", format: "json", ...params })) url.searchParams.set(name, value);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const data = await response.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      return data.query;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
};
const batches = (array, size) => Array.from({ length: Math.ceil(array.length / size) }, (_, index) => array.slice(index * size, (index + 1) * size));

async function download(source, filename, force = false) {
  const destination = path.join(folder, filename);
  if (!force && fs.existsSync(destination)) return true;
  // Wikia's image CDN rejects direct requests from build environments. wsrv
  // fetches the original URL and returns a resized, locally stored WebP.
  const imageUrl = new URL(source);
  const original = `${imageUrl.host}${imageUrl.pathname.replace(/\/revision\/.*$/, "")}`;
  const url = `https://wsrv.nl/?url=${encodeURIComponent(original)}&output=webp&w=800`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error(`Invalid WebP: ${source}`);
      fs.writeFileSync(destination, bytes);
      return true;
    } catch (error) {
      if (attempt === 2) console.warn(`Could not download ${filename}: ${error.message}`);
    }
  }
  return false;
}

async function main() {
  const category = await api({ list: "categorymembers", cmtitle: "Category:Frontier_Monsters", cmtype: "page", cmlimit: "max" });
  const titles = new Map(category.categorymembers.map(page => [key(page.title), page.title]));
  const included = Object.keys(monsters.pages).filter(id => !manifest.exclude.includes(id));
  const entries = included.map(id => [id, titles.get(key(aliases[id] || manifest.names[id] || monsters.names[id]))]).filter(([, title]) => title);
  const missing = included.filter(id => !entries.some(([found]) => found === id));
  console.log(`Matched ${entries.length} monsters; no category match: ${missing.map(id => `${id} (${monsters.names[id]})`).join(", ")}`);
  manifest.pages = Object.fromEntries(entries);
  for (const id of manifest.exclude) delete manifest.art[id];
  // Disufiroa has a wiki page, but is absent from the category and has no render.
  const disufiroa = await api({ titles: "Disufiroa" });
  if (Object.values(disufiroa.pages).some(page => page.title === "Disufiroa" && page.missing === undefined)) manifest.pages.disf = "Disufiroa";

  const renders = new Map();
  for (const batch of batches([...new Set(entries.map(([, title]) => title))], 40)) {
    const result = await api({ titles: batch.join("|"), prop: "pageimages", piprop: "original" });
    for (const page of Object.values(result.pages)) if (page.original?.source) renders.set(page.title, page.original.source);
  }
  const overrideFiles = [...Object.values(renderOverrides), ...Object.values(iconOverrides)];
  const overrideImages = await api({ titles: overrideFiles.map(name => `File:${name}`).join("|"), prop: "imageinfo", iiprop: "url" });
  const overrideUrls = new Map(Object.values(overrideImages.pages).filter(page => page.imageinfo?.[0]).map(page => [page.title.slice(5).replace(/ /g, "_"), page.imageinfo[0].url]));
  for (const [id, filename] of Object.entries(renderOverrides)) {
    const source = overrideUrls.get(filename);
    if (!source) throw new Error(`Missing replacement render: ${filename}`);
    renders.set(entries.find(([entryId]) => entryId === id)[1], source);
  }
  const iconNames = [...new Set(entries.flatMap(([, title]) => [`FrontierGen-${title} Icon.png`, `${title} Icon.png`]))];
  const icons = new Map();
  for (const batch of batches(iconNames, 40)) {
    const result = await api({ titles: batch.map(name => `File:${name}`).join("|"), prop: "imageinfo", iiprop: "url" });
    for (const page of Object.values(result.pages)) if (page.imageinfo?.[0]?.url) icons.set(page.title.slice(5), page.imageinfo[0].url);
  }
  for (const [id, filename] of Object.entries(iconOverrides)) {
    const source = overrideUrls.get(filename);
    if (!source) throw new Error(`Missing replacement icon: ${filename}`);
    icons.set(`FrontierGen-${entries.find(([entryId]) => entryId === id)[1]} Icon.png`, source);
  }
  // API normalizes spaces and underscores in File: titles.
  const findIcon = title => icons.get(`FrontierGen-${title} Icon.png`) || icons.get(`${title} Icon.png`);
  const work = entries.flatMap(([id, title]) => [
    { id, kind: "render", source: renders.get(title) },
    { id, kind: "icon", source: findIcon(title) }
  ]).filter(job => job.source);
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < work.length) {
      const { id, kind, source } = work[cursor++];
      const filename = `${id}-${kind}.webp`;
      if (await download(source, filename, kind === "render" && id in renderOverrides)) (manifest.art[id] ||= {})[kind] = `monster-art/${filename}`;
    }
  }));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Imported ${Object.keys(manifest.art).length} monsters; no render: ${entries.filter(([id]) => !manifest.art[id]?.render).map(([id]) => id).join(", ")}; no icon: ${entries.filter(([id]) => !manifest.art[id]?.icon).map(([id]) => id).join(", ")}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
