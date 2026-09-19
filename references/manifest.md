# The snippet manifest

`guide/data/snippets.manifest.json` declares every excerpt in the guide. `tools/extract-snippets.mjs`
resolves it against the clone and writes `guide/data/snippets.json`, which the app loads.

**Excerpts are declared by anchor text, never by line number.** A line number is a claim about a
file that stops being true silently. An anchor either resolves uniquely or fails the build.

## An entry

```json
{
  "id": "fragment-trait",
  "path": "codex-rs/context-fragments/src/fragment.rs",
  "start": "/// Context payload that is injected as a message fragment.",
  "end": "    fn into_boxed_response_item(self: Box<Self>) -> ResponseItem {",
  "endOffset": 2
}
```

| Key | Meaning |
|---|---|
| `id` | kebab-case; what `snip("id")` refers to. Unique across the manifest. |
| `path` | Relative to the clone root. |
| `start` | Anchor text for the first line. Must be unique in the file. |
| `end` | Anchor text for the last line. Searched *after* `start`, so it only has to be unique below it. |
| `lines` | Instead of `end`: take exactly N lines from the start. |
| `startOffset` / `endOffset` | Shift the resolved boundary by ±N lines. For pinning to a landmark and taking what is next to it. |
| `elide` | `[[from, to], …]` — runs to hide behind a `⋯` marker. Resolved *within the excerpt*, so they only need to be unique there. |
| `lang` | Override the language guessed from the extension. |
| `dedent` | `false` to keep the original indentation. Default strips the common prefix. |

Anchors may span lines: `"foo\n    bar"` matches a two-line run. The first and last lines of a
multi-line anchor match as substrings; interior lines must match exactly (ignoring trailing
whitespace). This is how you anchor to a closing brace, which is never unique alone.

## Choosing an anchor

Good anchors are **distinctive and load-bearing**: a doc comment's first line, a function
signature, a comment that explains a decision. If the line reads as something a maintainer would
keep while refactoring around it, it is a good anchor.

Bad anchors, in order of how often they bite:

- `}` or `});` — never unique.
- `let mut result = Vec::new();` — boilerplate, appears everywhere.
- A line you had to count to find. If you are counting, you are using line numbers with extra
  steps.
- The *last* line of a long function, when the first would do with `lines: 20`.

When an anchor breaks after an upstream pull, the error names the snippet and the anchor. Fix it
by picking a new anchor in the source, not by adjusting an offset until the output looks right —
an offset that compensates for a moved anchor is a line number again.

## Excerpt shape

- **15–60 lines.** Shorter has no context; longer is skimmed.
- **One idea.** If the excerpt needs more than four notes, split it.
- **Elide what you are not talking about** — a derive block, an import list, an error-conversion
  arm. The elided lines stay in `code` so the tokeniser still sees correct string and comment
  boundaries, and the gutter keeps showing true file line numbers either side of the marker.
- **Never edit the code.** Not to shorten, not to fix a typo, not to remove a `#[cfg]`. The whole
  value is that it is what is on disk.

## Running it

```bash
node tools/extract-snippets.mjs           # build guide/data/snippets.json + pin.json
node tools/extract-snippets.mjs --check   # verify only; exits non-zero on drift
node tools/extract-snippets.mjs --guide guide-alt
```

The pin (`sha`, `short`, `date`) comes from the clone's `HEAD`, so permalinks always point at the
commit the guide was read from. After `git -C <clone> pull`, re-run without `--check`: every
excerpt is re-extracted, and anything that no longer resolves is reported by name.

For a non-GitHub host, set `permalink` in `atlas.config.json` — `{repo}`, `{sha}`, `{path}`,
`{start}`, `{end}` are substituted. Set it to `""` for a clone with no public home, and the
excerpt headers stop linking anywhere.
