// Download the matching element and ailment icons from the Monster Hunter Wiki.
// Source: https://monsterhunter.fandom.com/wiki/Status_Effects
const fs = require("node:fs");
const path = require("node:path");

const files = {
  fire: "StatusEffect-Fire.jpg",
  water: "StatusEffect-Water.jpg",
  thunder: "StatusEffect-Thunder.jpg",
  ice: "StatusEffect-Ice.jpg",
  dragon: "StatusEffect-Dragon.jpg",
  poison: "StatusEffect-Poison.png",
  paralysis: "StatusEffect-Para.png",
  sleep: "StatusEffect-Sleep.png",
  stun: "StatusEffect-KO.png"
};
const destination = path.resolve(__dirname, "../assets/effects");
fs.mkdirSync(destination, { recursive: true });

async function main() {
  const url = new URL("https://monsterhunter.fandom.com/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", titles: Object.values(files).map(name => `File:${name}`).join("|"), prop: "imageinfo", iiprop: "url" }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wiki API: ${response.status}`);
  const pages = Object.values((await response.json()).query.pages);
  const sources = new Map(pages.filter(page => page.imageinfo?.[0]).map(page => [page.title.slice(5).replaceAll(" ", "_"), page.imageinfo[0].url]));
  for (const [name, file] of Object.entries(files)) {
    const source = sources.get(file);
    if (!source) throw new Error(`Missing icon on wiki: ${file}`);
    const image = new URL(source);
    const original = `${image.host}${image.pathname.replace(/\/revision\/.*$/, "")}`;
    const proxy = `https://wsrv.nl/?url=${encodeURIComponent(original)}&output=webp&w=64`;
    const result = await fetch(proxy);
    if (!result.ok) throw new Error(`Could not download ${file}: ${result.status}`);
    const bytes = Buffer.from(await result.arrayBuffer());
    if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error(`Invalid icon: ${file}`);
    fs.writeFileSync(path.join(destination, `${name}.webp`), bytes);
  }
  console.log(`Downloaded ${Object.keys(files).length} element/status icons to assets/effects/`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
