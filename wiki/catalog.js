"use strict";

// Search indexes are generated from Ferias; full records are read from its original
// HTML tables on demand until weapon/quest extraction is complete.
const weaponTypes = {
  "0": "Great Sword", "1": "Heavy Bowgun", "2": "Hammer", "3": "Lance",
  "4": "Sword & Shield", "5": "Light Bowgun", "6": "Dual Swords", "7": "Long Sword",
  "8": "Hunting Horn", "9": "Gunlance", A: "Bow", B: "Tonfa",
  C: "Switch Axe", D: "Magnet Spike"
};
let questCatalogPromise;
let weaponCatalogPromise;
const originalPages = new Map();

function catalogData(section) {
  if (section === "quests") return questCatalogPromise ||= loadData("quests");
  return weaponCatalogPromise ||= Promise.all([loadData("equipment"), loadData("weapon-pages")]).then(([equipment, pages]) => ({ equipment, pages }));
}

function oldPage(folder, file) {
  if (!/^[a-z0-9_-]+\.htm$/i.test(file)) return Promise.reject(new Error("Invalid original page name"));
  const url = `../archive/ferias/${folder}/${file}`;
  if (!originalPages.has(url)) originalPages.set(url, fetch(url).then(response => {
    if (!response.ok) throw new Error(`Original page unavailable (${response.status})`);
    return response.text();
  }).then(text => new DOMParser().parseFromString(text, "text/html")));
  return originalPages.get(url);
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
    } else catalogList(current, data);
  }).catch(error => {
    if (version === routeVersion) content.replaceChildren(element("p", "empty", `Could not load ${title.toLowerCase()}. Please try again.`));
    console.error(error);
  });
}

function catalogList(current, data) {
  const quests = current.section === "quests";
  const index = quests ? data.names : data.equipment.weaponNames;
  const heading = quests ? "Quests" : "Weapons";
  content.replaceChildren(element("h1", "", heading), element("p", "muted", quests
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
  const count = element("p", "hint");
  const results = element("div", "results");
  content.append(controls, count, results);

  function update() {
    const query = input.value.trim().toLocaleLowerCase();
    const filter = select.value;
    const candidates = query || filter ? Object.entries(index).filter(([id, row]) => {
      if (quests) {
        if (filter && !row.level.toUpperCase().startsWith(filter)) return false;
        return !query || id.toLowerCase().includes(query) || row.title.toLocaleLowerCase().includes(query) || row.level.toLocaleLowerCase().includes(query);
      }
      if (!weaponTypes[id[0]] || filter && id[0] !== filter) return false;
      return !query || id.toLowerCase().includes(query) || row.toLocaleLowerCase().includes(query);
    }) : [];
    candidates.sort((a, b) => (quests ? a[1].title : a[1]).localeCompare(quests ? b[1].title : b[1]) || a[0].localeCompare(b[0]));
    count.textContent = query || filter ? `${candidates.length.toLocaleString()} results${candidates.length > 100 ? " · showing first 100, refine your search" : ""}` : "Search by name or ID, or choose a filter to browse.";
    results.replaceChildren();
    if (query || filter) {
      if (!candidates.length) results.append(element("p", "empty", "No matching records."));
      for (const [id, row] of candidates.slice(0, 100)) {
        const card = link("", `#/${current.section}/${id}`, "result");
        card.append(sectionIcon(quests ? "038" : "063"));
        const text = element("span", "", quests ? row.title : row);
        text.append(element("small", "", quests ? row.level : weaponTypes[id[0]]));
        card.append(text, element("span", "result-code", id));
        results.append(card);
      }
    }
    const search = new URLSearchParams();
    if (input.value.trim()) search.set("q", input.value.trim());
    if (filter) search.set(quests ? "rank" : "type", filter);
    const hash = `#/${current.section}${search.size ? `?${search}` : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  input.addEventListener("input", update);
  select.addEventListener("change", update);
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
  action.append(link(label, `../archive/ferias/${folder}/${file}#l${id}`));
  parent.append(action);
}

async function questPage(id, data, version) {
  const quest = data.names[id];
  content.replaceChildren(link("← Quests", "#/quests", "breadcrumbs"));
  if (!quest) { content.append(element("h1", "", "Quest not found")); return; }
  content.append(element("h1", "", quest.title), element("p", "muted", `${quest.level} · Quest ${id}`));
  addLegacyLink(content, "Original quest entry ↗", "quest", `${quest.file}.htm`, id);
  const details = element("div", "", "Loading the original quest table…");
  content.append(details);
  try {
    const doc = await oldPage("quest", `${quest.file}.htm`);
    if (version !== routeVersion) return;
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
    for (let next = header.nextElementSibling; next && !next.matches("table.mei"); next = next.nextElementSibling) {
      if (next.matches("div[class^=con]")) {
        const requirement = element("p", "hint", next.textContent.trim());
        details.append(requirement);
      }
      if (!next.matches("table.t")) continue;
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
      details.append(rewardPanel);
    }
  } catch (error) {
    if (version === routeVersion) details.textContent = "Detailed quest data could not be loaded; see the original entry above.";
    console.error(error);
  }
}

function sharpness(cell) {
  const bars = cell.querySelectorAll("ul");
  if (!bars.length) return null;
  const wrapper = element("div", "sharpness-bars");
  for (const bar of bars) {
    const line = element("div", "sharpness-bar");
    for (const segment of bar.querySelectorAll("li")) {
      const size = /\bs(\d+)\b/.exec(segment.className);
      const color = /\b[roygbwps]\b/.exec(segment.className);
      if (size && color) {
        const span = element("span", `sharpness-${color[0]}`);
        span.style.width = `${size[1]}px`;
        line.append(span);
      }
    }
    wrapper.append(line);
  }
  return wrapper;
}

async function weaponPage(id, data, version) {
  const name = data.equipment.weaponNames[id];
  content.replaceChildren(link("← Weapons", "#/weapons", "breadcrumbs"));
  if (!name || !weaponTypes[id[0]]) { content.append(element("h1", "", "Weapon not found")); return; }
  const files = data.pages[id] || [];
  content.append(element("h1", "", name), element("p", "muted", `${weaponTypes[id[0]]} · Weapon ${id}`));
  if (!files.length) {
    content.append(element("p", "empty", "This weapon is indexed by name, but its original detail row has not been located."));
    return;
  }
  addLegacyLink(content, "Original weapon entry ↗", "buki", files[0], id.slice(1));
  const details = element("div", "", "Loading the original weapon table…");
  content.append(details);
  try {
    const doc = await oldPage("buki", files[0]);
    if (version !== routeVersion) return;
    const baseId = id.slice(1);
    const rows = [...doc.querySelectorAll(`td[id^="l${baseId}"]`)]
      .filter(node => node.id === `l${baseId}` || /^\d{1,2}$/.test(node.id.slice(5)) && node.querySelector("b")?.textContent.trim() === `Lv${Number(node.id.slice(5))}`)
      .map(node => node.closest("tr")).filter(Boolean);
    if (!rows.length) { details.textContent = "Weapon row not found in the original table."; return; }
    details.replaceChildren();
    const selector = element("select", "filter-select");
    selector.setAttribute("aria-label", "Weapon level");
    if (rows.length > 1) {
      rows.forEach((row, index) => {
        const label = row.cells[0]?.querySelector("b")?.textContent.trim() || `Entry ${index + 1}`;
        const option = element("option", "", label);
        option.value = String(index);
        selector.append(option);
      });
      details.append(element("p", "hint", "Select a level to see its stats and materials."), selector);
    }
    const panel = element("section", "panel");
    details.append(panel);
    function display(index) {
      const row = rows[index];
      panel.replaceChildren(element("h2", "", row.cells[0]?.querySelector("b")?.textContent.trim() || "Weapon details"));
      const fields = element("dl", "detail-fields");
      const header = row.closest("table")?.querySelector("thead tr");
      [...row.cells].forEach((cell, cellIndex) => {
        const label = header?.cells[cellIndex]?.textContent.trim() || `Field ${cellIndex + 1}`;
        if (cellIndex === 0) {
          const upgrades = cell.querySelector("div");
          if (upgrades) field(fields, "Upgrades", upgrades, id[0]);
        } else if (/sharpness/i.test(label)) {
          const bar = sharpness(cell);
          if (bar) {
            const group = element("div", "detail-field");
            group.append(element("dt", "", "Sharpness"), element("dd"));
            group.lastChild.append(bar);
            fields.append(group);
          }
        } else field(fields, label, cell, id[0]);
      });
      panel.append(fields);
    }
    selector.addEventListener("change", () => display(Number(selector.value)));
    display(0);
  } catch (error) {
    if (version === routeVersion) details.textContent = "Detailed weapon data could not be loaded; see the original entry above.";
    console.error(error);
  }
}
