/* ============================================================================
   chapters.js — the table of contents.

   Each chapter is a lazily-imported ES module in ../../content/. Adding a
   chapter means adding one entry here and one file there; nothing else in the
   app needs to know about it.

   Parts carry colour: `id` must be one of p1…p7, which are defined in
   tokens.css. Seven is also about the limit of what a reader can hold, so if
   you need an eighth part, the syllabus probably wants regrouping rather than
   a new colour.
   ========================================================================= */

export const PARTS = [
  {
    id: "p1",
    num: "I",
    title: "Foundations",
    desc: "One line on why these chapters belong together — a promise, not a summary.",
    chapters: ["example"],
  },
  /* Add the rest. A real syllabus looks like this:

  { id: "p2", num: "II", title: "Context",
    desc: "Assembling what the model sees, and surviving the moment it stops fitting.",
    chapters: ["context-assembly", "token-budget", "compaction"] },
  */
];

export const CHAPTERS = {
  example: {
    n: "01",
    title: "Example chapter",
    lead: "The lead is one or two sentences, shown under the title and in the sidebar. Say what the reader will be able to do afterwards, not what the chapter contains.",
    load: () => import("../../content/01-example.js"),
  },
};

/* Derived lookups ------------------------------------------------------- */

export const ORDER = PARTS.flatMap((p) => p.chapters);

export const PART_OF = Object.fromEntries(
  PARTS.flatMap((p) => p.chapters.map((ch) => [ch, p])),
);

for (const [id, ch] of Object.entries(CHAPTERS)) {
  ch.id = id;
  ch.part = PART_OF[id];
  ch.partTitle = PART_OF[id] ? `Part ${PART_OF[id].num} · ${PART_OF[id].title}` : "";
}
