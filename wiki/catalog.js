"use strict";

// Search indexes and packaged quest details are generated from Ferias.
const weaponTypes = {
  "0": "Great Sword", "1": "Heavy Bowgun", "2": "Hammer", "3": "Lance",
  "4": "Sword & Shield", "5": "Light Bowgun", "6": "Dual Swords", "7": "Long Sword",
  "8": "Hunting Horn", "9": "Gunlance", A: "Bow", B: "Tonfa",
  C: "Switch Axe", D: "Magnet Spike"
};
// Ferias mhficons: the first eleven follow the weapon type IDs; the later
// types use their own icons (Switch Axe F: 111, Magnet Spike: 115).
const weaponTypeIcons = {
  "0": "063", "1": "064", "2": "065", "3": "066", "4": "067",
  "5": "068", "6": "069", "7": "070", "8": "071", "9": "072",
  A: "073", B: "074", C: "111", D: "115"
};
const weaponTags = { g: "G Rank", sp: "SP", neko: "RNG Cat", sinca: "Evolution" };
let questCatalogPromise;
let weaponCatalogPromise;
let weaponTreesPromise;
const weaponDetailPromises = new Map();
const questDetailPromises = new Map();

function catalogData(section) {
  if (section === "quests") return questCatalogPromise ||= loadData("quests");
  return weaponCatalogPromise ||= loadData("weapons-index");
}

function questDetails(file) {
  if (!/^[a-z0-9_-]+$/i.test(file)) return Promise.reject(new Error("Invalid quest file"));
  if (!questDetailPromises.has(file)) questDetailPromises.set(file, loadData(`quest-details/${file}`).catch(error => {
    questDetailPromises.delete(file);
    throw error;
  }));
  return questDetailPromises.get(file);
}

function catalogPage(current) {
  const version = routeVersion;
  const title = current.section === "quests" ? "Quests" : "Weapons";
  document.title = `${title} · Frontier Wiki`;
  content.replaceChildren(element("p", "hint", `Loading ${title.toLowerCase()}…`));
  catalogData(current.section).then(data => {
    if (version !== routeVersion) return;
    if (current.id) {
      if (current.section === "quests") questPage(current.id, data, version);
      else weaponPage(current.id, data, version);
    } else if (current.section === "weapons" && !current.type && !current.query && !current.category) weaponTypesPage(data);
    else catalogList(current, data);
  }).catch(error => {
    if (version === routeVersion) content.replaceChildren(element("p", "empty", `Could not load ${title.toLowerCase()}. Please try again.`));
    console.error(error);
  });
}

function weaponTypesPage(index) {
  content.replaceChildren(element("h1", "", "Weapons"), element("p", "muted", "Choose a weapon type to browse its weapons."));
  const counts = {};
  for (const entry of Object.values(index)) counts[entry.type] = (counts[entry.type] || 0) + 1;
  const grid = element("div", "weapon-types");
  for (const [type, name] of Object.entries(weaponTypes)) {
    const card = link("", `#/weapons?type=${type}`, "weapon-type-card");
    card.append(sectionIcon(weaponTypeIcons[type]), element("span", "weapon-type-name", name), element("small", "", `${(counts[type] || 0).toLocaleString()} weapons`));
    grid.append(card);
  }
  content.append(grid);
}

function catalogList(current, data) {
  const quests = current.section === "quests";
  const index = quests ? data.names : data;
  const heading = quests ? "Quests" : current.type && weaponTypes[current.type] ? `${weaponTypes[current.type]} Weapons` : "Weapons";
  if (!quests) content.replaceChildren(link("← Weapon types", "#/weapons", "breadcrumbs"));
  else content.replaceChildren();
  content.append(element("h1", "", heading), element("p", "muted", quests
    ? "Search quests by title or ID. Quest details and rewards come from the original Ferias tables."
    : "Search weapons by name or ID. Select a weapon type to browse it."));
  const controls = element("div", "catalog-controls");
  const input = element("input", "search");
  input.type = "search";
  input.placeholder = quests ? "Search quests, e.g. Rathian or 524B…" : "Search weapons, e.g. Hunter Knife or 4009C…";
  input.setAttribute("aria-label", `Search ${heading.toLowerCase()}`);
  input.value = current.query;
  const select = element("select", "filter-select");
  select.setAttribute("aria-label", quests ? "Filter quests by rank" : "Filter by weapon type");
  const options = quests ? { "": "All ranks", HR: "HR", GR: "GR", SR: "SR" } : { "": "All weapon types", ...weaponTypes };
  for (const [value, name] of Object.entries(options)) {
    const option = element("option", "", name);
    option.value = value;
    select.append(option);
  }
  select.value = quests ? current.rank : current.type;
  controls.append(input, select);
  const category = quests ? null : element("select", "filter-select");
  if (category) {
    category.setAttribute("aria-label", "Filter by weapon category");
    const names = [...new Set(Object.values(index).flatMap(row => row.categories))].sort((a, b) => a.localeCompare(b));
    for (const [value, name] of [["", "All categories"], ...names.map(name => [name, name])]) {
      const option = element("option", "", name);
      option.value = value;
      category.append(option);
    }
    category.value = current.category;
    controls.append(category);
  }
  const count = element("p", "hint");
  const results = element("div", "results");
  const more = element("button", "load-more", "Show 100 more");
  more.type = "button";
  content.append(controls, count, results, more);
  let candidates = [];
  let visible = 100;

  function showResults() {
    results.replaceChildren();
    if (!candidates.length) results.append(element("p", "empty", "No matching records."));
    for (const [id, row] of candidates.slice(0, visible)) {
      const card = link("", `#/${current.section}/${id}`, "result");
      card.append(sectionIcon(quests ? "038" : weaponTypeIcons[id[0]]));
      const text = element("span", "", quests ? row.title : row.name);
      text.append(element("small", "", quests ? row.level : `${weaponTypes[id[0]]}${row.tags.length ? ` · ${row.tags.map(tag => weaponTags[tag] || tag).join(" · ")}` : ""}`));
      card.append(text, element("span", "result-code", id));
      results.append(card);
    }
    more.hidden = visible >= candidates.length;
    count.textContent = `${candidates.length.toLocaleString()} results${candidates.length > visible ? ` · showing ${visible.toLocaleString()}` : ""}`;
  }

  function update() {
    const query = input.value.trim().toLocaleLowerCase();
    const filter = select.value;
    if (!quests && !query && !filter && !category.value) { weaponTypesPage(index); history.replaceState(null, "", "#/weapons"); return; }
    candidates = query || filter || category?.value ? Object.entries(index).filter(([id, row]) => {
      if (quests) {
        if (filter && !row.level.toUpperCase().startsWith(filter)) return false;
        return !query || id.toLowerCase().includes(query) || row.title.toLocaleLowerCase().includes(query) || row.level.toLocaleLowerCase().includes(query);
      }
      if (!weaponTypes[id[0]] || filter && id[0] !== filter || category.value && !row.categories.includes(category.value)) return false;
      return !query || id.toLowerCase().includes(query) || row.name.toLocaleLowerCase().includes(query);
    }) : [];
    candidates.sort((a, b) => (quests ? a[1].title : a[1].name).localeCompare(quests ? b[1].title : b[1].name) || a[0].localeCompare(b[0]));
    visible = 100;
    if (query || filter || category?.value) {
      showResults();
    } else { results.replaceChildren(); more.hidden = true; count.textContent = "Search by name or ID, or choose a filter to browse."; }
    const search = new URLSearchParams();
    if (input.value.trim()) search.set("q", input.value.trim());
    if (filter) search.set(quests ? "rank" : "type", filter);
    if (category?.value) search.set("category", category.value);
    const hash = `#/${current.section}${search.size ? `?${search}` : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  input.addEventListener("input", update);
  select.addEventListener("change", update);
  category?.addEventListener("change", update);
  more.addEventListener("click", () => { visible += 100; showResults(); });
  update();
}

// Rebuild markup with only text and known item/weapon links. Do not inject legacy HTML.
function oldText(node, weaponType) {
  const fragment = document.createDocumentFragment();
  function visit(source, target) {
    for (const child of source.childNodes) {
      if (child.nodeType === 3) target.append(document.createTextNode(child.nodeValue));
      else if (child.nodeType === 1) {
        if (child.tagName === "BR") target.append(document.createElement("br"));
        else if (child.tagName === "A") {
          const href = child.getAttribute("href") || "";
          const item = /sozai\.htm\?([0-9a-f]{4})/i.exec(href);
          const weapon = /(?:^|\/)?([a-z_]+)\.htm#l([0-9a-f]{4})/i.exec(href);
          const sameWeapon = /^#l([0-9a-f]{4})$/i.exec(href);
          if (item && items[item[1].toUpperCase()]) target.append(link(child.textContent, `#/items/${item[1].toUpperCase()}`));
          else if (sameWeapon && weaponType) target.append(link(child.textContent, `#/weapons/${weaponType}${sameWeapon[1].toUpperCase()}`));
          else if (weapon) {
            const type = Object.entries(weaponFileBases).find(([, base]) => weapon[1] === base || weapon[1].startsWith(`${base}_`));
            target.append(type ? link(child.textContent, `#/weapons/${type[0]}${weapon[2].toUpperCase()}`) : document.createTextNode(child.textContent));
          } else target.append(document.createTextNode(child.textContent));
        } else visit(child, target);
      }
    }
  }
  visit(node, fragment);
  return fragment;
}

const weaponFileBases = {
  "0": "taiken", "1": "heavy", "2": "hammer", "3": "lance", "4": "katate",
  "5": "right", "6": "souken", "7": "tachi", "8": "horn", "9": "gunlance",
  A: "yumi", B: "tonfa", C: "slaxe", D: "magspike"
};

function field(parent, label, value, weaponType) {
  if (!value || !value.textContent?.trim()) return;
  const row = element("div", "detail-field");
  row.append(element("dt", "", label));
  const description = element("dd");
  description.append(oldText(value, weaponType));
  row.append(description);
  parent.append(row);
}

function addLegacyLink(parent, label, folder, file, id) {
  const action = element("p", "actions");
  action.append(link(label, originalPage(folder, `${file}${id ? `#l${id}` : ""}`)));
  parent.append(action);
}

async function questPage(id, data, version) {
  const quest = data.names[id];
  content.replaceChildren(link("← Quests", "#/quests", "breadcrumbs"));
  if (!quest) { content.append(element("h1", "", "Quest not found")); return; }
  content.append(element("h1", "", quest.title), element("p", "muted", `${quest.level} · Quest ${id}`));
  if (quest.detailAvailable === false) {
    if (quest.sourceAvailable) addLegacyLink(content, "Original quest listing ↗", "quest", `${quest.file}.htm`, quest.sourceAnchorAvailable ? id : null);
    if (!quest.sourceAnchorAvailable) {
      content.append(element("p", "empty", quest.sourceAvailable
        ? "This quest is indexed, but its entry is missing from the original listing."
        : "This quest is indexed, but its original file is missing from the archive."));
      return;
    }
    const details = element("div", "", "Loading quest listing…");
    content.append(details);
    try {
      const entries = await questDetails(quest.file);
      if (version !== routeVersion) return;
      const doc = new DOMParser().parseFromString(entries[id] || "", "text/html");
      const source = doc.getElementById(`l${id}`);
      const listing = source?.nextElementSibling;
      if (!listing?.matches("table")) { details.textContent = "Quest listing not found in the local data."; return; }
      const panel = element("section", "panel");
      panel.append(element("h2", "", source.textContent.trim() || "Quest listing"));
      const wrapper = element("div", "quest-listing-wrap");
      const table = element("table", "data-table");
      for (const row of listing.rows) {
        const result = element("tr");
        for (const cell of row.cells) {
          const target = element(cell.tagName.toLowerCase());
          target.colSpan = cell.colSpan;
          target.rowSpan = cell.rowSpan;
          target.append(oldText(cell));
          result.append(target);
        }
        table.append(result);
      }
      wrapper.append(table);
      panel.append(wrapper);
      details.replaceChildren(panel);
    } catch (error) {
      if (version === routeVersion) details.textContent = "Quest listing could not be loaded; see the original listing above.";
      console.error(error);
    }
    return;
  }
  addLegacyLink(content, "Original quest entry ↗", "quest", `${quest.file}.htm`, id);
  const details = element("div", "", "Loading the original quest table…");
  content.append(details);
  try {
    const entries = await questDetails(quest.file);
    if (version !== routeVersion) return;
    const doc = new DOMParser().parseFromString(entries[id] || "", "text/html");
    const header = doc.getElementById(`l${id}`)?.closest("table.mei");
    if (!header || !header.rows[1]) { details.textContent = "Detailed entry not found in the original quest table."; return; }
    details.replaceChildren();
    const panel = element("section", "panel");
    panel.append(element("h2", "", "Quest details"));
    const fields = element("dl", "detail-fields");
    const headers = [...header.rows[0].cells];
    [...header.rows[1].cells].forEach((cell, index) => field(fields, headers[index]?.textContent.trim() || `Field ${index + 1}`, cell));
    panel.append(fields);
    details.append(panel);
    let rewards;
    for (let next = header.nextElementSibling; next && !next.matches("table.mei"); next = next.nextElementSibling) {
      if (next.matches("div[class^=con]")) {
        const requirement = element("p", "hint", next.textContent.trim());
        details.append(requirement);
        rewards = null;
      }
      if (next.matches("table.S") && next.rows.length > 1) {
        const supplies = element("details", "panel quest-supplies");
        supplies.append(element("summary", "", `Supplies (${next.rows.length - 1} entries)`));
        const table = element("table", "data-table");
        for (const row of next.rows) {
          const result = element("tr");
          for (const cell of row.cells) {
            const target = element(cell.tagName.toLowerCase());
            target.append(oldText(cell));
            result.append(target);
          }
          table.append(result);
        }
        supplies.append(table);
        details.append(supplies);
      }
      if (!next.matches("table.t")) continue;
      if (!rewards) {
        rewards = element("div", "quest-rewards");
        details.append(rewards);
      }
      const rewardPanel = element("section", "panel");
      rewardPanel.append(element("h2", "", "Rewards"));
      const table = element("table", "data-table reward-table");
      for (const row of next.rows) {
        const result = element("tr");
        for (const cell of row.cells) {
          const target = element(cell.tagName.toLowerCase());
          target.append(oldText(cell));
          result.append(target);
        }
        table.append(result);
      }
      rewardPanel.append(table);
      rewards.append(rewardPanel);
    }
  } catch (error) {
    if (version === routeVersion) details.textContent = "Detailed quest data could not be loaded; see the original entry above.";
    console.error(error);
  }
}

function weaponSharpness(bars) {
  const wrapper = element("div", "sharpness-bars");
  for (const bar of bars) {
    const line = element("div", "sharpness-bar");
    for (const { color, length } of bar) {
      const span = element("span", `sharpness-${color}`);
      span.style.width = `${length}px`;
      line.append(span);
    }
    wrapper.append(line);
  }
  return wrapper;
}

function weaponCell(value, type, index) {
  const target = document.createDocumentFragment();
  if (value.parts) {
    let previousQuantity = null;
    for (const part of value.parts) {
      let text = part.text;
      if (previousQuantity !== null && !part.itemId && !part.weaponId) text = text.replace(new RegExp(`^\\s*x${previousQuantity}(?=\\D|$)`, "i"), "");
      previousQuantity = null;
      if (part.itemId && items[part.itemId]) {
        target.append(link(text, `#/items/${part.itemId}`));
        if (part.quantity) { target.append(document.createTextNode(` ×${part.quantity}`)); previousQuantity = part.quantity; }
      }
      else if (part.weaponId) {
        const basename = /^([a-z_]+)\.htm#l/i.exec(part.href || "")?.[1];
        const destination = basename ? Object.entries(weaponFileBases).find(([, base]) => basename === base || basename.startsWith(`${base}_`))?.[0] : type;
        const id = destination && destination + part.weaponId;
        target.append(id && index[id] ? link(text, `#/weapons/${id}`) : document.createTextNode(text));
      } else target.append(document.createTextNode(text));
    }
  } else if (value.text) target.append(document.createTextNode(value.text));
  if (value.sharpness) target.append(weaponSharpness(value.sharpness));
  return target;
}

function weaponField(parent, label, value, type, index) {
  if (!value || !value.text && !value.parts && !value.sharpness) return;
  const row = element("div", "detail-field");
  const description = element("dd");
  description.append(weaponCell(value, type, index));
  row.append(element("dt", "", label), description);
  parent.append(row);
}

function weaponRowPanel(parent, table, row, index, type, label) {
  const panel = element("section", "panel");
  panel.append(element("h2", "", label));
  const facts = element("dl", "detail-fields");
  const materials = element("dl", "detail-fields");
  const materialsLabel = /(?:Mats|Materials|素材)/i;
  let column = 0;
  row.cells.forEach((cell, number) => {
    const title = table.columns[column] || `Field ${column + 1}`;
    if (number) weaponField(materialsLabel.test(title) ? materials : facts, title, cell, type, index);
    column += cell.colSpan || 1;
  });
  if (table.kind !== "tower") {
    const upgrades = row.cells[0].parts?.filter(part => part.weaponId);
    if (upgrades?.length) weaponField(facts, "Upgrades", { parts: upgrades.flatMap((part, position) => position ? [{ text: " " }, part] : [part]) }, type, index);
  }
  panel.append(facts);
  if (materials.children.length) {
    panel.append(element("h3", "", table.kind === "tower" ? "Enhancement costs" : "Crafting materials"), materials);
  }
  parent.replaceChildren(panel);
}

function weaponTable(parent, table, id, index) {
  const section = element("section", "weapon-source");
  const tower = table.kind === "tower";
  section.append(element("h2", "section-head", tower ? "Tower enhancements" : "Weapon stats & crafting"));
  if (tower) section.append(element("p", "hint", "Tower upgrades use a separate original table. Fields retain its original labels."));
  const select = element("select", "filter-select");
  select.setAttribute("aria-label", tower ? "Tower enhancement step" : "Weapon level or variant");
  if (table.rows.length > 1) {
    table.rows.forEach((row, position) => {
      const label = tower ? `Step ${position + 1}` : row.variant ? `Variant ${row.variant}` : row.level ? `Lv${row.level}` : "Base";
      const option = element("option", "", label);
      option.value = String(position);
      select.append(option);
    });
    section.append(select);
  }
  const display = element("div");
  function show() {
    const row = table.rows[Number(select.value) || 0];
    const label = tower ? `${index[id].name} · Step ${Number(select.value) + 1 || 1}` : row.variant ? `${index[id].name} · Variant ${row.variant}` : row.level ? `${index[id].name} · Lv${row.level}` : index[id].name;
    weaponRowPanel(display, table, row, index, id[0], tower ? `Tower: ${label}` : label);
    section.querySelector(".actions a").href = originalPage("buki", `${table.file}#${row.anchor}`);
  }
  const actions = element("p", "actions");
  actions.append(link("Original Ferias entry ↗", "#"));
  section.append(display, actions);
  select.addEventListener("change", show);
  show();
  parent.append(section);
}

function weaponTree(id, data) {
  const nodes = data.trees[data.byWeapon[id]];
  if (!nodes) return null;
  const panel = element("aside", "panel weapon-tree");
  panel.append(element("h2", "", "Weapon tree"), element("p", "hint", "☆ Directly craftable"));
  const branches = element("div", "weapon-tree-branches");
  const root = element("ul", "weapon-tree-list");
  const ancestors = [];
  for (const node of nodes) {
    const depth = Math.min(node.depth, ancestors.length);
    ancestors.length = depth;
    const list = depth ? ancestors[depth - 1].querySelector(":scope > ul") || element("ul", "weapon-tree-list") : root;
    if (depth && !list.parentElement) ancestors[depth - 1].append(list);
    const row = element("li");
    const label = element("span", node.id === id ? "weapon-tree-current" : "");
    if (node.id) {
      const entry = link(node.name, `#/weapons/${node.id}`);
      if (node.id === id) entry.setAttribute("aria-current", "page");
      label.append(entry);
    } else label.append(document.createTextNode(node.name));
    if (node.suffix) label.append(document.createTextNode(node.suffix));
    row.append(label);
    list.append(row);
    ancestors.push(row);
  }
  branches.append(root);
  panel.append(branches);
  return panel;
}

async function weaponPage(id, index, version) {
  const entry = index[id];
  content.replaceChildren(link(`← ${weaponTypes[id[0]] || "Weapons"} weapons`, weaponTypes[id[0]] ? `#/weapons?type=${id[0]}` : "#/weapons", "breadcrumbs"));
  if (!entry || !weaponTypes[id[0]]) { content.append(element("h1", "", "Weapon not found")); return; }
  document.title = `${entry.name} · Frontier Wiki`;
  content.append(element("h1", "", entry.name), element("p", "muted", `${weaponTypes[id[0]]} · Weapon ${id}${entry.tags.length ? ` · ${entry.tags.map(tag => weaponTags[tag] || tag).join(" · ")}` : ""}`));
  if (!entry.hasDetail) {
    content.append(element("p", "empty", "This weapon is indexed by name, but its original detail row has not been located."));
    return;
  }
  const details = element("div", "", "Loading weapon data…");
  content.append(details);
  try {
    const shard = id.slice(0, 3);
    if (!weaponDetailPromises.has(shard)) weaponDetailPromises.set(shard, loadData(`weapon-details/${shard}`).catch(error => {
      weaponDetailPromises.delete(shard);
      throw error;
    }));
    const data = await weaponDetailPromises.get(shard);
    if (version !== routeVersion) return;
    details.replaceChildren();
    if (!data[id]) throw new Error(`Missing weapon detail ${id}`);
    const layout = element("div", "weapon-detail-layout");
    const sources = element("div");
    for (const table of data[id].tables) weaponTable(sources, table, id, index);
    layout.append(sources);
    details.append(layout);
    weaponTreesPromise ||= loadData("weapon-trees").catch(error => {
      weaponTreesPromise = null;
      throw error;
    });
    const tree = weaponTree(id, await weaponTreesPromise);
    if (version === routeVersion && tree) layout.append(tree);
  } catch (error) {
    if (version === routeVersion && !details.querySelector(".weapon-detail-layout")) details.textContent = "Weapon details could not be loaded. Please try again.";
    console.error(error);
  }
}
