/* ============================================================================
   app.js — router, navigation, on-this-page rail, search, theme, widgets.
   ========================================================================= */

import { PARTS, CHAPTERS, ORDER, PART_OF } from "./chapters.js";
import { installSnippets, pin, chapterHead } from "./dsl.js";
import { renderHome } from "./home.js";
import { mountWidget } from "../../widgets/index.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const els = {
  page: $("#page"),
  pager: $("#pager"),
  nav: $("#nav-tree"),
  rail: $("#rail"),
  sidebar: $("#sidebar"),
  scrim: $("#sidebar-scrim"),
  progress: $("#progress i"),
};

/* ---------------------------------------------------------------- boot -- */

const loaded = new Map(); // chapter id -> module
let searchIndex = null;

async function boot() {
  const data = await fetch("data/snippets.json").then((r) => r.json());
  installSnippets(data);

  const p = pin();
  $("#pin-label").textContent = `${p.repo} @ ${p.short}`;
  $("#foot-sha").textContent = p.sha;
  $("#foot-repo").href = `https://github.com/${p.repo}/tree/${p.sha}`;
  if (!navigator.platform.toLowerCase().includes("mac")) {
    // keep the default "Ctrl K" label
  } else {
    $("#search-kbd").textContent = "⌘ K";
  }

  buildNav();
  wireChrome();
  window.addEventListener("hashchange", route);
  await route();
}

/* --------------------------------------------------------------- nav ---- */

function buildNav() {
  els.nav.innerHTML = PARTS.map(
    (part) => `
    <div class="navpart" style="--part: var(--${part.id}); --part-ink: var(--${part.id}-ink)">
      <div class="navpart__label"><span class="navpart__num">${part.num}</span>${part.title}</div>
      ${part.chapters
        .map((id) => {
          const ch = CHAPTERS[id];
          return `<a class="navlink" href="#/${id}" data-ch="${id}"><span class="navlink__n">${ch.n}</span><span>${ch.title}</span></a>`;
        })
        .join("")}
    </div>`,
  ).join("");
}

function markNav(active) {
  $$(".navlink", els.nav).forEach((a) => {
    if (a.dataset.ch === active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

/* ------------------------------------------------------------- router -- */

function currentId() {
  const raw = location.hash.replace(/^#\/?/, "").trim();
  return raw && CHAPTERS[raw] ? raw : "";
}

async function route() {
  const id = currentId();
  closeSidebar();

  if (!id) {
    document.body.dataset.part = "p1";
    els.page.innerHTML = renderHome();
    els.pager.innerHTML = "";
    els.rail.innerHTML = "";
    document.title = "{{TITLE}}";
    markNav("");
    afterRender();
    return;
  }

  const ch = CHAPTERS[id];
  document.body.dataset.part = PART_OF[id].id;
  document.title = `${ch.title} · {{TITLE}}`;
  markNav(id);

  els.page.innerHTML = `<div class="loadingbar"></div>`;

  let mod = loaded.get(id);
  if (!mod) {
    try {
      mod = await ch.load();
      loaded.set(id, mod);
    } catch (err) {
      els.page.innerHTML = `<div class="problem"><div class="problem__label">Chapter failed to load</div><p>${String(err)}</p></div>`;
      return;
    }
  }

  els.page.innerHTML = chapterHead(ch) + `<div class="prose">${mod.render()}</div>`;
  buildPager(id);
  buildRail();
  afterRender();
  els.page.scrollIntoView({ block: "start", behavior: "instant" });
  window.scrollTo(0, 0);
}

function buildPager(id) {
  const i = ORDER.indexOf(id);
  const prev = i > 0 ? CHAPTERS[ORDER[i - 1]] : null;
  const next = i < ORDER.length - 1 ? CHAPTERS[ORDER[i + 1]] : null;
  els.pager.innerHTML =
    (prev
      ? `<a class="pagerlink pagerlink--prev" href="#/${prev.id}"><span class="pagerlink__dir">← ${prev.n}</span><span class="pagerlink__title">${prev.title}</span></a>`
      : "") +
    (next
      ? `<a class="pagerlink pagerlink--next" href="#/${next.id}"><span class="pagerlink__dir">${next.n} →</span><span class="pagerlink__title">${next.title}</span></a>`
      : "");
}

/* --------------------------------------------------- on this page rail -- */

let railObserver = null;

function buildRail() {
  const heads = $$("h2[id], h3[id]", els.page);
  if (heads.length < 2) {
    els.rail.innerHTML = "";
    return;
  }
  els.rail.innerHTML =
    `<div class="rail__label">On this page</div>` +
    heads
      .map(
        (h) =>
          `<a href="#${h.id}" data-depth="${h.tagName === "H3" ? 3 : 2}" data-target="${h.id}">${h.textContent}</a>`,
      )
      .join("");

  railObserver?.disconnect();
  const links = new Map($$("a", els.rail).map((a) => [a.dataset.target, a]));
  const visible = new Set();
  railObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      }
      const first = heads.find((h) => visible.has(h.id));
      links.forEach((a) => a.classList.remove("is-active"));
      if (first) links.get(first.id)?.classList.add("is-active");
    },
    { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
  );
  heads.forEach((h) => railObserver.observe(h));
}

/* ------------------------------------------------------- after render -- */

function afterRender() {
  // Give every heading a stable id so the rail and deep links work.
  $$("h2, h3", els.page).forEach((h) => {
    if (!h.id) h.id = slug(h.textContent);
  });
  $$("[data-widget]", els.page).forEach((el) => mountWidget(el.dataset.widget, el));
  updateProgress();
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/* --------------------------------------------------------- chrome ------ */

function wireChrome() {
  // Theme
  $("#theme-toggle").addEventListener("click", () => {
    const cur =
      document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("{{SLUG}}-theme", next);
    } catch (e) {}
  });

  // Mobile sidebar
  $("#menu-toggle").addEventListener("click", () => {
    const open = els.sidebar.classList.toggle("is-open");
    els.scrim.hidden = !open;
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
  });
  els.scrim.addEventListener("click", closeSidebar);

  // Copy buttons (delegated — snippets are re-rendered on every route)
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const fig = btn.closest(".snip");
    const text = $$(".ln", fig)
      .map((ln) => ln.textContent.replace(/^\s*\d+/, ""))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add("is-done");
      btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>`;
      setTimeout(() => {
        btn.classList.remove("is-done");
        btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"/></svg>`;
      }, 1400);
    } catch (err) {
      /* clipboard blocked — nothing useful to do */
    }
  });

  window.addEventListener("scroll", updateProgress, { passive: true });
  wireSearch();
}

function closeSidebar() {
  els.sidebar.classList.remove("is-open");
  els.scrim.hidden = true;
  $("#menu-toggle").setAttribute("aria-expanded", "false");
}

function updateProgress() {
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  els.progress.style.width = max > 40 ? `${(h.scrollTop / max) * 100}%` : "0%";
}

/* --------------------------------------------------------- search ------ */

function wireSearch() {
  const modal = $("#searchmodal");
  const input = $("#search-input");
  const results = $("#search-results");
  let active = 0;

  const open = async () => {
    modal.hidden = false;
    input.value = "";
    input.focus();
    results.innerHTML = `<div class="sempty">Type to search all ${ORDER.length} chapters.</div>`;
    if (!searchIndex) searchIndex = await buildIndex();
  };
  const close = () => {
    modal.hidden = true;
  };

  $("#search-open").addEventListener("click", open);
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      modal.hidden ? open() : close();
      return;
    }
    if (modal.hidden) {
      // "/" opens search when not typing in a field
      if (e.key === "/" && !/input|textarea/i.test(e.target.tagName)) {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === "Escape") return close();
    const items = $$(".sresult", results);
    if (!items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle("is-active", i === active));
      items[active].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.click();
    }
  });

  input.addEventListener("input", () => {
    active = 0;
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results.innerHTML = `<div class="sempty">Type to search all ${ORDER.length} chapters.</div>`;
      return;
    }
    const hits = search(q).slice(0, 12);
    if (!hits.length) {
      results.innerHTML = `<div class="sempty">Nothing matches “${escapeText(input.value)}”.</div>`;
      return;
    }
    results.innerHTML = hits
      .map(
        (h, i) => `<a class="sresult${i === 0 ? " is-active" : ""}" href="#/${h.id}"
          style="--part: var(--${h.partId})">
        <span class="sresult__top">
          <span class="sresult__title">${h.title}</span>
          <span class="sresult__part">${h.partTitle}</span>
        </span>
        <span class="sresult__snip">${h.excerpt}</span>
      </a>`,
      )
      .join("");
    $$(".sresult", results).forEach((el) => el.addEventListener("click", close));
  });
}

/** Load every chapter once and index its plain text. */
async function buildIndex() {
  const docs = [];
  for (const id of ORDER) {
    let mod = loaded.get(id);
    if (!mod) {
      mod = await CHAPTERS[id].load();
      loaded.set(id, mod);
    }
    const ch = CHAPTERS[id];
    const tmp = document.createElement("div");
    tmp.innerHTML = mod.render();
    const text = (ch.lead + " " + tmp.textContent).replace(/\s+/g, " ").trim();
    docs.push({
      id,
      title: ch.title,
      partId: PART_OF[id].id,
      partTitle: PART_OF[id].title,
      text,
      lower: (ch.title + " " + text).toLowerCase(),
    });
  }
  return docs;
}

function search(q) {
  const terms = q.split(/\s+/).filter(Boolean);
  const out = [];
  for (const d of searchIndex) {
    let score = 0;
    let firstAt = -1;
    for (const t of terms) {
      const inTitle = d.title.toLowerCase().includes(t);
      const at = d.lower.indexOf(t);
      if (at === -1 && !inTitle) {
        score = -1;
        break;
      }
      score += inTitle ? 40 : 8;
      const bodyAt = d.text.toLowerCase().indexOf(t);
      if (bodyAt !== -1 && firstAt === -1) firstAt = bodyAt;
    }
    if (score <= 0) continue;
    out.push({ ...d, score, excerpt: excerptAround(d.text, firstAt, terms) });
  }
  return out.sort((a, b) => b.score - a.score);
}

function excerptAround(text, at, terms) {
  if (at < 0) at = 0;
  const start = Math.max(0, at - 60);
  let slice = text.slice(start, start + 190);
  if (start > 0) slice = "…" + slice;
  if (start + 190 < text.length) slice += "…";
  let html = escapeText(slice);
  for (const t of terms) {
    html = html.replace(new RegExp(`(${escapeRe(t)})`, "ig"), "<mark>$1</mark>");
  }
  return html;
}

const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

boot();
