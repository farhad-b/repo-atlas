# Writing a chapter

A chapter is an ES module in `guide/content/NN-id.js` exporting `render()`, which returns HTML
built from the helpers in `guide/assets/js/dsl.js`. `app.js` supplies the chapter header, the
`.prose` wrapper, heading ids, the on-this-page rail and widget mounting.

`guide/content/01-example.js` in the scaffold is a working demonstration of every helper. Copy it
for the first chapter; delete it once a real one exists.

## The rhythm

Five beats, always in this order. It is what lets someone read twenty chapters without fatigue —
they learn the shape once and then know where to look.

```
problem()     the question, in two sentences, with no jargon
snip()        how the code answers it — verbatim, annotated
pattern()     the transferable shape: invariants + pseudocode
traps()       what breaks if you get it wrong
readNext()    where to go in the clone
```

Between the beats, ordinary prose with `<h2 id="…">` sections. Two to four excerpts per chapter.
A chapter that does not fit the rhythm is usually two chapters.

### 1 · The problem

Two sentences, plus a twist. State the problem the subsystem exists to solve **before naming any
of its machinery**, then say why the obvious solution stops working. If a reader who has never
seen this codebase cannot follow it, rewrite it.

> Most harnesses handle this by concatenating strings into a system prompt. That works exactly
> until you need to *remove* something you injected — at which point you are writing regexes
> against your own prompt.

### 2 · The source

`snip("id", { notes, hl, caption })`. Notes are keyed by **real file line number**, so a callout
stays attached to its line when the file above it changes. The checker refuses a note on a line
outside the excerpt or inside an elided run.

**Notes say why, not what.** The reader can see that line 58 sets a marker. Tell them that the
marker is what makes the fragment findable later, and that without it nothing injected can ever
be updated or removed. Two to four notes; if you need eight, the excerpt is doing too much.

The `caption` is one sentence for what did not fit in a note — scale, usually ("sixty lines, and
about forty-five implementations across the crate").

Use `code(text, lang, label)` for anything *not* from the repo: pseudocode, a config sample, a
shell line, a paraphrased enum. It never claims a source, so it cannot misquote one.

### 3 · The pattern

The reason the guide is useful to someone writing in another language. Four to six invariants,
each starting with a bolded imperative and followed by one or two sentences of why. Then
pseudocode short enough to hold in the head — twenty lines at the outside.

Nothing in a pattern card should mention the repository, its types, or its language. If an
invariant only makes sense with the source in front of you, it is a note, not an invariant.

### 4 · The traps

A trap is a failure mode with a symptom, not a warning. "You will get an unknown-tool error you
cannot reproduce" teaches; "be careful here" does not. Take them from what the code visibly
defends against — a comment explaining a delay, a special case, a test named after a bug. Three
to five.

### 5 · Read next

Two to four paths into the clone, each with one line on what the reader will find. The checker
requires every path to exist, so a rename fails the build instead of sending the reader nowhere.

## The DSL

| Helper | Use |
|---|---|
| `problem(html)` | The opening block. One per chapter. |
| `snip(id, opts)` | A pinned excerpt. `opts`: `notes` (line → html), `hl` (lines), `caption`. |
| `code(text, lang, label)` | Code that is not from the repo. |
| `pattern({title, invariants, pseudo, note})` | The distillation. One per chapter. |
| `traps([{t, b}])` | Failure modes. |
| `key(html)` | One sentence, emphasised. About one per chapter. |
| `table(headers, rows)` | Comparison on a fixed axis. Wide tables scroll rather than crush. |
| `cards([{t, b, kind}])` | Two to four parallel things of equal weight. |
| `stats([{v, l}])` | Three or four numbers, each with a unit. Only numbers you counted. |
| `readNext([{path, note}])` | Pointers into the clone. |
| `widget(name)` | A mount point. At most one per chapter. |
| `c(text)` | Inline `<code>`, escaped. |

Headings get ids automatically from their text, but write `<h2 id="stable-id">` by hand for any
heading you link to — an id derived from text changes when you edit the text, and the checker
warns about links to chapters that do not exist but cannot know about a heading you renamed.

## Prose rules

- **Front-load.** Readers skim until something catches, then read backwards. Put the load-bearing
  idea in the first sentence of the paragraph.
- **Short paragraphs.** Three to five sentences.
- **No hedging about the code.** Either you read it or you did not. "Appears to" and "presumably"
  mean go back and read it.
- **A quotation is a promise.** Source words go in `<q>…</q>` and are checked word for word
  against the clone: case, punctuation, and characters like a non-breaking hyphen. Never put an
  ellipsis inside a quotation — quote each fragment separately, in its own `<q>`. An ellipsis is
  how a hedge ("Typically, you should…") disappears from a quotation and turns a careful sentence
  into a confident one.
- **Never write a count you did not count.** A heading like "The three back edges" goes stale the
  moment someone adds a fourth. Count it, and add a check if the count matters.
- **Name the trade-off.** Every interesting design decision cost something. A chapter that lists
  only benefits was not read carefully enough.

## Adding a chapter

1. `guide/content/NN-id.js` — the module.
2. `guide/assets/js/chapters.js` — one entry in `CHAPTERS`, and its id in a part's `chapters`.

Nothing else in the app needs to know. Chapters are lazily imported, so a page load fetches only
the chapter asked for; search builds its index on first use by loading all of them.
