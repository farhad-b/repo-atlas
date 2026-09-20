# Verification

Two CLI scripts check that the guide's claims match the source. A browser script checks what only
a rendering engine can tell you. Both kinds are necessary, and the second only exists because
real bugs got past the first.

## The CLI checks

```bash
node tools/extract-snippets.mjs --check   # ~1s
node tools/check-content.mjs              # ~1s
```

`extract-snippets --check` resolves every anchor in the manifest. It fails when an anchor is
missing, ambiguous, or resolves to a range outside the file — that is, whenever the guide would
otherwise show something that is no longer true.

`check-content.mjs` reads the chapter modules as text and checks:

| Check | Catches |
|---|---|
| every `snip("id")` exists in the manifest | a citation that silently renders as "missing snippet" |
| every callout line is inside its excerpt, and not inside an elided run | a note pointing at a line the reader cannot see |
| every `readNext` path exists in the clone | a file renamed upstream |
| every `widget("name")` has a module | a typo that renders "unknown widget" |
| every `<q>` appears in the clone word for word | a quotation that drifted |
| every `example({source})` path is in the clone | a fixture renamed out from under a citation |
| every `verbatim: true` block is in that file | a "recorded" payload that was edited, rounded or invented |
| unused manifest entries, links to chapters that do not exist | dead weight, dead links |

The quotation check strips comment markers, joins lines and ignores Markdown emphasis, so a
quotation may span several lines of a doc comment. It refuses any `<q>` containing an ellipsis:
an ellipsis hides what was dropped, and that is exactly how a hedge goes missing. It also reports
when a quotation matches only if case is ignored, because "A handoff summary" and "a handoff
summary" are different quotations.

The example checks hold a claim you chose to make. `source` says "this came from that file", and
`verbatim: true` says "these bytes are in it" — so the checker resolves the path and searches the
file, ignoring indentation and wrapping. Neither is required: an example with no `source` is
legitimate, and the summary line prints the ratio
(`28 examples · 77 literal blocks · 41 checked against a cited file`) so it stays visible rather
than becoming a habit nobody notices.

**What still is not checked is the unanchored part of an example** — the scenario, the step prose,
and any block you did not mark. That is as true as you made it. Say in `note` which numbers are
illustrative; an unmarked invented constant is the failure mode this part of a guide has.

### Add a check when a mistake gets past you

Every check in that table was added after an error shipped. When you find a new class of error —
not a typo, a *class* — add a dozen lines under "project-specific checks" in `check-content.mjs`
rather than resolving to be more careful. Things worth checking in most atlases:

- every module named in the module-map widget is a real directory in the clone
- every heading that counts something matches the number of things the excerpt contains
- every config key named in prose exists in the schema

**Negative-test a new check.** Re-introduce the error into a scratch copy, confirm the check
reports it, then delete the copy. A check that has never failed has never been tested.

## The browser audit

The CLI cannot see layout. Load the guide, open devtools, and run:

```js
await import('/audit-layout.js');
await auditLayout();
```

It walks every route in both themes and reports:

- **console errors** — anything thrown during render or widget mount
- **horizontal overflow** — elements wider than their container at this width
- **crushed text** — long text in a column too narrow to read
- **grid cells splitting text** — a sentence broken across grid columns
- **WCAG AA contrast** on every text node, resolving `color-mix()` and `color(srgb …)`
- **tables** that crush instead of scrolling

Viewport-dependent checks only report what is true at the width you are looking at, so run it at
**375, 768 and 1440 px**, in both themes. If the pane reports `viewport: 0×0`, it has no layout
yet — give it a real size and run again, or every element will appear to overflow.

## The two bugs that made this necessary

Both passed every CLI check, both were visible on every page, and neither was caught by reading
the code:

1. **`white-space: nowrap` on inline `<code>`** — fine on a desktop, a horizontal scrollbar on
   every narrow screen.
2. **`display: grid` on a list item** to get a counter column. Each child *element* becomes its
   own grid item, and a run of text between elements becomes an anonymous one — so a list item
   reading `<strong>Bold lead.</strong> the rest of the sentence` put the bold half in the 24px
   counter column and the rest in the text column. The fix is an absolutely positioned `::before`,
   which keeps the item one continuous text flow. The comment above that rule in `components.css`
   explains it, because it is the kind of bug that gets reintroduced.

A related trap lives in the audit itself: an inline element's `getBoundingClientRect()` returns
the union of its line boxes, so a wrapped `<strong>` always looks impossibly narrow. The audit
measures the containing block for inline displays. If you extend it, keep that.

## Before you call it done

- `extract-snippets --check` and `check-content` both clean
- the audit clean at 375 / 768 / 1440 px, in light and dark
- every widget clicked at least once, at the narrowest width
- search opens, finds a word from a chapter body, and navigates
- the guide read end to end, in the browser, in order — the only way to catch a chapter that
  contradicts a later one
