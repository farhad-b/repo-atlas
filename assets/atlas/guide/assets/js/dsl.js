/* ============================================================================
   dsl.js — the small vocabulary every chapter is written in.

   Chapters are plain ES modules that export `meta` and `render(ctx)`. They call
   these helpers rather than hand-writing markup, so the whole guide stays
   visually consistent and a change here reaches every chapter at once.
   ========================================================================= */

import { highlightLines, escapeHtml } from "./highlight.js";

let SNIPPETS = {};
let PIN = { sha: "main", short: "main", repo: "{{REPO}}" };

export function installSnippets(data) {
  SNIPPETS = data.snippets || {};
  PIN = data.pin || PIN;
}
export const pin = () => PIN;

/* Counts for the home page, derived so they cannot go stale. */
export const snippetCount = () => Object.keys(SNIPPETS).length;
export const snippetLineCount = () =>
  Object.values(SNIPPETS).reduce((n, s) => n + (s.endLine - s.startLine + 1), 0);

/* -- inline ------------------------------------------------------------- */
export const c = (s) => `<code>${escapeHtml(s)}</code>`;

/* -- chapter head -------------------------------------------------------- */
export function chapterHead(meta) {
  return `<header class="chead">
    <div class="chead__eyebrow"><span class="chead__n">${meta.n}</span>${escapeHtml(meta.partTitle)}</div>
    <h1>${meta.title}</h1>
    <p class="chead__lead">${meta.lead}</p>
  </header>`;
}

/** The question the chapter answers, stated without jargon. */
export function problem(html) {
  return `<div class="problem"><div class="problem__label">The problem</div>${html}</div>`;
}

/* -- code ---------------------------------------------------------------- */

/**
 * Render a pinned snippet.
 *
 * `notes` maps a *file* line number to a note; each noted line gets a numbered
 * chip and a matching entry underneath, so callouts survive edits elsewhere in
 * the file. `hl` highlights lines without numbering them.
 */
export function snip(id, opts = {}) {
  const s = SNIPPETS[id];
  if (!s) {
    return `<div class="snip"><div class="snip__head"><span class="snip__path">missing snippet: ${escapeHtml(id)}</span></div></div>`;
  }

  const { notes = {}, hl = [], caption = "" } = opts;
  const noteLines = Object.keys(notes)
    .map(Number)
    .sort((a, b) => a - b);
  const noteIndex = new Map(noteLines.map((ln, i) => [ln, i + 1]));
  const hlSet = new Set([...hl.map(Number), ...noteLines]);

  // Elided lines are tokenised (so string and comment boundaries stay right)
  // but not rendered; each dropped run collapses to a single marker.
  const elided = new Set(s.elideLines || []);
  const lines = highlightLines(s.code, s.lang);
  let inElision = false;
  const body = lines
    .map((html, i) => {
      const fileLine = s.startLine + i;
      if (elided.has(fileLine)) {
        if (inElision) return "";
        inElision = true;
        return `<span class="ln snip__elide"><i>⋯</i>⋯</span>`;
      }
      inElision = false;
      const chip = noteIndex.has(fileLine)
        ? `<b class="co">${noteIndex.get(fileLine)}</b>`
        : "";
      const cls = hlSet.has(fileLine) ? "ln ln--hl" : "ln";
      return `<span class="${cls}"><i>${fileLine}</i>${html || "&nbsp;"}${chip}</span>`;
    })
    .join("");

  const notesHtml = noteLines.length
    ? `<div class="snip__notes">${noteLines
        .map(
          (ln) =>
            `<div class="snip__note"><b class="co">${noteIndex.get(ln)}</b><div>${notes[ln]}</div></div>`,
        )
        .join("")}</div>`
    : "";

  const dir = s.path.slice(0, s.path.lastIndexOf("/") + 1);
  const file = s.path.slice(s.path.lastIndexOf("/") + 1);

  return `<figure class="snip">
    <figcaption class="snip__head">
      <a class="snip__path" href="${s.permalink}" target="_blank" rel="noopener"
         title="${escapeHtml(s.path)} — open on GitHub at ${PIN.short}"><bdi>${escapeHtml(dir)}<b>${escapeHtml(file)}</b></bdi></a>
      <span class="snip__spacer"></span>
      <span class="snip__lines">${s.startLine}–${s.endLine}</span>
      <button class="snip__btn" data-copy="${escapeHtml(id)}" aria-label="Copy this excerpt" title="Copy">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"/></svg>
      </button>
    </figcaption>
    <div class="snip__body"><pre><code>${body}</code></pre></div>
    ${notesHtml}
  </figure>${caption ? `<p class="snip__caption">${caption}</p>` : ""}`;
}

/** A code block that is *not* from the repo — pseudocode, config, a shell line. */
export function code(text, lang = "text", label = "") {
  const lines = highlightLines(text.trim(), lang)
    .map((h) => `<span class="ln">${h || "&nbsp;"}</span>`)
    .join("");
  return `<figure class="snip">
    ${label ? `<figcaption class="snip__head"><span class="snip__path">${escapeHtml(label)}</span></figcaption>` : ""}
    <div class="snip__body"><pre><code>${lines}</code></pre></div>
  </figure>`;
}

/* -- a worked example ----------------------------------------------------
   A trace rather than a claim: one concrete scenario, the steps the code takes
   through it, and the literal text at each step. Deliberately unlike `snip` —
   an excerpt is verbatim source with a line-number gutter, an example is
   assembled to show shape, and the chrome says which one you are looking at.

   `source` names the file in the clone the literal text was built from — a
   snapshot test, a golden file, a fixture. check-content.mjs requires it to
   exist, and holds any step marked `verbatim: true` to actually appearing in
   it. An example with no `source` is fine; it is just not checkable, so say in
   `note` which numbers are illustrative.                                     */
export function example({ title = "", scenario = "", steps = [], note = "", source = "" }) {
  const sources = (Array.isArray(source) ? source : [source]).filter(Boolean);

  const body = steps
    .map((s) =>
      `<li>${
        s.t ? `<div class="eg__t">${s.t}</div>` : ""
      }${s.d ? `<div class="eg__d">${s.d}</div>` : ""}${
        s.code ? wire(s.code, s.lang || "wire", s.label || "", { verbatim: s.verbatim }) : ""
      }</li>`,
    )
    .join("");

  return `<section class="eg">
    <div class="eg__head">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6.2L4.8 18A2 2 0 006.5 21h11a2 2 0 001.7-3L14 9.2V3"/><path d="M7.5 15h9"/></svg>
      <span class="eg__label">Worked example</span>
      ${title ? `<span class="eg__title">${title}</span>` : ""}
    </div>
    <div class="eg__body">
      ${scenario ? `<p class="eg__scenario">${scenario}</p>` : ""}
      ${body ? `<ol class="eg__steps">${body}</ol>` : ""}
      ${note ? `<p class="eg__note">${note}</p>` : ""}
      ${
        sources.length
          ? `<p class="eg__src">Built from ${sources
              .map((p) => `<code>${escapeHtml(p)}</code>`)
              .join(" · ")}</p>`
          : ""
      }
    </div>
  </section>`;
}

/**
 * A literal blob: what a file holds, what went over the wire, what a tool
 * returned. No line-number gutter and no permalink — these are bytes, not a
 * place in a file. `opts.verbatim` marks the block as copied from the
 * example's `source`, which both labels it for the reader and asks the checker
 * to prove it.
 */
export function wire(text, lang = "wire", label = "", opts = {}) {
  const lines = highlightLines(text.replace(/^\n+|\n+$/g, ""), lang)
    .map((h) => `<span class="wl">${h || "&nbsp;"}</span>`)
    .join("");
  const cap =
    label || opts.verbatim
      ? `<figcaption class="wire__label">${escapeHtml(label)}${
          opts.verbatim ? `<span class="wire__vb" title="Copied from the file this example cites">verbatim</span>` : ""
        }</figcaption>`
      : "";
  return `<figure class="wire">
    ${cap}
    <pre><code>${lines}</code></pre>
  </figure>`;
}

/* -- the transferable pattern -------------------------------------------- */
export function pattern({ title = "", invariants = [], pseudo = "", note = "" }) {
  return `<section class="pattern">
    <div class="pattern__head">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.4 5.2 5.6.7-4.2 3.9 1.1 5.6L12 15.7 7.1 18.4l1.1-5.6L4 8.9l5.6-.7z"/></svg>
      <span class="pattern__label">The pattern</span>
      ${title ? `<span class="pattern__title">${title}</span>` : ""}
    </div>
    <div class="pattern__body">
      ${invariants.length ? `<ol class="inv">${invariants.map((i) => `<li>${i}</li>`).join("")}</ol>` : ""}
      ${pseudo ? `<div class="pseudo"><pre>${pseudoHtml(pseudo)}</pre></div>` : ""}
      ${note ? `<p>${note}</p>` : ""}
    </div>
  </section>`;
}

/** Pseudocode: comments dimmed, everything else left alone. */
function pseudoHtml(text) {
  return escapeHtml(text.trim())
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*)(#|\/\/)(.*)$/);
      if (m) return `${m[1]}<span class="t-com">${m[2]}${m[3]}</span>`;
      return line.replace(/(\s)(#|\/\/)(.*)$/, '$1<span class="t-com">$2$3</span>');
    })
    .join("\n");
}

/* -- what breaks if you get it wrong ------------------------------------- */
export function traps(items) {
  return `<section class="traps">
    <div class="traps__head">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4M12 17v.01"/></svg>
      Traps
    </div>
    <div class="traps__body">
      ${items.map((t) => `<div class="trap"><div class="trap__t">${t.t}</div><div class="trap__b">${t.b}</div></div>`).join("")}
    </div>
  </section>`;
}

/* -- assorted blocks ----------------------------------------------------- */
export const key = (html) => `<p class="keyfact">${html}</p>`;

export function table(headers, rows) {
  return `<div class="tablewrap"><table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

export function cards(items) {
  return `<div class="cols">${items
    .map(
      (i) =>
        `<div class="card${i.kind ? ` card--${i.kind}` : ""}"><div class="card__t">${i.t}</div>${i.b}</div>`,
    )
    .join("")}</div>`;
}

export function stats(items) {
  return `<div class="stats">${items
    .map((s) => `<div class="stat"><div class="stat__v">${s.v}</div><div class="stat__l">${s.l}</div></div>`)
    .join("")}</div>`;
}

/** Pointers into the clone for readers who want to go deeper. */
export function readNext(items) {
  return `<section class="readnext">
    <div class="readnext__label">Read next, in the clone</div>
    <ul>${items
      .map((i) => `<li><code>${escapeHtml(i.path)}</code><span>${i.note}</span></li>`)
      .join("")}</ul>
  </section>`;
}

/** Mount point for an interactive widget; app.js hydrates it after render. */
export const widget = (name) => `<div class="widget" data-widget="${name}"></div>`;
