/* ============================================================================
   home.js — the front page: what this is, and the map of the parts.

   The counts are derived from the data, not typed in, so they cannot go stale
   as chapters and excerpts are added.
   ========================================================================= */

import { PARTS, CHAPTERS, ORDER } from "./chapters.js";
import { pin, stats, snippetCount, snippetLineCount } from "./dsl.js";

export function renderHome() {
  const p = pin();

  return `
  <section class="hero">
    <div class="hero__kicker">${p.repo} @ ${p.short} · ${p.date}</div>
    <h1>{{TITLE}}</h1>
    <p class="hero__lead">
      {{TAGLINE}} Replace this paragraph with the argument for reading the guide: what the
      codebase does that is worth learning, and who should care. Two or three sentences.
      This is a guided reading of
      <a href="https://github.com/${p.repo}" target="_blank" rel="noopener">${p.repo}</a>.
    </p>
  </section>

  ${stats([
    { v: String(ORDER.length), l: `chapters, in ${PARTS.length} part${PARTS.length === 1 ? "" : "s"}` },
    { v: String(snippetCount()), l: "excerpts, pinned to real line numbers" },
    { v: String(snippetLineCount()), l: "lines of real source" },
    { v: "0", l: "dependencies, online or offline" },
  ])}

  <div class="prose">
    <h2 id="how-to-read-this">How this is put together</h2>
    <p>
      Every chapter follows the same rhythm, so it stays readable at length. It states
      <strong>the problem</strong> in plain terms; shows <strong>how the code solves it</strong> in
      annotated, verbatim source; distils <strong>the pattern</strong> into language-agnostic
      invariants you can carry anywhere; and lists <strong>the traps</strong> — the failure modes
      the code visibly defends against.
    </p>
    <p>
      No excerpt is retyped or paraphrased. Each one is extracted from the clone on disk by
      <code>tools/extract-snippets.mjs</code>, which pins it by anchor text rather than by line
      number and fails the build if the anchor stops resolving. The line numbers in the gutter are
      the file's real line numbers, and the header of every block links to that exact range on
      GitHub at commit <code>${p.short}</code>.
    </p>
  </div>

  <div class="parts">
    ${PARTS.map(
      (part) => `
      <a class="partcard" href="#/${part.chapters[0]}" style="--part: var(--${part.id}); --part-ink: var(--${part.id}-ink)">
        <div class="partcard__top">
          <span class="partcard__num">PART ${part.num}</span>
          <span class="partcard__title">${part.title}</span>
        </div>
        <div class="partcard__desc">${part.desc}</div>
        <div class="partcard__chapters">
          ${part.chapters.map((id) => `<span class="chip">${CHAPTERS[id].n} &nbsp;${CHAPTERS[id].title}</span>`).join("")}
        </div>
      </a>`,
    ).join("")}
  </div>

  <div class="prose">
    <h2 id="where-to-start">Where to start</h2>
    <p>
      Read it in order if you have the time. If you are here for one thing, name the entry points —
      one line per reader, each pointing at a chapter:
    </p>
    <ul>
      <li><strong>A problem the reader already has.</strong> Start at
        <a href="#/${ORDER[0]}">${CHAPTERS[ORDER[0]].title}</a>.</li>
    </ul>

    <h2 id="running-it">Running this locally</h2>
    <p>
      This page is static HTML, CSS and ES modules — no build step, no dependencies, no network.
      From the repository root:
    </p>
    <figure class="snip"><div class="snip__body"><pre><code><span class="ln">node guide/serve.js</span></code></pre></div></figure>
    <p>
      To re-verify that every excerpt still matches the source on disk — after pulling a newer
      revision, say — run the extractor in check mode. It exits non-zero and names the offending
      excerpt if anything has drifted:
    </p>
    <figure class="snip"><div class="snip__body"><pre><code><span class="ln">node tools/extract-snippets.mjs --check</span></code></pre></div></figure>
  </div>
  `;
}
