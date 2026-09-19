# Widgets

A widget is a hand-built DOM/SVG module in `guide/widgets/`, mounted where a chapter writes
`widget("name")`. No charting library, no diagram library, no build step.

**A widget earns its place when a paragraph cannot do the job**: when the subject is a *process*
(order matters, and it loops), a *comparison* (the same job done several ways), or a *decision*
(inputs combine into a verdict). Anything else is decoration, and decoration in a technical guide
costs the reader trust.

One widget per chapter at most. Four to six in a whole guide is plenty.

## The four archetypes that ship

| Module | Shape | Use it for |
|---|---|---|
| `stepper.js` | Ordered list + detail pane, back edges marked | A loop or pipeline, in execution order |
| `matrix.js` | Grid of cells + detail pane | The same job done N different ways |
| `timeline.js` | Points and phases on an axis | Extension points: hooks, events, callbacks |
| `module-map.js` | Filterable grid, grouped | "Where does X live" — almost every atlas wants this |

Each is data-driven: a constant array at the top of the file, and generic mount code below it.
**Replace the array and the `frame()` call; leave the rest alone.** The comments at the top of
each module say what each field is for.

Two more archetypes have styling in `widgets.css` but no module, because their content is too
project-specific to template usefully:

- **`.cb` — a meter.** A stacked bar that fills toward a threshold. For budgets: context windows,
  quotas, rate limits. Build it when you have a chapter about a number that runs out.
- **`.pt` — a decision tree.** Inputs across the top, a path highlighted through the rules, a
  verdict at the bottom. For permission models, routing rules, config resolution. This is the
  most valuable widget a safety chapter can have, and the most work: it is only honest if the
  tree matches the real decision order in the code.

Delete the CSS blocks for archetypes you do not use.

## Adding one

1. Write `guide/widgets/<name>.js` exporting `mount(el)`.
2. Add one line to the `REGISTRY` in `guide/widgets/index.js`.
3. Use `frame(el, {label, title, hint})` for the chrome, and `h(tag, attrs, ...kids)` for SVG or
   DOM building — `h` handles the SVG namespace, so `h("path", {d: …})` works.

```js
import { frame, h } from "./index.js";

const DATA = [ /* the project-specific part, and the only part */ ];

export function mount(el) {
  const body = frame(el, { label: "Interactive", title: "…", hint: "…" });
  // build into `body`
}
```

## Rules

- **The data is read out of the source, like everything else.** Names in a module map are real
  directory names. Steps in a stepper are in the order the code executes them. A map with
  invented place names is worse than no map.
- **Say what the reader should notice.** The `hint` line under the title is the widget's thesis.
  "Three of these steps jump backwards — that is the whole trick" is worth more than the widget.
- **Keyboard and pointer both.** The shipped archetypes use real `<button>` elements, so they
  already work with tab and enter. Do not replace them with clickable `<div>`s.
- **No animation that the reader did not ask for.** Transitions on hover and selection are fine;
  anything that moves on its own competes with the prose.
- **Check it at 375 px.** Every shipped archetype reflows to one column. If yours does not, it is
  not finished.
