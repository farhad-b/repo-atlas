/* ============================================================================
   widgets/index.js — registry + lazy mounting.

   Chapters drop a mount point with `widget('stepper')`; app.js calls
   mountWidget after each render. Each widget is a module exporting
   `mount(el)`. They are hand-built DOM/SVG — no charting or diagram library.

   Add a widget: write widgets/<name>.js, add one line here. A widget used by
   more than one chapter should take its data from the chapter instead of a
   module-level constant; none of the four shipped here do, because each one
   teaches a single thing.
   ========================================================================= */

const REGISTRY = {
  stepper: () => import("./stepper.js"),
  matrix: () => import("./matrix.js"),
  timeline: () => import("./timeline.js"),
  "module-map": () => import("./module-map.js"),
};

export async function mountWidget(name, el) {
  const loader = REGISTRY[name];
  if (!loader) {
    el.innerHTML = `<div class="widget__err">unknown widget: ${name}</div>`;
    return;
  }
  if (el.dataset.mounted === "1") return;
  el.dataset.mounted = "1";
  try {
    const mod = await loader();
    mod.mount(el);
  } catch (err) {
    el.dataset.mounted = "0";
    el.innerHTML = `<div class="widget__err">${name} failed to load: ${String(err)}</div>`;
  }
}

/* -- shared chrome ------------------------------------------------------- */

export function frame(el, { label, title, hint = "" }) {
  el.innerHTML = `
    <div class="widget__head">
      <span class="widget__label">${label}</span>
      <span class="widget__title">${title}</span>
    </div>
    <div class="widget__body"></div>
    ${hint ? `<div class="widget__hint">${hint}</div>` : ""}`;
  return el.querySelector(".widget__body");
}

export const h = (tag, attrs = {}, ...kids) => {
  const ns = /^(svg|g|path|rect|circle|line|text|polyline|polygon|defs|marker|tspan|ellipse)$/.test(tag);
  const node = ns
    ? document.createElementNS("http://www.w3.org/2000/svg", tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.setAttribute("class", v);
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};
