# Reviewing the repository

The guide is only as good as the read. This is the part with no shortcut, and the part where a
model most easily produces confident nonsense. The defence is an evidence standard: **a claim gets
into the guide only if it is attached to a path, an anchor, and a line you have seen.**

## Orient before you read

Spend the first pass building a map, not understanding anything:

```bash
git -C <clone> log -1 --format='%H %cd %s' --date=short   # pin: what am I actually reading
tokei <clone> 2>/dev/null || cloc <clone> 2>/dev/null      # where is the mass
ls <clone>                                                 # top-level seams
cat <clone>/README.md <clone>/ARCHITECTURE.md 2>/dev/null
ls <clone>/docs 2>/dev/null
```

Then find the repository's own seams. A well-factored repo tells you its subsystems in its
directory names: a Cargo workspace's members, a monorepo's packages, a Go module's internal
packages, a Python project's top-level modules. **Take the syllabus from those seams**, not from a
generic list of topics you brought with you. A chapter with no clear home in the source is usually
a chapter about something the project does not actually have.

Two good sanity checks on a candidate syllabus:

- Every chapter names at least one directory or file you can point at.
- Every top-level directory of consequence appears in at least one chapter, or is deliberately
  excluded (say so in the orientation chapter — "these eleven are surfaces and telemetry, and this
  guide does not cover them").

## Fan out, then verify

One subagent per subsystem, in parallel. Give each the same brief:

> Read `<paths>` in the clone at `<abs path>`. Do not modify anything. Report:
>
> 1. **Entry point** — the function or type a reader should start at, as `path:symbol`.
> 2. **Call path** — what calls it, what it calls, three to six hops, with paths.
> 3. **Excerpt candidates** — two to four ranges worth showing. For each: the path, the **exact
>    text of the first line** (quoted verbatim, enough to be unique in that file), the exact text
>    of the last line, roughly how many lines, and one sentence on why this range and not a
>    neighbouring one.
> 4. **The invariant** — what this code guarantees that callers rely on. One sentence.
> 5. **Traps** — what the code visibly defends against: comments explaining a delay or an
>    ordering, special cases, tests named after a bug. Quote the comment or the test name.
> 6. **What surprised you** — the thing that was not what you expected before reading.
>
> Quote anchors exactly, including comment markers and indentation. Do not paraphrase code.

Then **verify the returned anchors yourself** before they enter the manifest — the extractor does
this for you the moment you run it, which is why the manifest comes before the prose. An anchor
that does not resolve uniquely is a report you should not trust the rest of.

Item 6 is not filler. The thing that surprised a careful reader is usually the thing worth
teaching, and it is where chapter theses come from.

## What to look for, ranked

1. **Comments that explain a decision.** Not what the code does — why it happens here, in this
   order, twice, or later than you would expect. These are the guide's best material, because the
   people who wrote them were teaching too.
2. **Contracts.** A trait, an interface, a schema, a registry. A small interface with a surprising
   method on it (a renderer that can also *recognise* its own output, say) is a whole chapter.
3. **Special cases with a date, a version or a bug number.** Each one is a trap, already priced.
4. **The same job done more than once.** Four sandbox backends, three transports, two compaction
   strategies: a comparison the reader cannot get from any single file. This is what the matrix
   widget is for.
5. **Tests.** Frequently the clearest specification in the repository, and the only place where the
   intended behaviour is stated rather than implemented.
6. **The defaults.** What happens when nothing is configured is what happens to almost everyone.

## What to leave out

- Generated code, vendored dependencies, protocol stubs.
- Surface layers (CLI flags, UI chrome) unless the guide is about them.
- Anything you could not explain to someone without the code in front of them.
- Anything you have only a subagent's word for.

## Sizing

Roughly one chapter per subsystem, 15–22 chapters, 2–4 excerpts each, 15–60 lines per excerpt.
That lands around 60 excerpts and 1,000 lines of real source — enough that the reader is reading
the codebase rather than reading about it, and little enough that it can be checked.

If a subsystem cannot fill a chapter, it is a section of a neighbouring one. If it needs three,
split it along the seam the *code* uses, not the one your outline wants.
