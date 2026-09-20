---
name: repo-atlas
description: "Build a local, offline web guide that teaches how a real codebase works, from its own source — annotated verbatim excerpts pinned by anchor text, worked examples built from the repository's own snapshot tests and fixtures, language-agnostic pattern distillations, interactive diagrams, and checks that fail when the prose drifts from the code. Use when the user wants to learn or teach an unfamiliar repository: an atlas, a guided reading, a deep-dive walkthrough, an architecture guide, a tutorial or onboarding site built from a repo. Includes a zero-build scaffold, so the work is reviewing and writing, not plumbing."
version: 1.1.0
---

# Repo Atlas

A method for turning a large unfamiliar codebase into a guide that someone can read end to end
and come out able to build the same thing. It ships a working zero-build web app, two
verification tools, and the editorial rules that keep the guide honest.

## What makes this different from a summary

Anyone can ask a model to explain a repository. The output is plausible, unverifiable, and stale
within a week. An atlas is different in five ways, and each one is enforced mechanically:

1. **Nothing is retyped.** Every excerpt is extracted from the clone on disk, with its real line
   numbers and a commit-pinned permalink. Excerpts are declared by *anchor text*, never a line
   number, so the build fails loudly when the code moves instead of quietly lying.
2. **Nothing is paraphrased inside quotation marks.** Words attributed to the source are checked
   against the clone word for word.
3. **The examples are recordings, not reconstructions.** What a subsystem actually produces comes
   out of the repository's own snapshot tests, golden files and fixtures — files that get
   regenerated and reviewed when the format changes. A block marked as copied is checked to be in
   the file it cites.
4. **Every chapter ends in something portable.** The reader gets the pattern — the invariants and
   the pseudocode — not just a tour of someone else's identifiers.
5. **It is verified in a browser**, not just in a terminal. Layout bugs are content bugs: a
   sentence split across a grid column is unreadable however correct the prose is.

## Before you start

Settle three things with the user, unless they already said:

| Question | Default |
|---|---|
| What should the reader be able to *do* afterwards? | Build the same subsystem themselves |
| Real source excerpts, or invented examples? | Real, annotated, plus a portable distillation |
| Where does it run? | A local static site, no build step, no dependencies, works offline |

Then get the clone. Ask for the path if they have one; otherwise `git clone`. The atlas reads it
and never writes to it.

## Scaffold first

```bash
node ~/.claude/skills/repo-atlas/scripts/init-atlas.mjs --clone <path-to-clone> --title "<Name> Atlas"
```

It writes `guide/` (the app), `tools/` (the checks), `atlas.config.json`, `package.json` and
`.claude/launch.json` into the current directory, and refuses to overwrite anything already
there. `--repo owner/name` if the clone has no origin remote, `--port` if 8137 is taken.

Serve it immediately and look at it, before writing a word:

```bash
node guide/serve.js
```

The scaffold ships one example chapter that demonstrates every helper. Read
`guide/content/01-example.js` once — it is the chapter template — then delete it when your first
real chapter exists.

## The five phases

### 1 · Review the repository

This is the bulk of the work and the part that cannot be faked. For each candidate subsystem:
find the entry point, follow the call path, and **read the tests** — a test named after a bug is
the clearest statement of intent in any repository.

Fan this out. One subagent per subsystem, each reading in parallel and reporting back in a fixed
shape: entry point, call path, two to four excerpt candidates *with their anchor text quoted
exactly*, the invariant the code preserves, and the traps it visibly defends against. Anything
that comes back without file paths and quoted anchors is not evidence; send it back.

What to look for, in order of teaching value:

- **Comments that explain a decision**, especially a delay, an ordering constraint or a
  workaround. A comment saying *why* something happens in two places is a chapter's thesis.
- **The shape of a contract**: a trait, an interface, a schema, a registry entry.
- **Special cases with a date or a bug number.** Every one is a trap someone already hit.
- **Anything the code does twice, differently** — that is a comparison worth a widget.

In the same pass, find what the repository *records*. Snapshot tests, golden files and fixtures
are the raw material for every worked example, and they are evidence in their own right — a
subsystem with forty snapshots and one with none are telling you where the risk is:

```bash
node ~/.claude/skills/repo-atlas/scripts/find-fixtures.mjs --clone <path>
node ~/.claude/skills/repo-atlas/scripts/find-fixtures.mjs --grep <term> --peek 6
```

See `references/review.md` for the full method, the subagent brief to copy, and how to choose a
syllabus from the repository's own seams rather than a generic checklist.

### 2 · Design the syllabus

Fifteen to twenty-two chapters, grouped into five to seven parts (the scaffold's colour tokens
cover seven). Each part gets a one-line promise, not a summary. Order so that later chapters can
use vocabulary the earlier ones established, and end with a capstone chapter that compresses the
whole guide into a build order.

Write it into `guide/assets/js/chapters.js` first, with leads but no content. The table of
contents is the outline; if it does not read well as a list, the guide will not read well either.

### 3 · Pin the excerpts

Declare every excerpt in `guide/data/snippets.manifest.json` by anchor text, then:

```bash
node tools/extract-snippets.mjs
```

Anchor rules, elision, offsets and the failure modes are in `references/manifest.md`. The short
version: anchor to a distinctive comment or signature, never to a brace; keep excerpts between
about 15 and 60 lines; if an excerpt needs more than four notes, it is two excerpts.

### 4 · Write the chapters

Every chapter follows the same six-beat rhythm — problem, source, example, pattern, traps, read
next. `references/authoring.md` has the DSL reference and the prose rules. The three that matter
most:

- **Notes say why, not what.** The reader can see what the line does. Tell them what it means and
  what breaks without it.
- **A quotation is a promise.** Use `<q>` for the source's own words, never an ellipsis inside
  one, and never a capital letter the source did not have. Quote each fragment separately instead.
- **An example is a recording.** Build it from a fixture, cite the file in `source`, and mark the
  blocks you copied `verbatim: true`. If you had to invent the payload, leave `source` out and say
  so in the note. `references/examples.md` has the method, including what to do when the
  repository records nothing.

### 5 · Verify

```bash
node tools/extract-snippets.mjs --check   # every anchor still resolves, uniquely
node tools/check-content.mjs              # citations, callouts, paths, quotations, examples
```

Then in the browser, at several widths and in both themes:

```js
await import('/audit-layout.js');
await auditLayout();
```

`references/verification.md` explains what each check catches, the two real bugs that escaped the
CLI checks and forced the browser audit into existence, and how to add a project-specific check
when a new class of error appears. Add a check the first time a mistake gets past you — that is
how the check list earned every entry it has.

## The rules that keep it honest

These are not style preferences. Each one exists because breaking it produced a real error.

- **Never cite a line number in prose.** Anchor text, always. Line numbers in the gutter are
  generated, never typed.
- **Never quote and edit.** No ellipsis, no changed case, no dropped hedge, no straightened
  Unicode. If a quotation is too long, quote a shorter part of it.
- **Never invent a payload.** What a subsystem produces comes from a fixture, or from running it
  and saying you did. Re-indenting a recorded block is fine; changing a value in one and still
  calling it `verbatim` is the same lie as editing a quotation.
- **Never write a count you did not count.** "The three back edges" goes stale the moment a fourth
  appears. Derive counts where you can; check them where you cannot.
- **Never claim behaviour you did not read.** If a subagent reports something you cannot find in
  the source yourself, it does not go in.
- **One widget per chapter, at most.** A widget that does not teach something a paragraph cannot
  is decoration.
- **Verify in a browser before saying it is done.** Zero console errors, no overflow, no crushed
  text, WCAG AA contrast, at 375 / 768 / 1440 px, in light and dark.

## Files this skill ships

```
scripts/init-atlas.mjs      scaffold an atlas next to a clone
scripts/find-fixtures.mjs   find the snapshots, golden files and fixtures to build examples from
assets/atlas/               what it copies: the app, the tools, the config
references/review.md        how to read a large repo and choose a syllabus
references/manifest.md      anchors, elision, offsets, failure modes
references/authoring.md     the chapter rhythm, the DSL, the prose rules
references/examples.md      worked examples: where the bytes come from, and how to abridge them
references/widgets.md       the four archetypes, and when one earns its place
references/verification.md  the checks, and how to add one
```

## A second edition, if asked

The tools take `--guide <dir>`, so a second edition — a translation, a simplified-language
rewrite, a shorter version — is a copy of `guide/` with the prose replaced and the same excerpts
and checks. Keep code, pseudocode and quotations word for word in any edition: rewriting a
quotation misreports the source no matter how good the reason.
