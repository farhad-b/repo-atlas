/* ============================================================================
   timeline.js — named points on a process, with the phases in between.

   The archetype for extension points: lifecycle events, hook points, signals,
   callbacks. Two row kinds interleave — a clickable point, and a plain phase
   line that shows what happens between the points. The phases are what make
   the ordering legible.

   EVERYTHING PROJECT-SPECIFIC IS THE `ROWS` ARRAY AND THE `frame()` CALL.

   A point:  { at, when, tags: [...], body }
   A phase:  { phase: "what happens here" }
   ========================================================================= */

import { frame } from "./index.js";

const ROWS = [
  {
    at: "BeforeStart",
    when: "Before anything runs",
    tags: ["block", "add context"],
    body: `<code>tags</code> are the powers this point grants — what a handler can actually do
      here. They are the reason to choose one point over another, so take them from the schema,
      not from the docs.`,
  },
  { phase: "the work begins" },
  {
    at: "BeforeAction",
    when: "The action is parsed, before it runs",
    tags: ["block", "allow / deny / ask", "rewrite input"],
    body: `Usually the most powerful point, and the one worth the longest note. Say what a handler
      can see here that it cannot see anywhere else.`,
  },
  { phase: "the action runs" },
  {
    at: "AfterAction",
    when: "The action has produced output",
    tags: ["block", "add context"],
    body: `Note which points are commonly asynchronous. A handler with no verdict to offer should
      never sit in the critical path, and readers get this wrong.`,
  },
  { phase: "▲ loop back if there is more work" },
  {
    at: "End",
    when: "The process is about to finish",
    tags: ["block + continuation"],
    body: `A point that can refuse to let the process end deserves saying out loud. It is the
      difference between a policy that is enforced and one that is hoped for.`,
  },
];

export function mount(el) {
  const body = frame(el, {
    label: "Reference",
    title: `${ROWS.filter((r) => r.at).length} extension points, in the order they fire`,
    hint: "Say here what varies between the points — matchers, sync vs async, who can veto.",
  });

  const track = document.createElement("div");
  track.className = "ht__track";
  const panel = document.createElement("div");
  panel.className = "ht__panel";

  const pointIdx = [];
  ROWS.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "htrow " + (r.at ? "htrow--hook" : "htrow--phase");
    if (r.at) {
      pointIdx.push(i);
      const b = document.createElement("button");
      b.className = "htbtn";
      b.textContent = r.at;
      b.dataset.i = i;
      b.addEventListener("click", () => select(i));
      row.append(b);
    }
    const t = document.createElement("div");
    t.className = "htrow__t";
    t.textContent = r.at ? r.when : r.phase;
    row.append(t);
    track.append(row);
  });

  function select(i) {
    [...track.querySelectorAll(".htbtn")].forEach((b) =>
      b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i)),
    );
    const r = ROWS[i];
    panel.innerHTML = `<h5>${r.at}</h5>
      <p>${r.body}</p>
      <div class="ht__can">${(r.tags || []).map((c) => `<span>${c}</span>`).join("")}</div>`;
  }

  body.append(track, panel);
  // Open on the most interesting point, not the first one.
  select(pointIdx[Math.min(1, pointIdx.length - 1)]);
}
