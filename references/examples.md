# Worked examples

An excerpt shows what the code **is**. A worked example shows what it **does** — to something
specific, with the literal text at every step: what went into the request, what the function
returned, what the file on disk now holds.

A chapter can be entirely correct and still leave the reader unable to picture anything. That is
the gap this closes. It is also the part of a guide most likely to be quietly invented, so the
whole method here is about getting the bytes from the repository rather than from memory.

## The shape

```js
example({
  title: "One turn, as it lands on disk",
  scenario: `One sentence of situation, in the reader's terms.`,
  source: "core/tests/suite/compact.rs",      // optional; checked to exist
  steps: [
    {
      t: "A short claim, not a label",
      d: `One or two sentences of why this step matters.`,
      label: "what the bytes below are",
      verbatim: true,                          // checked to be in `source`
      code: `00:message/user:first manual turn
01:message/user:<COMPACTION_SUMMARY>`,
    },
  ],
  note: `What to take away, what is illustrative, where to look next.`,
})
```

`code` renders through `wire()`: no line-number gutter, no permalink, because these are bytes
rather than a place in a file. Set `lang` on a step to syntax-highlight it; the default `wire`
grammar handles tag-delimited markers, `key: value` lines and headings, which covers most
transcripts.

## Finding the bytes

Almost every maintained repository already keeps the answers on disk. Run this before writing
anything:

```bash
node <skill>/scripts/find-fixtures.mjs --clone <path>
node <skill>/scripts/find-fixtures.mjs --grep RETRY_AFTER      # for one subsystem
node <skill>/scripts/find-fixtures.mjs --dir src/core --kind snapshot --peek 6
```

It walks the clone, classifies what it finds, ranks it by how readable it is, and prints the
scenario line of each candidate. Ranked by how much they can be trusted:

| Rank | Source | Where it lives |
|---|---|---|
| 1 | **Snapshot tests** | `__snapshots__/` (Jest), `*.snap` (insta, Jest), `*.ambr` (syrupy), `*.approved.*` (ApprovalTests) |
| 2 | **Golden files** | `testdata/` (Go), `*.golden`, `expected/`, `*.expected` |
| 3 | **Fixtures and cassettes** | `fixtures/`, `spec/fixtures/`, `test/resources/`, `cassettes/` (VCR) |
| 4 | **Schemas** | `*.schema.json`, `openapi.yaml`, `*.proto` — the shape, not a payload |
| 5 | **Sample configs** | `*.example.toml`, `.env.example`, `examples/`, `samples/` |
| 6 | **Docs** | fenced blocks in `docs/*.md` — written by hand, so they drift |

The first three are the good ones, and for the same reason: **something fails when they go stale.**
A snapshot is regenerated when the format changes and the diff gets reviewed, which is exactly the
property an example needs and exactly what a hand-written doc block lacks.

A snapshot's header is usually the most useful line in it. insta records the test file and the
expression that produced the output; Jest names the test. That tells you which scenario you are
looking at without reading the test.

### When there is no ground truth

Some repositories keep none. In order of preference:

1. **Run it.** A command's real output, a request's real response, a file the code really wrote.
   Say in `note` that you produced it, and give the command — a reader who repeats it is checking
   your work, which is the point.
2. **Reconstruct from the code that formats it**, and leave `source` out. An example with no
   `source` is legitimate and normal. What is not legitimate is a reconstruction that looks like a
   recording.

Either way, say which numbers are illustrative. An unmarked invented constant is the single
failure mode this part of a guide has.

## Abridging honestly

A fixture is rarely the right length for a chapter. You may:

- **re-indent and re-wrap** — the check normalises whitespace, so a reflowed JSON blob still passes
- **cut from the middle**, with a marker that says so: `… 1261428 bytes omitted …`
- **drop fields that are noise**, provided nothing left implies they were absent
- **replace a machine-specific path or id with a stable one** — `<CWD>` → `/repo`, a UUID → `7c3b…`

You may not:

- change a value, a field name, a spelling or a case
- round a number, or tidy an awkward format
- merge two recordings into one that never happened
- keep `verbatim: true` on a block you did any of the above to

The last one is the rule that matters. Once a block is edited past re-indentation, drop the flag:
the block is still useful, it just stopped being a quotation.

## What the checker proves

`check-content.mjs` holds two claims to account:

- **`source` exists in the clone.** A renamed fixture fails the build instead of pointing nowhere.
- **Every `verbatim: true` block is in that file**, ignoring indentation and line wrapping.

It deliberately does not require a `source`. The summary line prints how many examples have one
(`28 examples · 77 literal blocks · 41 checked against a cited file`), so the ratio stays visible
without forcing anchored examples where the repository has nothing to anchor to.

Nothing checks the prose in `scenario`, `d` or `note`. That is ordinary writing, held to the same
standard as the rest of the chapter: nothing claimed that was not read.

## Choosing the cases

One happy path teaches less than two cases that differ:

- **Contrast.** The same call in two states — the turn where something changed and the turn where
  nothing did, so the reader sees the *rule* rather than one outcome.
- **The edge.** The case the code defends against: the empty input, the second server, the retry
  after the failure.
- **The failure.** What the reader gets when it goes wrong, in the same shape as when it goes right.

Three to six steps. Past that it is two examples. A step that has no literal text is fine — some
steps are the decision between two blocks — but an example with no `code` at all is a paragraph
wearing a costume.

## Placement and dosage

One to three per chapter, each immediately after the section it makes concrete — not collected at
the end. The rhythm is: excerpt, then the example that shows that excerpt doing its job.

A chapter with four examples is usually a chapter that is avoiding its pattern card. The example
shows one case; the pattern says what is true of all of them. The guide needs both, and they are
not substitutes.
