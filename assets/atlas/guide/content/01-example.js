/* ============================================================================
   01-example.js — the chapter template, and a demo of every DSL helper.

   A chapter is an ES module exporting render(): a string of HTML, built from
   the helpers in assets/js/dsl.js. app.js wraps it in the chapter header and
   a .prose container, gives every h2/h3 an id, and mounts any widgets.

   THE RHYTHM. Every chapter follows it, so the guide stays readable at length:

     1  problem()   the question, in two sentences, with no jargon
     2  snip()      how the code answers it — verbatim, annotated
     3  example()   one concrete case, traced end to end
     4  pattern()   the transferable shape: invariants + pseudocode
     5  traps()     what breaks if you get it wrong
     6  readNext()  where to go in the clone

   Delete this file once your first real chapter exists.
   ========================================================================= */

import {
  snip, code, example, pattern, traps, key, table, cards, stats, readNext, widget, problem, c,
} from "../assets/js/dsl.js";

export function render() {
  return `

${problem(`<p>
  State the problem this chapter's subsystem exists to solve, before naming any of its machinery.
  Two sentences. If a reader who has never seen this codebase cannot follow it, rewrite it.
</p>
<p>
  The second paragraph is the twist: why the obvious solution stops working. That is what the rest
  of the chapter is for.
</p>`)}

<p>
  Ordinary prose is plain HTML. Keep paragraphs short, and put the load-bearing idea in the first
  sentence — readers skim until something catches, then read backwards. Inline code is
  ${c("run_turn()")}. Words taken from the source go inside a ${c("<q>")} element, and
  ${c("check-content.mjs")} then requires them to appear in the clone word for word — which is why
  this sentence does not use one.
</p>

<h2 id="showing-code">Showing code</h2>

<p>
  ${c("snip(\"id\")")} renders an excerpt declared in
  ${c("guide/data/snippets.manifest.json")} and extracted from the clone. Notes are keyed by
  <em>real file line number</em>, so a callout stays attached to its line even when the file
  above it changes:
</p>

${code(`\${snip("fragment-trait", {
  notes: {
    58: \`The load-bearing sentence. Say what the code means, not what it does —
      the reader can see what it does.\`,
    71: \`One note per idea. Four notes on one excerpt is a lot; eight means the
      excerpt is doing too much and should be two.\`,
  },
  hl: [60, 61],                       // highlight without numbering
  caption: \`One sentence under the block, for the thing that did not fit in a note.\`,
})}`, "js", "how a real excerpt is cited")}

<p>
  For code that is <em>not</em> from the repo — pseudocode, a config sample, a shell line —
  use ${c("code(text, lang, label)")}, exactly as this page does. It never claims a source, so it
  can never misquote one.
</p>

${key(`A key fact gets its own line and its own colour. Use it about once per chapter: the
  sentence you would keep if the reader kept only one.`)}

<h2 id="a-worked-example">A worked example</h2>

<p>
  An excerpt shows what the code <em>is</em>. An example shows what it <em>does</em>, to something
  specific, with the literal text at each step. Find that text in the repository rather than
  inventing it — ${c("node <skill>/scripts/find-fixtures.mjs")} lists the snapshots, golden files
  and fixtures this clone already keeps under test.
</p>

${example({
  title: "One request, three turns",
  scenario: `Open with a concrete situation in the reader's own terms — <code>a session starts in
    /repo</code>, <code>you press Ctrl-C</code>, <code>the window fills during a tool call</code>.
    Never a category of situation.`,
  steps: [
    {
      t: "A step is a short claim, not a label",
      d: `Then one or two sentences of why. The <code>code</code> field is the literal text: what
        went into the request, what the tool returned, what a file now holds.`,
      label: "what the label says the bytes are",
      code: `<environment_context>
  <cwd>/repo</cwd>
</environment_context>`,
    },
    {
      t: "Contrast beats completeness",
      d: `A second case that behaves differently teaches the rule and its edge at once. Three to
        six steps; past that it is two examples.`,
      label: "the same call, nothing changed",
      code: `None`,
    },
  ],
  note: `This example invents its blocks to demonstrate the helper, so it cites no source and
    nothing checks it. Say so when that is true of yours, and keep it rare.`,
})}

<p>
  An example built from something real says where it came from, and the parts that are genuinely
  copied say so too:
</p>

${code(`\${example({
  title: "One turn, as it lands on disk",
  source: "core/tests/suite/compact.rs",   // must exist in the clone
  steps: [{
    t: "The history after a compaction",
    d: \`Two items survive: the user's own message and the summary.\`,
    label: "replacement history",
    verbatim: true,                        // checked to be in that file
    code: \`00:message/user:first manual turn
01:message/user:<COMPACTION_SUMMARY>\`,
  }],
})}`, "js", "an anchored example — check-content.mjs proves both claims")}

<p>
  The check ignores indentation and line wrapping, so an abridged block still passes if every word
  is the source's. It fails if a value was tidied, a field renamed, or a number rounded — which is
  the whole point: the reader is told a block is copied, so it has to be.
</p>

<h2 id="the-pattern">The pattern</h2>

<p>
  The pattern card is what makes a guide about one codebase useful to someone working in another
  language. Invariants are imperative and testable. Pseudocode is short enough to hold in the head.
</p>

${pattern({
  title: "Name the shape, not the function",
  invariants: [
    `<strong>Each invariant starts with a bolded imperative.</strong> Then one or two sentences of
      why. If you cannot state the why, it is a style preference, not an invariant.`,
    `<strong>Keep them language-agnostic.</strong> Nothing here should mention Rust, or this
      repository, or a type name a reader cannot look up.`,
    `<strong>Four to six is the range.</strong> Fewer and the chapter had no thesis; more and none
      of them will be remembered.`,
  ],
  pseudo: `handle(request):
  ctx = snapshot()          # capture once; everything downstream reads this
  while true:
    result = step(ctx)
    if result.done: break   # the exit condition is the interesting part
  return result`,
})}

${traps([
  {
    t: "A trap is a failure mode, not a warning",
    b: `Name what actually breaks, and what the symptom looks like from outside. “You will get an
      unknown-tool error you cannot reproduce” teaches; “be careful here” does not.`,
  },
  {
    t: "Traps come from the code, not from imagination",
    b: `Every trap should be something the source visibly defends against — a comment explaining a
      delay, a test named after the bug, a special case with a date in it.`,
  },
])}

<h2 id="other-blocks">The other blocks</h2>

${table(
  ["Helper", "Use it for", "Keep in mind"],
  [
    [c("cards([…])"), "Two to four parallel things", "Equal weight; if one is bigger, use prose"],
    [c("stats([…])"), "Numbers that make a point", "Three or four, each with a unit"],
    [c("table(h, rows)"), "Comparison across a fixed axis", "Wide tables scroll rather than crush"],
    [c("widget(\"name\")"), "Something static cannot show", "One per chapter at most"],
  ],
)}

${cards([
  { t: "A card", b: `<p>One idea, a few lines. Cards sit side by side and wrap on a narrow screen.</p>` },
  { t: "Another card", b: `<p>Use the same grammatical shape in each card — it is how the reader knows they are parallel.</p>` },
])}

${stats([
  { v: "5", l: "blocks per chapter, in order" },
  { v: "1", l: "widget, at most" },
  { v: "0", l: "claims that are not in the source" },
])}

<h2 id="widgets">Widgets</h2>

<p>
  A widget earns its place when the thing being taught is a <em>process</em>, a
  <em>comparison</em>, or a <em>decision</em> — something a static figure would flatten. Four
  archetypes ship: ${c("stepper")}, ${c("matrix")}, ${c("timeline")} and ${c("module-map")}.
</p>

${widget("stepper")}

${readNext([
  {
    path: "README.md",
    note: "Every path here is checked against the clone. A renamed file fails the check rather than sending the reader nowhere.",
  },
])}
`;
}
