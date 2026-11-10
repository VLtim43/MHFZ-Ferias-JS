"use strict";

const gearTypes = {
  h: "Head", b: "Chest", a: "Arms", w: "Waist", l: "Legs",
  H: "Palico head", B: "Palico chest",
  d: "Decorations", p: "SP decorations", c: "Cuffs", f: "Skill cuffs",
  n: "Palico decorations", t: "Tower decorations", k: "Sigils", z: "Zenith decorations", s: "Sigil recipes"
};
const armorTypes = new Set(["h", "b", "a", "w", "l", "H", "B"]);
let gearIndexPromise;
let gearTreesPromise;
const gearDetailPromises = new Map();

function gearIcon(type) {
  return sectionIcon(armorPieceIcons[type] || "044");
}

function gearTree(id, data) {
  const nodes = data.trees[data.byGear[id]];
  if (!nodes) return null;
  const panel = element("aside", "panel weapon-tree gear-tree");
  panel.append(element("h2", "", "Armor set tree"));
  const branches = element("div", "weapon-tree-branches");
  const root = element("ul", "weapon-tree-list");
  const ancestors = [];
  for (const node of nodes) {
    const depth = Math.min(node.depth, ancestors.length);
    ancestors.length = depth;
    const list = depth ? ancestors[depth - 1].querySelector(":scope > ul") || element("ul", "weapon-tree-list") : root;
    if (depth && !list.parentElement) ancestors[depth - 1].append(list);
    const row = element("li");
    const title = element("span", node.pieces.includes(id) ? "weapon-tree-current" : "", node.name);
    row.append(title);
    const pieces = element("span", "gear-tree-pieces");
    for (const piece of node.pieces) {
      const slot = gearTypes[piece[0]];
      const entry = link(slot, `#/armor/${piece}`);
      if (piece === id) entry.setAttribute("aria-current", "page");
      entry.prepend(gearIcon(piece[0]));
      pieces.append(entry);
    }
    row.append(pieces);
    list.append(row);
    ancestors.push(row);
  }
  branches.append(root);
  panel.append(branches);
  return panel;
}

function gearPage(current) {
  const version = routeVersion;
  content.replaceChildren(element("p", "hint", "Loading equipment…"));
  gearIndexPromise ||= loadData("gear-index");
  gearIndexPromise.then(index => {
    if (version !== routeVersion) return;
    if (current.id) gearDetailPage(current, index, version);
    else gearListPage(current, index);
  }).catch(error => {
    if (version === routeVersion) content.textContent = "Equipment could not be loaded.";
    gearIndexPromise = null;
    console.error(error);
  });
}

function gearListPage(current, index) {
  const armor = current.section === "armor";
  const title = armor ? "Armor" : "Decorations & cuffs";
  document.title = `${title} · Frontier Wiki`;
  content.replaceChildren(element("h1", "", title));
  const controls = element("div", "catalog-controls");
  const search = element("input", "search");
  search.type = "search";
  search.placeholder = `Search ${title.toLowerCase()} by name or ID…`;
  search.setAttribute("aria-label", `Search ${title.toLowerCase()}`);
  search.value = current.query;
  const select = element("select", "filter-select");
  select.setAttribute("aria-label", armor ? "Filter armor slot" : "Filter decoration type");
  for (const [type, name] of [["", armor ? "All armor slots" : "All decoration types"], ...Object.entries(gearTypes).filter(([type]) => armorTypes.has(type) === armor)]) {
    const option = element("option", "", name);
    option.value = type;
    select.append(option);
  }
  select.value = current.type || (armor ? "" : "d");
  controls.append(search, select);
  const count = element("p", "hint");
  const results = element("div", "results");
  const more = element("button", "load-more", "Show 100 more");
  more.type = "button";
  content.append(controls, count, results, more);
  let matches = [];
  let visible = 100;
  function show() {
    results.replaceChildren();
    for (const [id, entry] of matches.slice(0, visible)) {
      const card = link("", `#/${armor ? "armor" : "decorations"}/${id}`, "result");
      card.append(gearIcon(entry.type));
      card.append(element("span", "", entry.name), element("small", "", `${gearTypes[entry.type]} · ${id}`));
      results.append(card);
    }
    if (!matches.length) results.append(element("p", "empty", "No matching equipment."));
    more.hidden = visible >= matches.length;
    count.textContent = `${matches.length.toLocaleString()} results${matches.length > visible ? ` · showing ${visible}` : ""}`;
  }
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    matches = Object.entries(index).filter(([id, entry]) => armorTypes.has(entry.type) === armor && (!select.value || select.value === entry.type) && (!query || id.toLowerCase().includes(query) || entry.name.toLocaleLowerCase().includes(query) || entry.originalName?.toLocaleLowerCase().includes(query)));
    matches.sort((a, b) => a[1].name.localeCompare(b[1].name) || a[0].localeCompare(b[0]));
    visible = 100;
    show();
    const params = new URLSearchParams();
    if (search.value.trim()) params.set("q", search.value.trim());
    if (select.value) params.set("type", select.value);
    history.replaceState(null, "", `#/${current.section}${params.size ? `?${params}` : ""}`);
  }
  search.addEventListener("input", update);
  select.addEventListener("change", update);
  more.addEventListener("click", () => { visible += 100; show(); });
  update();
}

function gearValue(cell, index, decorate = false, skill = false) {
  const result = document.createDocumentFragment();
  if (!cell) return result;
  const text = value => skill ? gearSkillText(value) : decorate ? effectText(value) : document.createTextNode(value);
  if (!cell.parts) {
    result.append(text(cell.text || ""));
    return result;
  }
  for (const part of cell.parts) {
    if (part.itemId && items[part.itemId]) result.append(link(part.text, `#/items/${part.itemId}`));
    else if (part.gearId && index[part.gearId]) result.append(link(part.text, `#/${armorTypes.has(part.gearId[0]) ? "armor" : "decorations"}/${part.gearId}`));
    else result.append(text(part.text));
  }
  return result;
}

function gearDetailPage(current, index, version) {
  const id = current.id;
  const entry = index[id];
  const armor = current.section === "armor";
  content.replaceChildren(link(`← ${armor ? "Armor" : "Decorations"}`, `#/${current.section}`, "breadcrumbs"));
  if (!entry || armorTypes.has(entry.type) !== armor) { content.append(element("h1", "", "Equipment not found")); return; }
  document.title = `${entry.name} · Frontier Wiki`;
  const heading = element("h1", "item-title", entry.name);
  heading.prepend(gearIcon(entry.type));
  content.append(heading, element("p", "muted", `${gearTypes[entry.type]} · ${id}`));
  const target = element("div", "", "Loading equipment details…");
  content.append(target);
  const shard = id.slice(0, 3);
  if (!gearDetailPromises.has(shard)) gearDetailPromises.set(shard, loadData(`gear-details/${shard}`).catch(error => {
    gearDetailPromises.delete(shard);
    throw error;
  }));
  gearDetailPromises.get(shard).then(records => {
    if (version !== routeVersion) return;
    const record = records[id];
    if (!record) { target.textContent = "Equipment details not found."; return; }
    target.replaceChildren();
    const layout = element("div", "weapon-detail-layout");
    const main = element("div");
    layout.append(main);
    target.append(layout);
    const defense = record.columns.findIndex(label => /Defense/i.test(label));
    const levelCount = defense >= 0 ? record.cells[defense].lines?.length || 1 : 1;
    const select = element("select", "filter-select");
    select.setAttribute("aria-label", "Armor level");
    if (levelCount > 1) {
      for (let i = 0; i < levelCount; i++) {
        const option = element("option", "", `Lv ${i + 1}`);
        option.value = String(i);
        select.append(option);
      }
      main.append(select);
    }
    const panel = element("section", "panel");
    const fields = element("dl", "detail-fields");
    const references = record.cells[0].parts?.filter(part => part.gearId) || [];
    for (const [label, parts] of [["Upgrades", references.filter(part => armorTypes.has(part.gearId[0]))], ["Refines into", references.filter(part => !armorTypes.has(part.gearId[0]))]]) {
      if (!parts.length) continue;
      const row = element("div", "detail-field");
      const value = element("dd");
      for (const part of parts) {
        value.append(index[part.gearId] ? link(part.text, `#/${armorTypes.has(part.gearId[0]) ? "armor" : "decorations"}/${part.gearId}`) : document.createTextNode(part.text));
        value.append(document.createTextNode(" "));
      }
      row.append(element("dt", "", label), value);
      fields.append(row);
    }
    function show() {
      fields.querySelectorAll(".gear-stat").forEach(row => row.remove());
      for (let i = 1; i < record.columns.length; i++) {
        const cell = record.cells[i];
        const selected = cell.lines?.length === levelCount ? cell.lines[Number(select.value) || 0] : cell;
        if (!selected?.text && !selected?.parts && !cell.lines) continue;
        const row = element("div", "detail-field gear-stat");
        const value = element("dd");
        const decorate = /^(?:Resistance|Element|Attributes|Skills)$/i.test(record.columns[i]);
        const skill = /^Skills?$/i.test(record.columns[i]);
        if (selected?.lines) for (const line of selected.lines) value.append(gearValue(line, index, decorate, skill), document.createElement("br"));
        else value.append(gearValue(selected, index, decorate, skill));
        row.append(element("dt", "", record.columns[i].replace("DefenseSlot", "Defense / slots").replace("TypeﾟGR", "Type / GR")), value);
        fields.append(row);
      }
    }
    select.addEventListener("change", show);
    show();
    panel.append(element("h2", "", armor ? "Armor stats & crafting" : "Decoration details & crafting"), fields);
    main.append(panel, link("Original Ferias entry ↗", originalPage("bougu", `${record.file}#l${id.slice(1)}`), "actions"));
    if (armor) {
      gearTreesPromise ||= loadData("gear-trees").catch(error => {
        gearTreesPromise = null;
        throw error;
      });
      gearTreesPromise.then(data => {
        const tree = gearTree(id, data);
        if (version === routeVersion && tree) layout.append(tree);
      }).catch(console.error);
    }
  }).catch(error => {
    if (version === routeVersion) target.textContent = "Equipment details could not be loaded.";
    console.error(error);
  });
}
