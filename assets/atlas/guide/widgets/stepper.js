/* ============================================================================
   stepper.js — walk an ordered process one step at a time.

   The archetype for "here is the whole pipeline, in execution order": a turn
   loop, a request lifecycle, a build, a state machine. Steps that jump
   backwards are marked, because a loop's back edges are the part readers
   misread.

   EVERYTHING PROJECT-SPECIFIC IS THE `STEPS` ARRAY AND THE `frame()` CALL.
   Replace both; leave the rest alone.

   Each step:
     tag    one word, shown as a chip — group steps by subsystem
     what   the step, in a short line
     body   HTML: why this step exists, and what breaks without it
     where  the real symbol or file:function this step corresponds to
     loop   true if this step can jump backwards (drawn differently)
   ========================================================================= */

import { frame } from "./index.js";

const STEPS = [
  {
    tag: "input",
    what: "Accept the request and record it",
    body: `Replace these steps with the real ones, read out of the source. Keep them in
      <em>execution order</em> — the order is the teaching.`,
    where: "src/loop.rs — fn run()",
  },
  {
    tag: "work",
    what: "Do the work",
    body: `Each <code>body</code> should answer one question: why is this a separate step? If the
      answer is "it is not", merge it.`,
    where: "src/loop.rs — fn step()",
  },
  {
    tag: "loop",
    what: "▲ More to do? Go back",
    body: `Mark back edges with <code>loop: true</code>. A reader who cannot see where a loop
      restarts cannot predict what the code does.`,
    where: "if needs_follow_up { continue; }",
    loop: true,
  },
  {
    tag: "done",
    what: "Return the result",
    body: `The last step should say what the caller actually gets, and what has already been
      persisted by the time it arrives.`,
    where: "Ok(result)",
  },
];

export function mount(el) {
  const body = frame(el, {
    label: "Interactive",
    title: "One request, from start to finish",
    hint: `${STEPS.length} steps, in execution order. Say here what the reader should notice —
      ideally the thing that surprised you when you read the code.`,
  });

  const wrap = document.createElement("div");
  wrap.className = "tl";

  const list = document.createElement("div");
  list.className = "tl__steps";
  list.setAttribute("role", "tablist");

  const detail = document.createElement("div");
  detail.className = "tl__detail";

  let active = 0;

  STEPS.forEach((step, i) => {
    const btn = document.createElement("button");
    btn.className = "tlstep" + (step.loop ? " tlstep--loop" : "");
    btn.setAttribute("role", "tab");
    btn.innerHTML = `<span class="tlstep__n">${i + 1}</span><span>${step.what}</span><span class="tlstep__tag">${step.tag}</span>`;
    btn.addEventListener("click", () => select(i));
    list.append(btn);
  });

  function select(i) {
    active = i;
    [...list.children].forEach((b, j) => {
      b.setAttribute("aria-current", String(j === i));
      b.classList.toggle("is-past", j < i);
    });
    const s = STEPS[i];
    detail.innerHTML = `
      <div class="tl__what">${s.what}</div>
      <div class="tl__body">${s.body}</div>
      <div class="tl__where">${escapeHtml(s.where)}</div>`;
  }

  const controls = document.createElement("div");
  controls.className = "wctl";
  controls.style.marginTop = "var(--s4)";
  controls.style.marginBottom = "0";
  const prev = mk("wbtn", "← Prev", () => select((active - 1 + STEPS.length) % STEPS.length));
  const next = mk("wbtn wbtn--primary", "Next →", () => select((active + 1) % STEPS.length));
  controls.append(prev, next);

  const left = document.createElement("div");
  left.append(list);
  const right = document.createElement("div");
  right.append(detail, controls);

  wrap.append(left, right);
  body.append(wrap);
  select(0);
}

function mk(cls, label, onClick) {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
