/* ============================================================================
   audit-layout.js — the checks that need a real browser.

   Not part of the app; nothing imports it. It is served only so it can be
   loaded from the devtools console in one line.

   The CLI checkers (extract-snippets, check-content) verify that the guide's
   claims match the source. They cannot see layout. This file covers what only
   a rendering engine can tell you, and it exists because two bugs got past the
   CLI checks: inline <code> overflowing narrow screens, and a `display: grid`
   list item splitting its own sentence into two grid cells.

   Usage — open the guide, open devtools, and run:

       await import('/audit-layout.js');
       await auditLayout()                    // current viewport, both themes
       await auditLayout({ verbose: true })   // list every finding

   Resize the window and run it again; the viewport-dependent checks only
   report what is true at the width you are looking at.

   It navigates every route, so give it a few seconds. Nothing is mutated
   permanently; the theme is restored at the end.
   ========================================================================= */

globalThis.auditLayout = async function auditLayout({ verbose = false } = {}) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* -- colour maths ------------------------------------------------------
     Chrome reports color-mix() and backdrop results as `color(srgb r g b / a)`
     with 0..1 components, while rgb()/rgba() use 0..255. Getting this wrong
     silently produces nonsense contrast numbers, so handle both. */
  const parse = (c) => {
    const n = (c.match(/-?[\d.]+/g) || []).map(Number);
    return c.startsWith("color(")
      ? { r: n[0] * 255, g: n[1] * 255, b: n[2] * 255, a: n.length > 3 ? n[3] : 1 }
      : { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255), v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const over = (f, b) => ({
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
    a: 1,
  });
  /** Composite every translucent layer down to an opaque colour. */
  const bgOf = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.a > 0) stack.push(c);
      if (c.a >= 1) break;
    }
    if (!stack.length || stack[stack.length - 1].a < 1) stack.push({ r: 255, g: 255, b: 255, a: 1 });
    let acc = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };

  const scrollsSomewhere = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const ov = getComputedStyle(n).overflowX;
      if (ov === "auto" || ov === "scroll") return true;
    }
    return false;
  };
  const label = (el) => (el.className || el.tagName).toString().split(" ")[0];

  const { ORDER } = await import("/assets/js/chapters.js");
  const routes = ["", ...ORDER];
  const themeBefore = document.documentElement.dataset.theme;

  const errors = [];
  const onErr = (e) => errors.push(e.message ?? String(e.reason));
  addEventListener("error", onErr);
  addEventListener("unhandledrejection", onErr);

  const overflow = new Set();
  const splitGrid = new Set();
  const contrast = new Set();
  const crushed = new Set();
  let nodes = 0;
  let tables = 0;
  let tablesScrolling = 0;

  for (const theme of ["dark", "light"]) {
    document.documentElement.dataset.theme = theme;
    for (const id of routes) {
      location.hash = id ? `#/${id}` : "#/";
      await wait(120);
      const page = id || "home";
      const limit = document.documentElement.clientWidth;

      for (const el of document.querySelectorAll("#page *, #rail *, .sidebar *, .topbar *, #pager *")) {
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el);

        // 1. anything sticking out of the viewport that cannot scroll on its own
        if (box.width && box.right > limit + 1.5 && !scrollsSomewhere(el))
          overflow.add(`${page}: ${label(el)} → ${Math.round(box.right)}px > ${limit}`);

        // 2. a grid container holding BOTH element children and loose text:
        //    each becomes its own grid item, so a sentence gets split across cells
        if (
          (cs.display === "grid" || cs.display === "inline-grid") &&
          el.children.length &&
          [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
        )
          splitGrid.add(`${page}: ${(el.className || el.tagName).toString()}`);

        // 3. text squeezed into a column too narrow to read.
        //    Measure the containing block, not the element: a wrapped *inline*
        //    element's rect is the union of its line boxes, so it is narrower
        //    than its container by construction and would always look crushed.
        const ownText = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join("");
        if (ownText.length > 25 && box.height > 40) {
          const block = /^(inline|inline-block|contents)$/.test(cs.display)
            ? el.parentElement?.getBoundingClientRect().width
            : box.width;
          if (block > 0 && block < 90)
            crushed.add(`${page}: ${label(el)} → ${ownText.length} chars in ${Math.round(block)}px`);
        }

        // 4. WCAG AA on anything that renders its own text
        if (el.firstChild?.nodeType === 3 && el.textContent.trim().length >= 2) {
          if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.9) continue;
          const fg = parse(cs.color);
          if (fg.a < 0.9) continue;
          nodes++;
          const px = parseFloat(cs.fontSize);
          const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
          const r = ratio(fg, bgOf(el));
          if (r < (large ? 3 : 4.5))
            contrast.add(`${theme} · ${label(el)} @${px}px → ${r.toFixed(2)}:1 (${page})`);
        }
      }

      if (theme === "dark")
        for (const w of document.querySelectorAll(".tablewrap")) {
          tables++;
          if (w.scrollWidth > w.clientWidth + 1) tablesScrolling++;
        }
    }
  }

  removeEventListener("error", onErr);
  removeEventListener("unhandledrejection", onErr);
  if (themeBefore) document.documentElement.dataset.theme = themeBefore;
  else delete document.documentElement.dataset.theme;

  const show = (s) => (s.size ? (verbose ? [...s] : [...s].slice(0, 6)) : "none");
  const report = {
    viewport: `${innerWidth}×${innerHeight}`,
    routes: routes.length,
    textNodesChecked: nodes,
    consoleErrors: errors.length ? errors : "none",
    horizontalOverflow: show(overflow),
    gridSplittingText: show(splitGrid),
    crushedText: show(crushed),
    contrastFailures: show(contrast),
    tables: `${tablesScrolling}/${tables} scrolling at this width`,
  };
  const clean =
    !errors.length && !overflow.size && !splitGrid.size && !crushed.size && !contrast.size;
  console.log(clean ? "%c✓ layout audit clean" : "%c✗ layout audit found problems",
    `color:${clean ? "#5fca7c" : "#f0706a"};font-weight:700`);
  console.table(report);
  return report;
};

console.log("auditLayout() ready — run: await auditLayout()");
