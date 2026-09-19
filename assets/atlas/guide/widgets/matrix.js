/* ============================================================================
   matrix.js — N comparable things, side by side, one detail pane.

   The archetype for "the same job, done four different ways": platform
   backends, storage engines, transport implementations, driver variants. It
   earns its place when the comparison is the lesson and a table would either
   lie by omission or be too wide to read.

   EVERYTHING PROJECT-SPECIFIC IS THE `CELLS` ARRAY AND THE `frame()` CALL.

   Each cell:
     title, subtitle, tag   the three lines on the button, longest last
     rows                   [label, html] pairs for the detail pane; use the
                            SAME labels in the same order for every cell, so
                            the reader can compare by position
   ========================================================================= */

import { frame } from "./index.js";

const CELLS = [
  {
    title: "Platform A",
    subtitle: "Mechanism",
    tag: "TypeName::VariantA",
    rows: [
      ["How", `What actually happens, in two sentences.`],
      ["Granularity", `What this mechanism can and cannot express.`],
      ["Cost", `What it makes slower, larger or harder.`],
      ["Watch out", `The failure that does not mention this subsystem in its error message.`],
      ["Source", `<code>src/backend/a.rs</code>`],
    ],
  },
  {
    title: "Platform B",
    subtitle: "Mechanism",
    tag: "TypeName::VariantB",
    rows: [
      ["How", `Keep the row labels identical across cells. Comparison by position is the point.`],
      ["Granularity", `If one cell has nothing to say for a row, say so — do not drop the row.`],
      ["Cost", `—`],
      ["Watch out", `A cell that is absent at runtime is worth its own note.`],
      ["Source", `<code>src/backend/b.rs</code>`],
    ],
  },
];

export function mount(el) {
  const body = frame(el, {
    label: "Reference",
    title: "One job, several implementations",
    hint: "Pick a cell. Say here what the reader should take away from the comparison.",
  });

  const grid = document.createElement("div");
  grid.className = "sm__grid";
  const detail = document.createElement("div");
  detail.className = "sm__detail";

  CELLS.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "smcell";
    b.innerHTML = `<div class="smcell__os">${c.title}</div>
      <div class="smcell__mech">${c.subtitle}</div>
      <div class="smcell__type">${c.tag}</div>`;
    b.addEventListener("click", () => select(i));
    grid.append(b);
  });

  function select(i) {
    [...grid.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    detail.innerHTML = `<dl class="sm__kv">${CELLS[i].rows
      .map(([label, html]) => `<dt>${label}</dt><dd>${html}</dd>`)
      .join("")}</dl>`;
  }

  body.append(grid, detail);
  select(0);
}
