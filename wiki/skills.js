"use strict";

let skillsPromise;
let skillCategories;
let skillNames;
let zenithSkillNames;

const skillAliases = {
  "hearing protection": "hearing res", "autoreload": "auto-reload",
  "autoguard": "auto-guard", "widearea": "wide-area",
  "gather": "gathering", "antitheft": "anti-theft",
  "ms tech": "magnet spike tech", "paralysis": "para",
  "crit conversion up": "critical conversion up",
  "para res up": "paralysis res up", "earplugs up": "hearing protection up",
  "s. assault up": "stylish assault up", "c. conversion up": "critical conversion up"
};

function loadSkills() {
  return skillsPromise ||= loadData("skills").then(data => {
    skillCategories = new Map(data.map(category => [category.id, category]));
    skillNames = new Map();
    for (const category of data) {
      const zenith = category.id.startsWith("zenith-");
      const key = `${zenith ? "zenith:" : ""}${category.name.toLowerCase()}`;
      skillNames.set(key, { category });
      for (const entry of category.entries) skillNames.set(`${zenith ? "zenith:" : ""}${entry.name.toLowerCase()}`, { category, entry });
    }
    const aliases = Object.entries(skillAliases).flatMap(([alias, canonical]) => {
      const category = skillNames.get(`zenith:${canonical}`)?.category;
      return category ? [alias, ...category.entries.map(entry => alias + entry.name.toLowerCase().slice(canonical.length))] : [];
    });
    zenithSkillNames = [...skillNames.keys()].filter(name => name.startsWith("zenith:")).map(name => name.slice(7)).concat(aliases).sort((a, b) => b.length - a.length);
    return data;
  }).catch(error => { skillsPromise = null; throw error; });
}

function skillReference(name, zenith = false) {
  if (!skillNames) return null;
  let key = name.trim().replace(/^[「\s]+|[」\s]+$/g, "").toLowerCase();
  for (const [alias, canonical] of Object.entries(skillAliases)) {
    if (key === alias || key.startsWith(`${alias}+`)) {
      key = canonical + key.slice(alias.length);
      break;
    }
  }
  const prefix = zenith ? "zenith:" : "";
  let found = skillNames.get(prefix + key);
  if (!found && key.endsWith("+")) found = skillNames.get(prefix + key.slice(0, -1));
  if (!found) {
    const base = key.replace(/[-+]?\d+$/, "");
    found = skillNames.get(prefix + (skillAliases[base] || base));
  }
  return found || null;
}

function skillHref(reference) {
  return `#/skills/${reference.category.id}${reference.entry ? `?entry=${reference.entry.id}` : ""}`;
}

// Gear skill cells store skill-point names plus a trailing point value, not
// activated skills. Only link an exact known label; never guess from prose.
function gearSkillText(text) {
  const result = document.createDocumentFragment();
  for (const line of text.split(/(\n)/)) {
    if (line === "\n") { result.append(document.createTextNode(line)); continue; }
    const trimmed = line.trim();
    const zenith = trimmed.startsWith("「");
    const reference = skillReference(trimmed, zenith);
    const label = zenith ? trimmed : trimmed.replace(/^(.+?[^0-9+-])(\d+)$/, "$1+$2");
    const start = line.indexOf(trimmed);
    result.append(document.createTextNode(line.slice(0, start)), reference ? link(label, skillHref(reference)) : document.createTextNode(label), document.createTextNode(line.slice(start + trimmed.length)));
  }
  return result;
}

// Weapon tables embed Zenith Skill labels in otherwise unrelated stats.
function weaponSkillText(text, decorate = false) {
  const result = document.createDocumentFragment();
  const markers = [...text.matchAll(/Zenith Skill\s*[：:]\s*/gi)];
  if (!markers.length) return decorate ? effectText(text) : document.createTextNode(text);
  let position = 0;
  for (const marker of markers) {
    result.append(decorate ? effectText(text.slice(position, marker.index)) : document.createTextNode(text.slice(position, marker.index)));
    result.append(document.createTextNode(marker[0]));
    const from = marker.index + marker[0].length;
    const remainder = text.slice(from);
    const name = zenithSkillNames.find(value => remainder.toLowerCase().startsWith(value) && !/[\w]/.test(remainder[value.length] || ""));
    const reference = name && skillReference(name, true);
    if (!reference) { position = from; continue; }
    result.append(link(remainder.slice(0, name.length), skillHref(reference)));
    position = from + name.length;
  }
  result.append(decorate ? effectText(text.slice(position)) : document.createTextNode(text.slice(position)));
  return result;
}

function skillsPage(current) {
  const version = routeVersion;
  content.replaceChildren(element("p", "hint", "Loading skills…"));
  loadSkills().then(data => {
    if (version !== routeVersion) return;
    skillTablePage(current, data);
  }).catch(error => {
    if (version === routeVersion) content.replaceChildren(element("p", "empty", "Skills could not be loaded."));
    console.error(error);
  });
}

function skillDescriptionTable(categories, zenith, selected) {
  const table = element("table", "data-table skill-table");
  const header = element("tr");
  for (const title of ["Skill", ...(zenith ? [] : ["Buff"]), "Effect", "Points", "Description"]) header.append(element("th", "", title));
  table.append(header);
  let section = "";
  let selectedRow = null;
  for (const category of categories) {
    if (category.section !== section) {
      section = category.section;
      const heading = element("tr", "skill-section");
      const label = element("th", "", section);
      label.colSpan = zenith ? 4 : 5;
      heading.append(label);
      table.append(heading);
    }
    const rows = [...(category.notes || []).map(note => ({ note })), ...category.entries];
    rows.forEach((entry, index) => {
      const row = element("tr");
      if (!index) {
        const group = element("td", "skill-group");
        group.id = `skill-group-${category.id}`;
        group.rowSpan = rows.length;
        group.append(link(category.name, skillHref({ category })));
        row.append(group);
        if (!zenith) {
          const affected = element("td", "skill-buff", category.affected);
          affected.rowSpan = rows.length;
          row.append(affected);
        }
        if (category.id === selected?.id && !selected?.entry) selectedRow = row;
      }
      if (entry.note) {
        const note = element("td", "skill-note", entry.note);
        note.colSpan = 3;
        row.append(note);
      } else {
        row.id = `skill-entry-${category.id}-${entry.id}`;
        const effect = element("td", "skill-effect");
        effect.append(link(entry.name, skillHref({ category, entry })));
        row.append(effect, element("td", "skill-points", entry.points), element("td", "skill-description", entry.description));
        if (category.id === selected?.id && entry.id === selected.entry) selectedRow = row;
      }
      table.append(row);
    });
  }
  if (selectedRow) selectedRow.classList.add("skill-selected");
  return { table, selectedRow };
}

function skillTablePage(current, data) {
  const selected = current.id && { id: current.id, entry: current.entry };
  document.title = "Skill Descriptions · Frontier Wiki";
  content.replaceChildren(element("h1", "", "Skill Descriptions"));
  if (current.id && !skillCategories.has(current.id)) { content.append(element("p", "empty", "Skill not found.")); return; }
  const input = element("input", "search");
  input.type = "search";
  input.placeholder = "Find a skill in the tables…";
  input.setAttribute("aria-label", "Find a skill");
  content.append(input, element("p", "hint", "○ = Affected by Goushou Armor buffs. Select a skill or effect for a shareable link."));
  let selectedRow = null;
  for (const zenith of [false, true]) {
    const title = zenith ? "Zenith Skill Descriptions" : "Regular Skill Descriptions";
    content.append(element("h2", "section-head", title), link("Original Ferias table ↗", originalPage("koneta", zenith ? "skill_zenith.htm" : "skill.htm")));
    const wrapper = element("div", "skill-table-wrap");
    const result = skillDescriptionTable(data.filter(category => category.id.startsWith("zenith-") === zenith), zenith, selected);
    wrapper.append(result.table);
    content.append(wrapper);
    selectedRow ||= result.selectedRow;
  }
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    const group = data.find(category => category.name.toLowerCase().includes(query) || category.entries.some(entry => entry.name.toLowerCase().includes(query)));
    const entry = group?.entries.find(entry => entry.name.toLowerCase().includes(query));
    document.getElementById(entry ? `skill-entry-${group.id}-${entry.id}` : `skill-group-${group?.id}`)?.scrollIntoView({ block: "center" });
  });
  selectedRow?.scrollIntoView({ block: "center" });
}
