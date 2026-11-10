"""One-time import of Ferias skill descriptions; needs beautifulsoup4 and html5lib.

The committed data/skills.json is used directly by the wiki. This script is not
required at runtime and can be retired when the Ferias snapshot is removed.
"""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("+", " plus ").replace("-", " minus ")).strip("-")


categories = []
for source, prefix in (("skill", ""), ("skill_zenith", "zenith-")):
    html = (ROOT / "archive/ferias/koneta" / f"{source}.htm").read_text()
    # Ferias has a malformed Grace+1 description cell (`<tdIf ...`).
    html = html.replace("<tdIf ", "<td>If ")
    table = BeautifulSoup(html, "html5lib").find("table")
    section = ""
    category = None
    for row in table.find_all("tr"):
        cells = row.find_all("td", recursive=False)
        if not cells:
            header = row.find("th")
            if header:
                section = header.get_text(" ", strip=True)
            continue
        group_cells = [cell for cell in cells if "g" in cell.get("class", [])]
        group = group_cells[0] if group_cells else None
        if group:
            name = group.get_text(" ", strip=True)
            if name in ("○", "×"):
                continue
            category = {"id": prefix + slug(name), "name": name, "section": section, "entries": []}
            if source == "skill":
                category["affected"] = group_cells[1].get_text(" ", strip=True) if len(group_cells) > 1 else ""
            categories.append(category)
        skill = next((cell for cell in cells if "t" in cell.get("class", [])), None)
        if not category:
            continue
        if not skill:
            note = cells[-1].get_text("\n", strip=True)
            if note:
                category.setdefault("notes", []).append(note)
            continue
        name = skill.get_text(" ", strip=True)
        index = cells.index(skill)
        if len(cells) < index + 3:
            raise ValueError(f"Incomplete {source} entry: {name}")
        category["entries"].append({
            "id": slug(name), "name": name,
            "points": cells[index + 1].get_text("\n", strip=True),
            "description": cells[index + 2].get_text("\n", strip=True),
        })

ids = [category["id"] for category in categories]
if len(ids) != len(set(ids)):
    raise ValueError("Duplicate skill category IDs")
for category in categories:
    entries = [entry["id"] for entry in category["entries"]]
    if len(entries) != len(set(entries)):
        raise ValueError(f"Duplicate skill entries: {category['name']}")

target = ROOT / "data/skills.json"
target.write_text(json.dumps(categories, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Imported {len(categories)} skill categories and {sum(len(c['entries']) for c in categories)} descriptions")
