"use strict";

const monsterVariantOrder = ["n", "nh", "ng", "ni", "nt"];
let monstersPromise;
const monsterDetailPromises = new Map();

function monsterData() {
  return monstersPromise ||= loadData("monsters");
}

function monsterDetails(id) {
  if (!monsterDetailPromises.has(id)) monsterDetailPromises.set(id, loadData(`monster-details/${id}`).catch(error => {
    monsterDetailPromises.delete(id);
    throw error;
  }));
  return monsterDetailPromises.get(id);
}

function monsterPage(current) {
  const version = routeVersion;
  content.replaceChildren(element("p", "hint", "Loading monsters…"));
  monsterData().then(data => {
    if (version !== routeVersion) return;
    if (current.id) monsterDetail(current, data, version);
    else monsterList(current, data);
  }).catch(error => {
    if (version === routeVersion) content.replaceChildren(element("p", "empty", "Could not load monsters. Please try again."));
    console.error(error);
  });
}

function monsterList(current, data) {
  document.title = "Monsters · Frontier Wiki";
  content.replaceChildren(element("h1", "", "Monsters"), element("p", "muted", "Search Ferias monsters by name or original ID. Select a monster to explore its variants, hitzones and drops."));
  const input = element("input", "search");
  input.type = "search";
  input.setAttribute("aria-label", "Search monsters");
  input.placeholder = "Search monsters, e.g. Espinas, Rathian…";
  input.value = current.query;
  const count = element("p", "hint");
  const results = element("div", "results");
  content.append(input, count, results);
  function update() {
    const query = input.value.trim().toLocaleLowerCase();
    const matches = Object.entries(data.names).filter(([id, name]) => data.pages[id] && (!query || id.toLocaleLowerCase().includes(query) || name.toLocaleLowerCase().includes(query)));
    matches.sort((a, b) => a[1].localeCompare(b[1]));
    count.textContent = `${matches.length} monsters`;
    results.replaceChildren();
    for (const [id, name] of matches) {
      const card = link("", `#/monsters/${data.slugs?.[id] || id}`, "result monster-card");
      const icon = monsterIcon(name);
      if (icon) card.append(icon);
      const text = element("span", "", name);
      text.append(element("small", "", monsterVariantOrder.filter(key => data.pages[id][key]).map(key => data.statLabels?.[id]?.[key] || key).join(" · ") || "Carves"));
      card.append(text);
      results.append(card);
    }
    const hash = `#/monsters${query ? `?q=${encodeURIComponent(input.value.trim())}` : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  input.addEventListener("input", update);
  update();
}

function monsterUrl(id, variant, rank) {
  const params = new URLSearchParams();
  if (variant) params.set("variant", variant);
  if (rank) params.set("rank", rank);
  return `#/monsters/${id}${params.size ? `?${params}` : ""}`;
}

// Ferias tables are HTML, not trusted application markup. Copy only presentational
// elements and convert item links into wiki links; scripts and inline handlers stay out.
function monsterMarkup(source) {
  const result = document.createDocumentFragment();
  const allowed = new Set(["BR", "B", "I", "EM", "STRONG", "SMALL", "SPAN", "DIV", "UL", "LI", "SUP", "SUB"]);
  for (const child of source.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) result.append(document.createTextNode(child.nodeValue));
    else if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === "A") {
        const id = /(?:^|\/)sozai\.htm\?([0-9a-f]{4})/i.exec(child.getAttribute("href") || "")?.[1].toUpperCase();
        if (id && items[id]) result.append(link(child.textContent, `#/items/${id}`));
        else result.append(document.createTextNode(child.textContent));
      } else if (allowed.has(child.tagName)) {
        const node = document.createElement(child.tagName.toLowerCase());
        if (child.tagName === "LI" && child.classList.contains("t")) node.className = "t";
        node.append(monsterMarkup(child));
        result.append(node);
      }
    }
  }
  return result;
}

function monsterTable(source) {
  const wrapper = element("div", "monster-table-wrap");
  const table = element("table", "data-table monster-table");
  for (const original of source.rows) {
    if (source.id === "izyo" && ([...original.cells].some(cell => cell.querySelector("table")) || original.textContent.trim().startsWith("Item Drops"))) continue;
    const row = element("tr");
    for (const cell of original.cells) {
      const target = element(cell.tagName.toLowerCase());
      target.colSpan = cell.colSpan;
      target.rowSpan = cell.rowSpan;
      target.append(monsterMarkup(cell));
      row.append(target);
    }
    table.append(row);
  }
  wrapper.append(table);
  return wrapper;
}

function monsterSection(title, node) {
  const panel = element("section", "panel monster-section");
  panel.append(element("h2", "", title), node);
  return panel;
}

function monsterImagePath(path, description) {
  if (!/^mons(?:icons|zones)\/[\w.-]+\.(?:png|webp|gif)$/i.test(path)) return null;
  const image = element("img", "monster-art");
  image.src = `../assets/${path}`;
  image.alt = description;
  image.loading = "lazy";
  image.addEventListener("error", () => image.remove());
  return image;
}

function showMonsterStats(doc, target, heading, images, fallback, variantLabel) {
  target.replaceChildren();
  heading.querySelector(".monster-art")?.remove();
  const artwork = (images?.icon || fallback) && monsterImagePath(images?.icon || fallback, `${heading.querySelector("h1").textContent} illustration`);
  if (artwork) {
    artwork.classList.add("monster-hero-art");
    heading.prepend(artwork);
  }
  const status = doc.querySelector("table#izyo");
  const diagram = images?.hitzones && monsterImagePath(images.hitzones, `${variantLabel} monster part-zone diagram`);
  if (status && diagram) {
    const layout = element("div", "monster-stats-layout");
    const statusPanel = monsterSection("Status resistance & enrage", monsterTable(status));
    statusPanel.classList.add("monster-status-panel");
    const figure = element("figure", "monster-diagram");
    figure.append(diagram, element("figcaption", "hint", `${variantLabel} part zones`));
    layout.append(statusPanel, figure);
    target.append(layout);
  } else {
    if (status) target.append(monsterSection("Status resistance & enrage", monsterTable(status)));
    if (diagram) target.append(diagram);
  }
  const hitzones = doc.querySelector("table#niku");
  if (hitzones) target.append(monsterSection("Hitzones", monsterTable(hitzones)));
  const breaks = doc.querySelector("table#down");
  if (breaks) target.append(monsterSection("Stagger resistance & part breaks", monsterTable(breaks)));
  if (!target.children.length) target.append(element("p", "empty", "No stat tables are recorded for this variant."));
}

function showMonsterDrops(doc, target, selected, onRank, expectedRanks) {
  target.replaceChildren();
  const original = doc.querySelector("table");
  const header = original?.rows[1];
  if (!header || header.cells.length < 2) {
    target.append(element("p", "empty", "No carve or drop ranks are recorded."));
    return;
  }
  const ranks = [...header.cells].slice(1).map(cell => cell.textContent.trim());
  if (expectedRanks && ranks.join("\u0000") !== expectedRanks.join("\u0000")) {
    target.append(element("p", "empty", "The archived drop ranks do not match the generated index. Regenerate the wiki data before using this table."));
    return;
  }
  const rank = ranks.includes(selected) ? selected : ranks[0];
  const tabs = element("div", "rank-tabs monster-ranks");
  for (const name of ranks) {
    const tab = link(name, onRank(name), "monster-rank-tab");
    if (name === rank) { tab.classList.add("selected"); tab.setAttribute("aria-current", "true"); }
    tabs.append(tab);
  }
  target.append(tabs);
  const table = element("table", "data-table monster-drop-table");
  const head = element("tr");
  head.append(element("th", "", "Source"), element("th", "", `${rank} items and chances`));
  table.append(head);
  const index = ranks.indexOf(rank) + 1;
  for (const row of [...original.rows].slice(2)) {
    const source = row.cells[0];
    const drops = row.cells[index];
    if (!source || !drops || !drops.textContent.trim()) continue;
    const result = element("tr");
    const label = element("th");
    label.append(monsterMarkup(source));
    const itemsCell = element("td");
    itemsCell.append(monsterMarkup(drops));
    result.append(label, itemsCell);
    table.append(result);
  }
  if (table.rows.length === 1) target.append(element("p", "hint", `No drops listed for ${rank}.`));
  else {
    const wrap = element("div", "monster-table-wrap");
    wrap.append(table);
    target.append(wrap);
  }
}

async function monsterDetail(current, data, version) {
  const id = Object.keys(data.pages).find(key => data.slugs?.[key] === current.id) || current.id;
  const name = data.names[id];
  const pages = data.pages[id];
  content.replaceChildren(link("← Monsters", "#/monsters", "breadcrumbs"));
  if (!name || !pages) { content.append(element("h1", "", "Monster not found")); return; }
  const slug = data.slugs?.[id] || id;
  document.title = `${name} · Frontier Wiki`;
  const variants = monsterVariantOrder.filter(key => pages[key]);
  const variant = variants.includes(current.variant) ? current.variant : variants[0];
  const rank = data.dropRanks?.[id]?.includes(current.rank) ? current.rank : "";
  if (current.id !== slug || current.variant && current.variant !== variant || current.rank && !rank) {
    history.replaceState(null, "", monsterUrl(slug, variant, rank));
  }
  const heading = element("div", "monster-heading");
  const icon = monsterIcon(name);
  if (icon) heading.append(icon);
  heading.append(element("h1", "", name));
  content.append(heading, element("p", "muted", `Ferias monster · ${id}`));
  if (variants.length) {
    content.append(element("p", "hint", "Stats & hitzones — these variants are separate from the carve/drop ranks below."));
    const tabs = element("nav", "rank-tabs monster-variants");
    tabs.setAttribute("aria-label", "Monster stat variant");
    for (const key of variants) {
      const tab = link(data.statLabels?.[id]?.[key] || key, monsterUrl(slug, key, rank), "monster-rank-tab");
      if (key === variant) { tab.classList.add("selected"); tab.setAttribute("aria-current", "page"); }
      tabs.append(tab);
    }
    content.append(tabs);
  }
  const actions = element("p", "actions");
  if (variant) actions.append(link("Original stat page ↗", originalPage("mons", pages[variant])));
  if (pages.h) actions.append(link("Original carves ↗", originalPage("mons", pages.h)));
  content.append(actions);
  const stats = element("div", "", "Loading monster stats…");
  if (variant) content.append(stats);
  if (pages.h) {
    const drops = element("div", "", "Loading carves and drops…");
    content.append(element("h2", "section-head", "Carves & drops"),
      element("p", "hint", "These are reward-table ranks from Ferias, not stat variants. For example, Henshu stats and Elite drops are different categories."), drops);
    monsterDetails(id).then(records => {
      if (version === routeVersion) showMonsterDrops(new DOMParser().parseFromString(records[pages.h] || "", "text/html"), drops, rank, selectedRank => monsterUrl(slug, variant, selectedRank), data.dropRanks?.[id]);
    }).catch(error => {
      if (version === routeVersion) drops.textContent = "Carve data could not be loaded; see the original page above.";
      console.error(error);
    });
  }
  if (variant) monsterDetails(id).then(records => {
    const images = data.images?.[id];
    const fallback = Object.values(images || {}).find(entry => entry.icon)?.icon;
    if (version === routeVersion) showMonsterStats(new DOMParser().parseFromString(records[pages[variant]] || "", "text/html"), stats, heading, images?.[variant], fallback, data.statLabels?.[id]?.[variant] || "Selected");
  }).catch(error => {
    if (version === routeVersion) stats.textContent = "Stats could not be loaded; see the original page above.";
    console.error(error);
  });
}
