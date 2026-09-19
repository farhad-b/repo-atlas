#!/usr/bin/env node
/**
 * check-content.mjs — verify the guide's claims against the clone.
 *
 * Catches the four ways prose and source drift apart:
 *   1. a chapter cites a snippet id that does not exist
 *   2. a callout is anchored to a line outside (or hidden inside) its snippet
 *   3. a "read next" pointer names a file that is not in the clone
 *   4. a <q> quotation is not word for word in the clone
 *
 * Also reports snippets declared in the manifest but never used, so the
 * manifest does not accumulate dead weight.
 *
 * Add a check here the first time a class of mistake gets past you. Each one
 * below exists because a real error shipped: a citation that pointed at the
 * wrong lines, a "read next" path that had been renamed, a quotation with a
 * hedge quietly dropped out of it.
 *
 *   node tools/check-content.mjs
 *   node tools/check-content.mjs --guide guide-alt   check another edition
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CONFIG = JSON.parse(readFileSync(path.join(ROOT, "atlas.config.json"), "utf8"));
const CLONE = path.resolve(ROOT, CONFIG.clone);
const guideArg = process.argv.indexOf("--guide");
const GUIDE = path.join(ROOT, guideArg !== -1 ? process.argv[guideArg + 1] : CONFIG.guide || "guide");
const CONTENT = path.join(GUIDE, "content");
const WIDGETS = path.join(GUIDE, "widgets");

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const { snippets } = JSON.parse(
  readFileSync(path.join(GUIDE, "data", "snippets.json"), "utf8"),
);

const problems = [];
const warnings = [];
const usedSnippets = new Set();
let checkedQuotes = 0;
const knownWidgets = new Set(
  readdirSync(WIDGETS)
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .map((f) => f.replace(/\.js$/, "")),
);

/**
 * Return the `{...}` block starting at or after `from`, brace-balanced and
 * ignoring braces that live inside string or template literals. Returns null
 * when there is no block (a snip call with no options, say).
 */
function balanced(text, from) {
  if (from < 0) return null;
  const open = text.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(open, i + 1);
  }
  return null;
}

const files = readdirSync(CONTENT).filter((f) => f.endsWith(".js")).sort();

for (const file of files) {
  const src = readFileSync(path.join(CONTENT, file), "utf8");
  const where = `content/${file}`;

  /* --- snippet references + their callouts -----------------------------
     Regexes cannot find the end of a nested options object reliably — the
     notes contain braces of their own — so scan for balanced braces instead. */
  for (const m of src.matchAll(/\bsnip\(\s*"([^"]+)"/g)) {
    // A backslash-escaped interpolation is sample text being shown to the
    // reader, not a citation. A chapter that documents the DSL contains both.
    if (src.slice(Math.max(0, m.index - 3), m.index) === "\\${") continue;
    const id = m[1];
    usedSnippets.add(id);
    const s = snippets[id];
    if (!s) {
      problems.push(`${where}: snip("${id}") — no such snippet in the manifest`);
      continue;
    }
    // Only look for an options object if this call actually has one — a bare
    // snip("id") must not adopt the next call's block.
    const after = src.slice(m.index + m[0].length);
    const next = after.match(/^\s*(.)/);
    if (!next || next[1] !== ",") continue;
    const opts = balanced(after, 0);
    if (!opts) continue;

    const elided = new Set(s.elideLines || []);
    const notes = balanced(opts, opts.indexOf("notes"));
    const inRange = (ln, what) => {
      if (ln < s.startLine || ln > s.endLine) {
        problems.push(
          `${where}: snip("${id}") ${what} line ${ln}, but the excerpt covers ${s.startLine}–${s.endLine}`,
        );
      } else if (elided.has(ln)) {
        problems.push(
          `${where}: snip("${id}") ${what} line ${ln}, which is inside an elided run and will never be shown`,
        );
      }
    };

    if (notes) {
      // Keys are bare integers at the start of a line. Anything else in the
      // block is note prose and must not be scanned for numbers.
      for (const km of notes.matchAll(/(?:^|\n)\s*(\d+)\s*:/g)) inRange(Number(km[1]), "notes");
    }
    const hl = opts.match(/\bhl\s*:\s*\[([^\]]*)\]/);
    if (hl) for (const nm of hl[1].matchAll(/\d+/g)) inRange(Number(nm[0]), "highlights");
  }

  /* --- read-next paths ------------------------------------------------- */
  for (const pm of src.matchAll(/path:\s*"([^"]+)"/g)) {
    const rel = pm[1];
    if (!existsSync(path.join(CLONE, rel))) {
      problems.push(`${where}: read-next path does not exist in the clone — ${rel}`);
    }
  }

  /* --- widget names ---------------------------------------------------- */
  for (const wm of src.matchAll(/widget\(\s*"([^"]+)"\s*\)/g)) {
    if (!knownWidgets.has(wm[1])) {
      problems.push(`${where}: widget("${wm[1]}") — no widgets/${wm[1]}.js`);
    }
  }

  /* --- internal chapter links ------------------------------------------ */
  for (const lm of src.matchAll(/href="#\/([a-z0-9-]+)"/g)) {
    const chapters = readdirSync(CONTENT).map((f) =>
      f.replace(/^\d+-/, "").replace(/\.js$/, ""),
    );
    if (!chapters.includes(lm[1])) {
      warnings.push(`${where}: link to #/${lm[1]} — no matching chapter file yet`);
    }
  }
}

/* --- unused snippets --------------------------------------------------- */
for (const id of Object.keys(snippets)) {
  if (!usedSnippets.has(id)) warnings.push(`snippet "${id}" is declared but never used`);
}

/* --- quotations ----------------------------------------------------------
   A <q> is a promise that the words are the source's own, so each one must be
   in the clone verbatim. A quotation may span several lines of a doc comment,
   so comment markers and line breaks are ignored; Markdown emphasis and
   backticks are ignored too, because the page renders them as HTML. Case,
   punctuation and characters such as a non-breaking hyphen must match.

   An ellipsis inside a <q> is refused: it hides what was left out, and that is
   how a hedge ("Typically, you should…") once disappeared from a quotation.
   Quote each fragment in its own <q> instead. */
{
  const sources = [
    ...files.map((f) => [`content/${f}`, path.join(CONTENT, f)]),
    ["assets/js/home.js", path.join(GUIDE, "assets", "js", "home.js")],
    ...readdirSync(WIDGETS).filter((f) => f.endsWith(".js")).map((f) => [`widgets/${f}`, path.join(WIDGETS, f)]),
  ];
  const decode = (s) =>
    s.replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const flat = (s) => s.replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim();

  const quotes = [];
  for (const [where, file] of sources)
    for (const m of readFileSync(file, "utf8").matchAll(/<q>([\s\S]*?)<\/q>/g))
      quotes.push({ where, text: flat(decode(m[1])) });

  if (quotes.length) {
    // The corpus is read only when there is something to look for.
    const corpus = [];
    // Which files a quotation may come from. Narrow it if the clone is huge:
    // the walk is the slowest thing this script does.
    const q = CONFIG.quotes || {};
    const exts = new Set(q.exts || [".rs", ".go", ".py", ".ts", ".js", ".md", ".toml"]);
    const maxBytes = (q.maxKB || 512) * 1024;
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".") || e.name === "target" || e.name === "node_modules") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (exts.has(path.extname(e.name)) && statSync(p).size < maxBytes)
          corpus.push(
            flat(
              readFileSync(p, "utf8")
                .split(/\r?\n/)
                .map((l) => l.replace(/^\s*(?:\/\/[\/!]?|#+|;+|[-*](?=\s))\s?/, ""))
                .join(" "),
            ),
          );
      }
    };
    for (const dir of q.dirs || ["."]) {
      const abs = path.join(CLONE, dir);
      if (existsSync(abs)) walk(abs);
      else problems.push(`atlas.config.json: quotes.dirs names "${dir}", which is not in the clone`);
    }

    for (const q of quotes) {
      if (q.text.includes("…")) {
        problems.push(`${q.where}: <q> contains an ellipsis — quote each fragment separately: “${q.text.slice(0, 70)}”`);
      } else if (!corpus.some((t) => t.includes(q.text))) {
        const loose = corpus.some((t) => t.toLowerCase().includes(q.text.toLowerCase()));
        problems.push(
          `${q.where}: <q> is not verbatim in the clone${loose ? " (it matches only if case is ignored)" : ""}: “${q.text.slice(0, 80)}”`,
        );
      }
    }
  }
  checkedQuotes = quotes.length;
}

/* --- project-specific checks -------------------------------------------
   Add yours here. The rule: if a claim in the prose can be checked against
   the clone mechanically, check it mechanically. Examples that earned their
   place in other atlases:

     - every module named in the module-map widget is a real directory
     - every heading that counts something ("The three back edges") matches
       the number of things the excerpt actually contains
     - every config key named in prose exists in the schema

   Each one is a dozen lines and catches a class of error forever. */

/* --- report ------------------------------------------------------------ */
const chapters = files.length;
if (problems.length) {
  console.error(red(`\n  ${problems.length} problem(s) across ${chapters} chapters\n`));
  for (const p of problems) console.error(red(`  ✗ ${p}`));
}
if (warnings.length) {
  console.error(yellow(`\n  ${warnings.length} warning(s)`));
  for (const w of [...new Set(warnings)]) console.error(yellow(`  ! ${w}`));
}
if (!problems.length) {
  console.log(
    green(`\n  ✓ ${chapters} chapters check out`) +
      dim(
        ` — ${usedSnippets.size} snippets used, all callouts in range, all paths exist,` +
          ` ${checkedQuotes} quotations verbatim\n`,
      ),
  );
}
process.exit(problems.length ? 1 : 0);
