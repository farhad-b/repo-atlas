# repo-atlas

A Claude skill for turning a large unfamiliar codebase into a guide someone can read end to end —
a local, offline web app built out of the repository's own source.

Not a summary. Every excerpt is extracted from the clone on disk with its real line numbers and a
commit-pinned permalink; every quotation is checked word for word; every worked example is built
from the repository's own snapshot tests and fixtures, and the blocks it marks as copied are
checked to be in the file they cite; every chapter ends in a language-agnostic distillation of the
pattern. When the code moves, the build fails instead of quietly lying.

## Install

Clone it into your skills directory:

```bash
git clone git@github.com:farhad-b/repo-atlas.git ~/.claude/skills/repo-atlas
```

On Windows: `git clone git@github.com:farhad-b/repo-atlas.git %USERPROFILE%\.claude\skills\repo-atlas`

Claude picks it up on the next session. Invoke it with `/repo-atlas`, or just ask for a guide,
an atlas or a deep-dive walkthrough of a repository.

## Use

```bash
node ~/.claude/skills/repo-atlas/scripts/init-atlas.mjs --clone <path-to-clone> --title "<Name> Atlas"
node ~/.claude/skills/repo-atlas/scripts/find-fixtures.mjs --clone <path-to-clone>
node guide/serve.js
```

The scaffolder writes `guide/`, `tools/`, `atlas.config.json`, `package.json` and
`.claude/launch.json` into the current directory, and refuses to overwrite anything already
there. It reads the clone's origin remote for the `owner/name`, so `--clone` is usually the only
argument you need. `--repo`, `--port`, `--title`, `--tagline`, `--slug` and `--force` are there
when you need them.

The fixture finder ranks what the repository already records — snapshot tests, golden files,
fixtures, cassettes, schemas, sample configs — so the worked examples are built from real bytes
rather than remembered ones. `--grep <term>` finds the recording for the subsystem you are writing
about; `--dir`, `--kind`, `--peek`, `--limit` and `--json` narrow it.

Then the work: read the repository, declare excerpts by anchor text, write chapters, verify.

```bash
node tools/extract-snippets.mjs --check   # every anchor still resolves, uniquely
node tools/check-content.mjs              # citations, callouts, paths, quotations, examples
```

And in the browser, at 375 / 768 / 1440 px in both themes:

```js
await import('/audit-layout.js');
await auditLayout();
```

## What is in the box

```
SKILL.md                    the method: five phases, and the rules that keep it honest
references/review.md        how to read a large repo, and the subagent brief
references/manifest.md      anchors, elision, offsets, failure modes
references/authoring.md     the chapter rhythm, the DSL, the prose rules
references/examples.md      worked examples: where the bytes come from, how to abridge them
references/widgets.md       the four archetypes, and when one earns its place
references/verification.md  the checks, and how to add one
scripts/init-atlas.mjs      the scaffolder
scripts/find-fixtures.mjs   the fixture finder
assets/atlas/               what it copies:
  guide/                      a zero-build static SPA — hash router, lazy chapters,
                              client-side search, light/dark, a hand-written highlighter
                              for Rust, Go, Python, JS/TS, C-family, TOML, YAML, JSON,
                              Markdown, shell and Lisp
  guide/widgets/              four data-driven diagrams: stepper, matrix, timeline, module-map
  guide/audit-layout.js       a devtools layout audit: overflow, crushed text, split grid
                              cells, WCAG AA contrast, console errors, every route × theme
  tools/                      the two verification scripts
```

No dependencies, no build step, no network. Node 18+ for the tools; the guide is static files.

## The rules it enforces

Each one exists because breaking it produced a real error in the guide this skill was extracted
from:

- **Never cite a line number in prose.** Anchor text, always. Gutter numbers are generated.
- **Never quote and edit.** No ellipsis inside a quotation, no changed case, no dropped hedge, no
  straightened Unicode. Quote a shorter fragment instead.
- **Never invent a payload.** An example's bytes come from a fixture, or from running the thing
  and saying you did.
- **Never write a count you did not count.** "The three back edges" goes stale the moment a
  fourth appears.
- **Never claim behaviour you did not read.** A subagent's word is not evidence.
- **One widget per chapter, at most.**
- **Verify in a browser before calling it done.** Layout bugs are content bugs.

## Origin

Extracted from a 20-chapter atlas of [openai/codex](https://github.com/openai/codex) — 63
excerpts, 994 lines of real source, 28 worked examples, six interactive diagrams — after that
guide had been built, broken, fixed and verified. The checks in `tools/` are the ones that caught
the errors; the rules in `SKILL.md` are the ones that would have prevented them.

Grounding the examples in that atlas turned up three claims in the prose that were wrong — a
paraphrased tool description, an approval mode that does not exist, a tool signature remembered
rather than read. All three were in chapters that had passed every other check. That is why
`find-fixtures.mjs` and the `verbatim` check exist.
