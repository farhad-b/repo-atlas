#!/usr/bin/env node
/**
 * find-fixtures.mjs — find the text a worked example can be built from.
 *
 *   node <skill>/scripts/find-fixtures.mjs --clone ../codex
 *   node <skill>/scripts/find-fixtures.mjs --grep COMPACTION_SUMMARY
 *   node <skill>/scripts/find-fixtures.mjs --kind snapshot --peek 6
 *   node <skill>/scripts/find-fixtures.mjs --json | jq '.[0]'
 *
 * An excerpt shows what code *is*; an example shows what it *does*, with the
 * literal bytes at each step. Those bytes have to come from somewhere, and the
 * worst source is memory. Almost every maintained repository already keeps the
 * answers on disk: snapshot tests, golden files, fixtures, recorded HTTP
 * cassettes, sample configs, JSON Schemas. They are reviewed when the format
 * changes, which is exactly the property an example needs.
 *
 * This walks a clone and ranks those files, so the reading phase ends with a
 * list of real payloads instead of a plan to invent some. It reads; it never
 * writes. Zero dependencies. Node 18+.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

/* -- arguments ----------------------------------------------------------- */

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const JSON_OUT = argv.includes("--json");
const GREP = arg("grep");
const KIND = arg("kind");
const LIMIT = Number(arg("limit", JSON_OUT ? "200" : "12"));
const PEEK = Number(arg("peek", "1"));

/** Run from inside an atlas and the clone is already configured. */
function inferClone() {
  const cfg = path.resolve("atlas.config.json");
  if (existsSync(cfg)) {
    try {
      const { clone } = JSON.parse(readFileSync(cfg, "utf8"));
      if (clone) return path.resolve(path.dirname(cfg), clone);
    } catch {
      /* fall through to the error below */
    }
  }
  return null;
}

const CLONE = path.resolve(arg("clone") || inferClone() || "");
if (!arg("clone") && !inferClone()) {
  console.error(red("  --clone is required (or run this inside an atlas, next to atlas.config.json)."));
  process.exit(2);
}
if (!existsSync(CLONE)) {
  console.error(red(`  no such directory: ${CLONE}`));
  process.exit(2);
}

/* -- what counts as ground truth -----------------------------------------
   Ordered: the first pattern that matches decides the kind, so the specific
   conventions come before the generic directory names. Each entry is here
   because some ecosystem writes its recorded output that way — insta and Jest
   (.snap), syrupy (.ambr), Go (testdata/ and .golden), ApprovalTests
   (.approved.*), VCR and Betamax (cassettes/), and the rest by convention. */
const KINDS = [
  { kind: "snapshot", re: /(^|\/)__snapshots__\//i },
  { kind: "snapshot", re: /(^|\/)snapshots?\//i },
  { kind: "snapshot", re: /\.(snap|ambr|snapshot)$/i },
  { kind: "snapshot", re: /\.approved\.[^/]+$/i },
  { kind: "golden", re: /(^|\/)testdata\//i },
  { kind: "golden", re: /\.golden$/i },
  { kind: "golden", re: /(^|\/)(golden|expected)\//i },
  { kind: "golden", re: /\.expected(\.[^/]+)?$/i },
  { kind: "fixture", re: /(^|\/)(cassettes|vcr)\//i },
  { kind: "fixture", re: /(^|\/)fixtures?\//i },
  { kind: "fixture", re: /(^|\/)(test|tests|spec)\/resources\//i },
  { kind: "schema", re: /\.(schema\.json|avsc|proto)$/i },
  { kind: "schema", re: /(^|\/)(openapi|swagger)[^/]*\.(json|ya?ml)$/i },
  { kind: "sample", re: /\.(example|sample|template)\.[^/]+$/i },
  { kind: "sample", re: /(^|\/)\.env\.(example|sample|template)$/i },
  { kind: "sample", re: /(^|\/)(examples?|samples?)\//i },
];

/** Directories that are never the repository's own recorded output. */
const SKIP_DIR = new Set([
  ".git", ".hg", ".svn", "node_modules", "target", "dist", "build", "out",
  "vendor", ".venv", "venv", "__pycache__", ".next", ".nuxt", ".cache",
  ".gradle", ".idea", ".vscode", "coverage", "site-packages", "Pods",
]);

/* Text formats a reader can be shown. A fixture that is a PNG teaches nothing
   in a guide, however real it is. */
const TEXT_EXT = new Set([
  ".snap", ".ambr", ".snapshot", ".golden", ".expected", ".txt", ".json", ".jsonl",
  ".ndjson", ".yaml", ".yml", ".toml", ".ini", ".xml", ".csv", ".tsv", ".md", ".sql",
  ".http", ".har", ".env", ".conf", ".cfg", ".properties", ".sbpl", ".proto", ".avsc",
  ".approved", "",
]);

const MAX_READ = 512 * 1024; // never read a fixture bigger than this

function classify(rel) {
  for (const { kind, re } of KINDS) if (re.test(rel)) return kind;
  return null;
}

/** Readable by a person, and big enough to be worth reading. */
function scoreOf(kind, size, lines, ext) {
  let s = { snapshot: 100, golden: 90, fixture: 80, schema: 55, sample: 50 }[kind] ?? 40;
  // A curve, not a cut-off. A 90-byte snapshot is one asserted string and
  // teaches nothing; a 400 KB dump will not be read. The middle is a whole
  // scenario, recorded, which is exactly what an example needs.
  if (size < 200) s -= 30;
  else if (size <= 2 * 1024) s += 15;
  else if (size <= 16 * 1024) s += 25;
  else if (size <= 64 * 1024) s += 5;
  else s -= 25;
  if (lines > 400) s -= 15;
  if ([".json", ".jsonl", ".yaml", ".yml", ".snap", ".ambr", ".toml"].includes(ext)) s += 10;
  if (ext === ".md") s -= 20; // prose about output, rather than output
  return s;
}

/**
 * The first lines worth showing. An insta or syrupy snapshot opens with a
 * `---` metadata block naming the test that produced it; that header is the
 * most useful line in the file for choosing between candidates, and the
 * recorded output starts after it. Skip separators, show both.
 */
function peekOf(all, n) {
  const out = [];
  let i = 0;
  if (all[0]?.trim() === "---") {
    const end = all.indexOf("---", 1);
    for (let j = 1; j < (end === -1 ? Math.min(all.length, 6) : end); j++) {
      const l = all[j].trim();
      if (/^(expression|source):/.test(l)) out.push(l.slice(0, 96));
    }
    i = end === -1 ? 1 : end + 1;
  }
  for (; i < all.length && out.length < n + (out.length ? 1 : 0); i++) {
    const l = all[i].trim();
    if (l && l !== "---") out.push(l);
  }
  return out;
}

/* -- walk ---------------------------------------------------------------- */

const hits = [];
let scanned = 0;

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory: not this tool's problem
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walk(abs);
      continue;
    }
    if (!e.isFile()) continue;
    scanned++;

    const rel = path.relative(CLONE, abs).split(path.sep).join("/");
    const kind = classify(rel);
    if (!kind || (KIND && kind !== KIND)) continue;

    const ext = path.extname(e.name).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    // `*.received.*` is the failure output of an approval test, not the
    // approved answer. Showing it would teach the wrong bytes.
    if (/\.received\.[^/]+$/i.test(rel)) continue;
    // Boilerplate that lands in sample and fixture directories and is never
    // the thing being recorded.
    if (/(^|\/)(license|licence|copying|notice|changelog|authors|\.gitignore|\.gitkeep)/i.test(rel))
      continue;

    let size;
    try {
      size = statSync(abs).size;
    } catch {
      continue;
    }
    if (size === 0 || size > MAX_READ) continue;

    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue; // binary despite the extension

    if (GREP && !text.toLowerCase().includes(GREP.toLowerCase())) continue;

    const all = text.split(/\r?\n/);
    const lines = all.length;
    hits.push({
      path: rel,
      kind,
      bytes: size,
      lines,
      score: scoreOf(kind, size, lines, ext),
      peek: peekOf(all, Math.max(PEEK, 1)),
    });
  }
}

const DIR = path.join(CLONE, arg("dir", ""));
if (!existsSync(DIR)) {
  console.error(red(`  --dir is not in the clone: ${arg("dir")}`));
  process.exit(2);
}
walk(DIR);
hits.sort((a, b) => b.score - a.score || b.lines - a.lines || a.path.localeCompare(b.path));

/**
 * Round-robin across kinds, so the first screen is not twelve variations of
 * whichever kind this repository happens to have most of.
 */
function interleave(list, limit) {
  const queues = new Map();
  for (const h of list) (queues.get(h.kind) ?? queues.set(h.kind, []).get(h.kind)).push(h);
  const out = [];
  while (out.length < limit && [...queues.values()].some((q) => q.length)) {
    for (const q of queues.values()) {
      if (!q.length || out.length >= limit) continue;
      out.push(q.shift());
    }
  }
  return out;
}

/* -- report -------------------------------------------------------------- */

if (JSON_OUT) {
  console.log(JSON.stringify(hits.slice(0, LIMIT), null, 2));
  process.exit(0);
}

const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const byKind = new Map();
for (const h of hits) byKind.set(h.kind, (byKind.get(h.kind) || 0) + 1);

console.log(bold(`\n  Ground truth in ${path.basename(CLONE)}`));
console.log(
  dim(
    `  ${scanned} files scanned · ${hits.length} candidate${hits.length === 1 ? "" : "s"}` +
      (GREP ? ` containing “${GREP}”` : "") +
      (KIND ? ` of kind ${KIND}` : ""),
  ),
);

if (!hits.length) {
  console.log(`
  ${red("Nothing matched.")} That is a real answer, not a failure: plenty of repositories
  keep no recorded output. Two fallbacks, in order of how much they can be trusted:

    1  Run the thing. A command's real output, a request's real response, a file
       the code really wrote — capture it yourself and say in the example's note
       that you produced it, with the command you ran.
    2  Reconstruct from the code that formats it, and mark the example as
       illustration by leaving out ${cyan("source")}. Never present a reconstruction
       as a recording.
`);
  process.exit(0);
}

console.log(
  dim(`  ${[...byKind].map(([k, n]) => `${k} ${n}`).join(" · ")}\n`),
);

for (const h of KIND ? hits.slice(0, LIMIT) : interleave(hits, LIMIT)) {
  console.log(`  ${cyan(h.kind.padEnd(8))} ${green(h.path)}`);
  console.log(dim(`  ${" ".repeat(8)} ${kb(h.bytes)} · ${h.lines} lines`));
  if (PEEK > 0) for (const l of h.peek) console.log(dim(`  ${" ".repeat(10)}${l.slice(0, 96)}`));
}
if (hits.length > LIMIT) console.log(dim(`\n  …and ${hits.length - LIMIT} more (--limit)`));

console.log(`
  ${bold("Next")}
    · open one and read it whole — a snapshot names the scenario it recorded
    · ${cyan("--grep <text>")} to find the fixture for a subsystem you are writing about
    · quote it in an ${cyan("example()")} with ${cyan("source")} set to its path, and mark the
      steps you copied with ${cyan("verbatim: true")} — check-content.mjs proves both
`);
