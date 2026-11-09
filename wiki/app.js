"use strict";

// Generated datasets live in data/; the original sources remain untouched in archive/ferias/.
let items = {};
let ids = [];
const content = document.getElementById("content");
const rankNames = { Kai: "Low Rank", Zyoui: "High Rank", Sugo: "Elite / HR5", G: "G Rank" };
const armorPieceIcons = { h: "076", b: "077", a: "078", w: "079", l: "074", H: "076", B: "077" };
const recentKey = "frontier-wiki-recent-items";
let sourceDataPromise;
const itemUsesPromises = new Map();
let itemUsesIndexPromise;
let gearUnavailablePromise;
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

function originalPage(folder, file) {
  return `https://xl3lackout.github.io/MHFZ-Ferias-English-Project/${folder}/${file}`;
}

function sectionIcon(number) {
  const img = element("img", "section-icon");
  img.src = `../assets/mhficons/tile${number}.png`;
  img.alt = "";
  return img;
}

// Decorate only stat fields, not arbitrary item names or prose containing these words.
const effectNames = { thndr: "thunder", para: "paralysis" };
const effectPattern = /\b(Fire|Water|Thunder|Thndr|Ice|Dragon|Poison|Paralysis|Para|Sleep|Stun)\b/gi;

function effectText(text) {
  const result = document.createDocumentFragment();
  let end = 0;
  for (const match of text.matchAll(effectPattern)) {
    result.append(document.createTextNode(text.slice(end, match.index)));
    const name = effectNames[match[0].toLowerCase()] || match[0].toLowerCase();
    const img = element("img", "effect-icon");
    img.src = `../assets/effects/${name}.webp`;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    result.append(img, document.createTextNode(match[0]));
    end = match.index + match[0].length;
  }
  result.append(document.createTextNode(text.slice(end)));
  return result;
}

function monsterIcon(name, path) {
  const img = element("img", "monster-icon");
  if (path) {
    img.src = `../assets/${path}`;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    return img;
  }
  const basename = name.replace(/[^\p{L}\p{N}-]/gu, "");
  if (!basename) return null;
  img.src = `../assets/monsicons/${basename}.webp`;
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("error", () => {
    const lower = basename.toLowerCase();
    if (img.src.endsWith(`/${lower}.webp`)) img.remove();
    else img.src = `../assets/monsicons/${lower}.webp`;
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
  const match = /^\/(items|quests|weapons|monsters|armor|decorations)(?:\/([a-z0-9-]+))?(?:\?(.*))?\/?$/i.exec(hash);
  if (!match || (match[1] === "items" && match[2] && match[2].length !== 4) || (match[1] === "quests" && match[2] && match[2].length !== 4) || (["weapons", "armor", "decorations"].includes(match[1].toLowerCase()) && match[2] && match[2].length !== 5)) return { section: "items", query: "" };
  const search = new URLSearchParams(match[3] || "");
  const section = match[1].toLowerCase();
  const id = ["armor", "decorations"].includes(section) ? match[2] && match[2][0] + match[2].slice(1).toUpperCase() : section === "monsters" ? match[2]?.toLowerCase() : match[2]?.toUpperCase();
  return { section, id, query: search.get("q") || "", type: search.get("type") || "", category: search.get("category") || "", rank: search.get("rank") || "", variant: search.get("variant") || "" };
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
    name.append(element("span", "", items[id].name), element("small", "", items[id].nameJa));
    row.append(sectionIcon("036"), name, element("span", "result-code", id));
    return row;
  }

  function update() {
    const q = input.value.trim().toLocaleLowerCase();
    const matches = q ? ids.filter(id => id.toLowerCase() === q || items[id].name.toLocaleLowerCase().includes(q) || items[id].nameJa.toLocaleLowerCase().includes(q)) : [];
    matches.sort((a, b) => (items[a].sortKey || "").localeCompare(items[b].sortKey || "") || a.localeCompare(b));
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

async function loadData(name) {
  const response = await fetch(`../data/${name}.json`);
  if (!response.ok) throw new Error(`Could not load data/${name}.json (${response.status})`);
  return response.json();
}

function getSources() {
  // Only load the acquisition indexes when an item detail is opened.
  if (!sourceDataPromise) {
    sourceDataPromise = Promise.all([
      loadData("item-sources"), loadData("monsters"), loadData("quests"), loadData("item-shops")
    ]).then(([byItem, monsters, quests, shops]) => ({ byItem, monsters, quests, shops })).catch(error => {
      sourceDataPromise = null;
      throw error;
    });
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

const seasonNames = ["Warm", "Cold", "Breeding"];

function gatheringTable(parent, data) {
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
  const mapStatus = element("p", "hint");
  image.addEventListener("error", () => {
    previewLink.style.display = "none";
    mapStatus.textContent = "No map image is available for this gathering point.";
  });
  previewLink.append(image);
  map.append(previewLink, mapStatus);

  seasonNames.forEach(season => {
    const tr = element("tr");
    tr.append(element("th", "", season));
    const cell = element("td");
    for (const entryData of data[season] || []) {
      const locationId = entryData.mapId;
      const entry = element("div", "gather-entry");
      entry.append(document.createTextNode(`${entryData.location} Area: ${entryData.spot} `));
      function timeLink(text, area, percentage) {
        const button = element("button", text === "Day" ? "day-link" : "night-link", text);
        button.type = "button";
        button.addEventListener("click", () => {
          if (!locationId) return;
          mapStatus.textContent = "";
          image.src = `../assets/saisyu/${locationId}-${area}.png`;
          previewLink.href = image.src;
          previewLink.setAttribute("aria-label", `Open ${entryData.location} gathering map`);
          previewLink.style.display = "block";
        });
        entry.append(button, document.createTextNode(` ${percentage || "?"}% `));
      }
      if (entryData.time) timeLink(entryData.time, entryData.area, entryData.chance);
      if (entryData.night) timeLink("Night", entryData.night.area, entryData.night.chance);
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
  const { monsters, quests, byItem, shops } = sources.data;
  sourceGroup(sources, "Shops", (shops[id] || []).map(entry => ({ name: entry.shop, detail: entry.detail })), "036");
  const tabs = element("div", "rank-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Item source rank");
  const display = element("div", "rank-content");
  const rankPanels = [];
  for (const [key, label] of Object.entries(rankNames)) {
    const group = byItem[id]?.[key] || {};
    const monsterEntries = (group.monsters || []).map(({ monsterId, detail }) => {
      return { name: monsters.names[monsterId] || monsterId, monsterName: monsters.names[monsterId], detail, href: monsters.pages?.[monsterId] ? `#/monsters/${monsters.slugs?.[monsterId] || monsterId}` : null };
    });
    const questEntries = (group.quests || []).map(({ questId, rewardType, quantity, chance }) => {
      const quest = quests.names[questId];
      if (!quest) return { name: `Quest ${questId}`, detail: "Source not named in original index" };
      const type = (quests.rewardTypes[rewardType] || "Reward").replace(/<[^>]*>/g, "");
      return { name: quest.title || `Quest ${questId}`, detail: `${type}${quantity ? ` · ${quantity}x` : ""}${chance ? ` (${chance}%)` : ""} · ID ${questId}`, href: `#/quests/${questId}` };
    });
    const gatherData = group.gathering;
    const button = element("button", "rank-tab", label);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `rank-${key}`);
    const section = element("section", "rank-panel");
    section.id = `rank-${key}`;
    section.setAttribute("role", "tabpanel");
    gatheringTable(section, gatherData);
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

function showItemUses(id, target, data, unavailable) {
  target.replaceChildren();
  const groups = [["weapons", "Weapons", "063"], ["armor", "Armor", "077"], ["decorations", "Decorations & cuffs", "044"]];
  const uses = data[id] || {};
  for (const [key, heading, icon] of groups) {
    const entries = uses[key] || [];
    if (!entries.length) continue;
    const section = element("section", "source-group");
    const title = element("h3", "", `${heading} (${entries.length.toLocaleString()})`);
    title.prepend(sectionIcon(icon));
    const list = element("ul", "source-list");
    if (entries.length > 100) {
      list.tabIndex = 0;
      list.setAttribute("aria-label", `${heading} made from this item`);
    }
    let shown = 0;
    const progress = element("p", "hint");
    function appendBatch() {
      const batch = document.createDocumentFragment();
      for (const entry of entries.slice(shown, shown + 100)) {
        const row = element("li");
        if (key === "armor" && armorPieceIcons[entry.id[0]]) row.append(sectionIcon(armorPieceIcons[entry.id[0]]));
        if (key === "weapons" && !entry.nameMissing && /^[0-9A-D]/.test(entry.id)) row.append(link(entry.name, `#/weapons/${entry.id}`));
        else if (key !== "weapons" && !entry.nameMissing && !unavailable.has(entry.id)) row.append(link(entry.name, `#/${key === "armor" ? "armor" : "decorations"}/${entry.id}`));
        else row.append(element("span", "", entry.name));
        const details = [entry.craft, entry.level && (entry.level === "Base" ? "Base" : `Lv ${entry.level}`), `× ${entry.quantity}`, entry.nameMissing && "Name unavailable in source"].filter(Boolean);
        row.append(element("small", "", ` · ${details.join(" · ")}`));
        batch.append(row);
      }
      list.append(batch);
      shown = Math.min(shown + 100, entries.length);
      progress.textContent = shown < entries.length ? `Showing ${shown.toLocaleString()} of ${entries.length.toLocaleString()} · scroll for more` : "";
    }
    list.addEventListener("scroll", () => {
      if (shown < entries.length && list.scrollTop + list.clientHeight >= list.scrollHeight - 120) appendBatch();
    });
    appendBatch();
    section.append(title, list, progress);
    target.append(section);
  }
  if (!target.children.length) target.append(element("p", "empty", "No equipment uses recorded for this item."));
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
  const title = element("h1", "item-title", item.name);
  title.prepend(sectionIcon("036"));
  content.append(title, element("p", "muted", `${item.nameJa} · Item ${id}`));
  const panel = element("section", "panel");
  panel.append(element("h2", "", "Item details"), element("p", "", item.description || "No description available."));
  const facts = element("dl", "facts");
  for (const [label, value] of [["ID", id], ["Rarity", item.rarity], ["Price", item.price], ["Stack", item.stack], ["Required rank", requirement(item.requiredRank)]]) {
    const fact = element("div");
    fact.append(element("dt", "", label), element("dd", "", String(value)));
    facts.append(fact);
  }
  panel.append(facts);
  panel.append(element("p", "hint", "Combination recipes and other special uses have not yet been migrated."));
  const actions = element("div", "actions");
  actions.append(link("View remaining original item details ↗", originalPage("sozai", `sozai.htm?${id}`)));
  panel.append(actions);
  const layout = element("div", "item-detail-layout");
  const main = element("div");
  main.append(panel, element("h2", "section-head", "Where to find it"));
  const sources = element("div", "", "Loading sources…");
  main.append(sources);
  const usesSection = element("section", "panel");
  usesSection.append(element("h2", "", "Used to make"));
  const usesTarget = element("div", "", "Loading equipment uses…");
  usesSection.append(usesTarget);
  layout.append(main, usesSection);
  content.append(layout);
  async function loadUses() {
    try {
      if (!itemUsesIndexPromise) itemUsesIndexPromise = loadData("item-uses/index").catch(error => {
        itemUsesIndexPromise = null;
        throw error;
      });
      if (!gearUnavailablePromise) gearUnavailablePromise = loadData("gear-unavailable").then(ids => new Set(ids)).catch(error => {
        gearUnavailablePromise = null;
        throw error;
      });
      const [available, unavailable] = await Promise.all([itemUsesIndexPromise, gearUnavailablePromise]);
      const prefix = available.includes(id) ? id : id.slice(0, 3);
      if (!available.includes(prefix)) {
        if (version === routeVersion) showItemUses(id, usesTarget, {}, unavailable);
        return;
      }
      if (!itemUsesPromises.has(prefix)) itemUsesPromises.set(prefix, loadData(`item-uses/${prefix}`).catch(error => {
        itemUsesPromises.delete(prefix);
        throw error;
      }));
      const data = await itemUsesPromises.get(prefix);
      if (version === routeVersion) showItemUses(id, usesTarget, data, unavailable);
    } catch (error) {
      if (version === routeVersion) {
        usesTarget.textContent = "Could not load equipment uses. Please reload and try again.";
      }
      console.error(error);
    }
  }
  loadUses();
  try {
    sources.data = await getSources();
    if (version === routeVersion) showSources(id, sources);
  } catch (error) {
    if (version === routeVersion) sources.textContent = "Could not load item sources. Please reload and try again.";
    console.error(error);
  }
}

function render() {
  ++routeVersion;
  const current = route();
  document.querySelector(".topbar-right").textContent = `${current.section[0].toUpperCase()}${current.section.slice(1)} database`;
  for (const nav of document.querySelectorAll(".nav-item[data-section]")) {
    const active = nav.dataset.section === current.section;
    nav.classList.toggle("active", active);
    if (active) nav.setAttribute("aria-current", "page");
    else nav.removeAttribute("aria-current");
  }
  if (current.section === "monsters") {
    monsterPage(current);
  } else if (current.section === "armor" || current.section === "decorations") {
    gearPage(current);
  } else if (current.section !== "items") {
    catalogPage(current);
  } else {
    document.title = current.id && items[current.id] ? `${items[current.id].name} · Frontier Wiki` : "Items · Frontier Wiki";
    if (current.id) detailPage(current.id);
    else listPage(current.query);
  }
}

window.addEventListener("hashchange", render);
loadData("items").then(data => {
  items = data;
  ids = Object.keys(items).filter(id => items[id].name);
  render();
}).catch(error => {
  content.textContent = "Could not load item data. Serve the repository root with node wiki/dev-server.js and try again.";
  console.error(error);
});
