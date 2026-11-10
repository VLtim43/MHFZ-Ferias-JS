// Validate committed skill descriptions and links without reading the Ferias archive.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, "data", `${name}.json`), "utf8"));
const skills = read("skills");
const context = vm.createContext({
  loadData: async () => skills,
  document: {
    createDocumentFragment: () => ({ children: [], append(...nodes) { this.children.push(...nodes); } }),
    createTextNode: text => ({ textContent: text })
  },
  link: (text, href) => ({ textContent: text, href })
});
vm.runInContext(fs.readFileSync(path.join(root, "wiki/skills.js"), "utf8"), context);

(async () => {
  await vm.runInContext("loadSkills()", context);
  const reference = (name, zenith = false) => vm.runInContext(`skillReference(${JSON.stringify(name)}, ${zenith})`, context);
  const ids = new Set();
  for (const category of skills) {
    assert.ok(!ids.has(category.id), `Duplicate skill: ${category.id}`);
    ids.add(category.id);
    assert.ok(category.entries.length, `Missing effects: ${category.id}`);
    const entries = new Set();
    for (const entry of category.entries) {
      assert.ok(!entries.has(entry.id), `Duplicate effect: ${category.id}/${entry.id}`);
      entries.add(entry.id);
      assert.ok(entry.name && entry.description, `Incomplete effect: ${category.id}/${entry.id}`);
    }
  }
  assert.equal(reference("Attack3")?.category.id, "attack");
  assert.equal(reference("Hearing Protection5")?.category.id, "hearing-res");
  assert.equal(reference("「Skill Slots Up+1」", true)?.entry.id, "skill-slots-up-plus-1");
  assert.equal(reference("Crit Conversion Up+1", true)?.category.id, "zenith-critical-conversion-up");
  assert.equal(reference("Crit Conversion Up+1", true)?.entry.id, "critical-conversion-up-plus-1");
  assert.equal(reference("Unknown Skill"), null);
  const labels = vm.runInContext('gearSkillText("Strong Attack2\\nPoison-2\\n「Skill Slots Up+1」")', context).children.filter(node => node.href);
  assert.deepEqual(labels.map(node => node.textContent), ["Strong Attack+2", "Poison-2", "「Skill Slots Up+1」"]);
  assert.deepEqual(labels.map(node => node.href), ["#/skills/strong-attack", "#/skills/poison", "#/skills/zenith-skill-slots-up?entry=skill-slots-up-plus-1"]);

  let matched = 0;
  let total = 0;
  for (const file of fs.readdirSync(path.join(root, "data/gear-details"))) {
    const shard = read(`gear-details/${path.parse(file).name}`);
    for (const record of Object.values(shard)) for (const [index, column] of record.columns.entries()) {
      if (!/^Skills?$/i.test(column)) continue;
      const cell = record.cells[index];
      for (const value of [cell, ...(cell.lines || [])]) {
        const text = value.text || value.parts?.map(part => part.text).join("") || "";
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          total++;
          if (reference(line, line.trim().startsWith("「"))) matched++;
        }
      }
    }
  }
  assert.ok(matched / total > 0.99, `Too many skill labels lack a destination: ${matched}/${total}`);
  const zenithNames = vm.runInContext("zenithSkillNames", context);
  let weaponMentions = 0;
  for (const file of fs.readdirSync(path.join(root, "data/weapon-details"))) {
    if (file === "index.json") continue;
    const shard = read(`weapon-details/${path.parse(file).name}`);
    for (const record of Object.values(shard)) for (const table of record.tables) for (const row of table.rows) for (const cell of row.cells) {
      for (const text of cell.parts?.map(part => part.text) || [cell.text || ""]) {
        for (const marker of text.matchAll(/Zenith Skill\s*[：:]\s*/gi)) {
          const rest = text.slice(marker.index + marker[0].length).toLowerCase();
          const name = zenithNames.find(name => rest.startsWith(name) && !/\w/.test(rest[name.length] || ""));
          assert.ok(name && reference(name, true), `Missing weapon Zenith skill: ${rest.slice(0, 50)}`);
          weaponMentions++;
        }
      }
    }
  }
  console.log(`${skills.length} skill groups, ${skills.reduce((count, group) => count + group.entries.length, 0)} descriptions; ${matched}/${total} gear labels and ${weaponMentions} weapon Zenith mentions linked.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
