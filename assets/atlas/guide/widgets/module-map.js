/* ============================================================================
   module-map.js — the repository's top-level modules, grouped by what they do.

   The one widget almost every atlas should have. A directory listing answers
   "what exists"; this answers "where does X live", which is the question a
   reader actually has. Grouping is editorial — it maps directories onto jobs —
   and modules that have a chapter link through to it.

   EVERYTHING PROJECT-SPECIFIC IS THE `GROUPS` ARRAY AND THE `frame()` CALL.

   A group:  { hue: "p1".."p7", name, desc, modules: [[dirName, chapterId?]] }

   Use the hue of the part that covers the group, so the colour in the map
   matches the colour in the sidebar. Names must be the REAL directory names:
   this widget is a map, and a map with invented place names is worse than no
   map. A trailing slash marks a directory that holds nested modules rather
   than being one itself.
   ========================================================================= */

import { frame } from "./index.js";

const GROUPS = [
  {
    id: "core",
    hue: "p1",
    name: "The loop",
    desc: "Whatever drives the main process",
    modules: [["core", "example"], ["protocol"], ["api"]],
  },
  {
    id: "io",
    hue: "p3",
    name: "Input and output",
    desc: "Talking to the outside world",
    modules: [["client"], ["server"], ["transport/"]],
  },
  {
    id: "support",
    hue: "p7",
    name: "Support",
    desc: "Scaffolding, not shipped behaviour",
    modules: [["test-utils"], ["codegen"]],
  },
];

export function mount(el) {
  const total = GROUPS.reduce((n, g) => n + g.modules.length, 0);

  const body = frame(el, {
    label: "Index",
    title: `${total} top-level modules, grouped by what they are for`,
    hint: "Grouping is editorial; the names are the real directory names. Coloured modules have a chapter — click through.",
  });

  const filter = document.createElement("div");
  filter.className = "cm__filter";
  filter.innerHTML = `<div class="wfield" style="width:100%">
    <label for="cm-q">Filter</label>
    <input class="winput" id="cm-q" type="text" placeholder="filter by name…" style="width:100%">
  </div>`;

  const groups = document.createElement("div");
  groups.className = "cm__groups";

  const count = document.createElement("div");
  count.className = "cm__count";

  function draw(q = "") {
    const query = q.trim().toLowerCase();
    let shown = 0;
    groups.innerHTML = GROUPS.map((g) => {
      const hits = g.modules.filter(
        ([name]) => !query || name.includes(query) || g.name.toLowerCase().includes(query),
      );
      if (!hits.length) return "";
      shown += hits.length;
      return `<div class="cmgroup" style="--g: var(--${g.hue}); --g-ink: var(--${g.hue}-ink)">
        <div class="cmgroup__h">
          <span class="cmgroup__n">${g.name}</span>
          <span class="cmgroup__d">${g.desc}</span>
        </div>
        <div class="cmgroup__list">
          ${hits
            .map(([name, chapter]) => {
              const label = query
                ? name.replace(new RegExp(`(${escapeRe(query)})`, "i"), "<mark>$1</mark>")
                : name;
              return chapter
                ? `<a class="cmmod cmmod--link" href="#/${chapter}">${label}</a>`
                : `<span class="cmmod">${label}</span>`;
            })
            .join("")}
        </div>
      </div>`;
    }).join("");

    count.textContent = query
      ? `${shown} of ${total} modules match “${q.trim()}”.`
      : `${total} top-level modules. Say here which two or three the reader will actually spend time in.`;
  }

  filter.querySelector("input").addEventListener("input", (e) => draw(e.target.value));
  body.append(filter, groups, count);
  draw();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
