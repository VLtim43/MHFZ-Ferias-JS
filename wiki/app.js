"use strict";

// The original files remain the source of truth. Item IDs are stable, unlike names or ranks.
const items = setItem();
const japaneseItems = setItemJP();
const ids = Object.keys(items).filter(id => items[id][0] && japaneseItems[id]);
const content = document.getElementById("content");
const rankNames = { Kai: "Low Rank", Zyoui: "High Rank", Sugo: "HR100 / Elite", G: "G Rank" };
const recentKey = "frontier-wiki-recent-items";
let sourceDataPromise;
let routeVersion = 0;

function recentItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(recentKey));
    return Array.isArray(saved) ? saved.filter(id => typeof id === "string" && items[id]).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function rememberItem(id) {
  try {
    localStorage.setItem(recentKey, JSON.stringify([id, ...recentItems().filter(recent => recent !== id)].slice(0, 12)));
  } catch {
    // The wiki still works when browser storage is disabled.
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(label, href, className) {
  const node = element("a", className, label);
  node.href = href;
  return node;
}

function sectionIcon(number) {
  const img = element("img", "section-icon");
  img.src = `../img/mhficons/tile${number}.png`;
  img.alt = "";
  return img;
}

function monsterIcon(name) {
  const img = element("img", "monster-icon");
  const basename = name.replace(/[^\p{L}\p{N}-]/gu, "");
  if (!basename) return null;
  img.src = `../img/monsicons/${basename}.webp`;
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("error", () => {
    const lower = basename.toLowerCase();
    if (img.src.endsWith(`/${lower}.webp`)) img.remove();
    else img.src = `../img/monsicons/${lower}.webp`;
  });
  return img;
}

function requirement(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number >= 5000) return "Not listed";
  if (number >= 3000) return `GSR ${number - 3000}`;
  if (number >= 2000) return `GR ${number - 2000}`;
  if (number >= 1000) return `SR ${number - 1000}`;
  return `HR ${number}`;
}

function route() {
  const hash = location.hash.slice(1);
  const match = /^\/items\/([0-9a-f]{4})\/?$/i.exec(hash);
  return match ? { id: match[1].toUpperCase() } : { query: hash.startsWith("/items?") ? new URLSearchParams(hash.slice(7)).get("q") || "" : "" };
}

function listPage(query) {
  content.replaceChildren();
  const intro = element("div", "intro");
  intro.append(element("h1", "", "Items"), element("p", "muted", "Search the original item database by name or item ID. English and Japanese names are supported."));
  const input = element("input", "search");
  input.type = "search";
  input.placeholder = "Search items, e.g. Rathian Scale, Potion, 0188…";
  input.setAttribute("aria-label", "Search items");
  input.autocomplete = "off";
  input.value = query;
  const tools = element("div", "search-tools");
  const count = element("span", "hint");
  tools.append(count, element("span", "hint", "Select an item for a shareable link"));
  const results = element("div", "results");
  content.append(intro, input, tools, results);

  function itemCard(id) {
    const row = link("", `#/items/${id}`, "result");
    const name = element("span");
    name.append(element("span", "", items[id][0]), element("small", "", japaneseItems[id][0]));
    row.append(sectionIcon("036"), name, element("span", "result-code", id));
    return row;
  }

  function update() {
    const q = input.value.trim().toLocaleLowerCase();
    const matches = q ? ids.filter(id => id.toLowerCase() === q || items[id][0].toLocaleLowerCase().includes(q) || japaneseItems[id][0].toLocaleLowerCase().includes(q)) : [];
    matches.sort((a, b) => (items[a][5] || "").localeCompare(items[b][5] || "") || a.localeCompare(b));
    const visible = matches.slice(0, 100);
    count.textContent = q ? `${matches.length.toLocaleString()} item${matches.length === 1 ? "" : "s"}${matches.length > 100 ? " · showing first 100; refine your search" : ""}` : "Enter a name or item ID to search.";
    results.replaceChildren();
    if (q && !matches.length) results.append(element("p", "empty", "No matching items. Try another name or a four-digit item ID."));
    if (!q) {
      const recent = recentItems();
      if (recent.length) {
        results.append(element("h2", "recent-heading", "Recently opened items"));
        const grid = element("div", "results");
        for (const id of recent) grid.append(itemCard(id));
        results.append(grid);
      }
    } else {
      for (const id of visible) results.append(itemCard(id));
    }
    const next = `#/items${q ? `?q=${encodeURIComponent(input.value.trim())}` : ""}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }
  input.addEventListener("input", update);
  update();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(script);
  });
}

function getSources() {
  // Only load the extra indexes when an item detail is opened.
  if (!sourceDataPromise) {
    sourceDataPromise = Promise.all([
      loadScript("../sozai/mos_sozai.js"),
      loadScript("../sozai/que_sozai.js"),
      loadScript("../sozai/sai_sozai.js")
    ]).then(() => ({ monsters: setMonster(), quests: setQuest(), gathering: setSaisyu() }));
  }
  return sourceDataPromise;
}

function sourceGroup(parent, name, entries, icon) {
  if (!entries.length) return;
  const group = element("section", "source-group");
  const heading = element("h3", "", name);
  if (icon) heading.prepend(sectionIcon(icon));
  group.append(heading);
  const list = element("ul", "source-list");
  for (const entry of entries) {
    const row = element("li");
    if (entry.monsterName) {
      const image = monsterIcon(entry.monsterName);
      if (image) row.append(image);
    }
    if (entry.href) row.append(link(entry.name, entry.href));
    else row.append(element("span", "", entry.name));
    if (entry.detail) row.append(element("small", "", ` · ${entry.detail}`));
    list.append(row);
  }
  group.append(list);
  parent.append(group);
}

const placeNames = ["General", "Jungle", "Desert", "Swamp", "Snowy Mountains", "Volcano", "Forest and Hills", "Tower", "Great Forest", "Interception Base", "Fortress", "Town", "Battleground", "Arena", "Gorge", "Solitude Island", "Highlands", "Tidal Island", "Polar Sea", "Flower Field", "White Lake", "Painted Falls"];
const placeIds = ["", "mitu", "saba", "numa", "yuki", "kaza", "mori", "tou", "zyu", "def", "toride", "siro", "kessen", "tougi", "kyou", "sima", "kou", "shio", "kyoku", "hana", "bya", "sai"];
const seasonNames = ["Warm", "Cold", "Breeding"];
const rankIds = { Kai: "kai", Zyoui: "zyoui", Sugo: "sugo", G: "g" };

function gatheringTable(parent, data, rank) {
  if (!data) return;
  const section = element("section", "source-group");
  const heading = element("h3", "", "Gathering");
  heading.prepend(sectionIcon("017"));
  section.append(heading);
  const layout = element("div", "gathering-layout");
  const table = element("table", "data-table gathering-table");
  const map = element("div", "map-preview");
  map.append(element("p", "hint", "Click Day or Night to view the map.\nWhite = Gathering · Red = Mining\nYellow = Insects · Blue = Fishing"));
  const previewLink = link("", "#", "map-link");
  const image = element("img");
  image.alt = "Gathering area map";
  previewLink.append(image);
  map.append(previewLink);

  const seasons = data.split("^");
  seasons.forEach((season, index) => {
    const tr = element("tr");
    tr.append(element("th", "", seasonNames[index]));
    const cell = element("td");
    for (const value of season.split(",").filter(Boolean)) {
      const fields = value.split("|");
      const locationId = placeIds[Number(fields[0])];
      const entry = element("div", "gather-entry");
      entry.append(document.createTextNode(`${placeNames[Number(fields[0])] || fields[0]} Area: ${fields[3].split(/[hy]/)[0]} `));
      function timeLink(text, area, point, percentage) {
        const button = element("button", text === "Day" ? "day-link" : "night-link", text);
        button.type = "button";
        button.addEventListener("click", () => {
          if (!locationId) return;
          image.src = `../img/saisyu/${locationId}-${area}.png`;
          previewLink.href = `../saisyu/${locationId}-${rankIds[rank]}.htm#l${point}`;
          previewLink.style.display = "block";
        });
        entry.append(button, document.createTextNode(` ${percentage || "?"}% `));
      }
      const firstTime = fields[3].match(/([hy])(\d*)$/);
      if (firstTime) timeLink(firstTime[1] === "h" ? "Day" : "Night", fields[1], fields[2], firstTime[2]);
      else entry.append(document.createTextNode(fields[3]));
      if (fields.length > 4) timeLink("Night", fields[4], fields[5], fields[6]);
      cell.append(entry);
    }
    tr.append(cell);
    table.append(tr);
  });
  layout.append(table, map);
  section.append(layout);
  parent.append(section);
}

function showSources(id, sources) {
  sources.replaceChildren();
  const { monsters, quests, gathering } = sources.data;
  const tabs = element("div", "rank-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Item source rank");
  const display = element("div", "rank-content");
  const rankPanels = [];
  for (const [key, label] of Object.entries(rankNames)) {
    const monsterEntries = (monsters[key][id] || "").split(",").filter(Boolean).map(value => {
      const [monsterId, detail] = value.split("|");
      return { name: monsters.Name[monsterId] || monsterId, monsterName: monsters.Name[monsterId], detail, href: `../mons/${monsterId}_h.htm` };
    });
    const questEntries = (quests[key][id] || "").split(",").filter(Boolean).map(value => {
      const questId = value.slice(0, 4);
      const quest = quests.Name[questId];
      if (!quest) return { name: `Quest ${questId}`, detail: value.slice(4) };
      const parts = quest.split(",");
      const reward = value.slice(6).split("%");
      const rewardType = (quests.Htype[parseInt(value.slice(4, 6), 16)] || "Reward").replace(/<[^>]*>/g, "");
      const amount = reward[0] ? ` · ${reward[0]}x` : "";
      const chance = reward[1] ? ` (${reward[1]}%)` : "";
      return { name: parts.slice(4).join(",") || `Quest ${questId}`, detail: `${rewardType}${amount}${chance} · ID ${questId}`, href: `../quest/${parts[0]}.htm#l${questId}` };
    });
    const gatherData = gathering[key][id];
    const button = element("button", "rank-tab", label);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `rank-${key}`);
    const section = element("section", "rank-panel");
    section.id = `rank-${key}`;
    section.setAttribute("role", "tabpanel");
    gatheringTable(section, gatherData, key);
    sourceGroup(section, "Quest rewards", questEntries, "038");
    sourceGroup(section, "Monster drops / carves / capture", monsterEntries, "024");
    if (!gatherData && !questEntries.length && !monsterEntries.length) section.append(element("p", "empty", "No gathering, quest, or monster sources recorded for this rank."));
    rankPanels.push({ button, section, hasData: Boolean(gatherData || questEntries.length || monsterEntries.length) });
    tabs.append(button);
  }
  function select(rank) {
    for (const [index, { button, section }] of rankPanels.entries()) {
      const active = index === rank;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      section.hidden = !active;
    }
  }
  for (const [index, entry] of rankPanels.entries()) {
    display.append(entry.section);
    entry.button.addEventListener("click", () => select(index));
    entry.button.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const next = (index + (event.key === "ArrowRight" ? 1 : rankPanels.length - 1)) % rankPanels.length;
      select(next);
      rankPanels[next].button.focus();
      event.preventDefault();
    });
  }
  sources.append(tabs, display);
  select(Math.max(0, rankPanels.findIndex(entry => entry.hasData)));
}

async function detailPage(id) {
  const item = items[id];
  content.replaceChildren();
  if (!item) {
    content.append(link("← Items", "#/items", "breadcrumbs"), element("h1", "", "Item not found"), element("p", "muted", `No item with ID ${id} exists in the original database.`));
    return;
  }
  rememberItem(id);
  const version = ++routeVersion;
  content.append(link("← All items", "#/items", "breadcrumbs"));
  const title = element("h1", "item-title", item[0]);
  title.prepend(sectionIcon("036"));
  content.append(title, element("p", "muted", `${japaneseItems[id][0]} · Item ${id}`));
  const panel = element("section", "panel");
  panel.append(element("h2", "", "Item details"), element("p", "", item[6] || "No description available."));
  const facts = element("dl", "facts");
  for (const [label, value] of [["ID", id], ["Rarity", item[1]], ["Price", item[2]], ["Stack", item[3]], ["Required rank", requirement(item[4])]]) {
    const fact = element("div");
    fact.append(element("dt", "", label), element("dd", "", String(value)));
    facts.append(fact);
  }
  panel.append(facts);
  const actions = element("div", "actions");
  actions.append(link("View original item page ↗", `../sozai/sozai.htm?${id}`));
  panel.append(actions);
  content.append(panel, element("h2", "section-head", "Where to find it"));
  const sources = element("div", "", "Loading sources…");
  content.append(sources);
  try {
    sources.data = await getSources();
    if (version === routeVersion) showSources(id, sources);
  } catch (error) {
    if (version === routeVersion) sources.textContent = "Could not load item sources. The original item page is still available above.";
    console.error(error);
  }
}

function render() {
  ++routeVersion;
  const current = route();
  document.title = current.id && items[current.id] ? `${items[current.id][0]} · Frontier Wiki` : "Items · Frontier Wiki";
  if (current.id) detailPage(current.id);
  else listPage(current.query);
}

window.addEventListener("hashchange", render);
render();
