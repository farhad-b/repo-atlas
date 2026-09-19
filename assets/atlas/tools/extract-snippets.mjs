#!/usr/bin/env node
/**
 * extract-snippets.mjs — pin guide code excerpts to the real source.
 *
 * Every snippet in the guide is declared in guide/data/snippets.manifest.json by
 * *anchor text*, never by a bare line number. This script resolves each anchor
 * against the clone, and writes guide/data/snippets.json with the verbatim code
 * plus the true line numbers and a commit-pinned permalink.
 *
 * Anchors must be unique within their file. If an anchor stops resolving — the
 * code moved, changed, or became ambiguous — the build fails loudly rather than
 * silently showing the reader something that is no longer true.
 *
 *   node tools/extract-snippets.mjs           build guide/data/snippets.json
 *   node tools/extract-snippets.mjs --check   verify only, write nothing
 *   ... --guide guide-ste                     use another edition's data/ directory
 *
 * Zero dependencies. Node 18+.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CONFIG = JSON.parse(readFileSync(path.join(ROOT, "atlas.config.json"), "utf8"));
const CLONE = path.resolve(ROOT, CONFIG.clone);
// Each edition of the guide keeps its own manifest and output, so editions can
// be rebuilt and checked independently.
const guideArg = process.argv.indexOf("--guide");
const GUIDE = path.join(ROOT, guideArg !== -1 ? process.argv[guideArg + 1] : CONFIG.guide || "guide");
const GUIDE_NAME = path.basename(GUIDE);
const MANIFEST = path.join(GUIDE, "data", "snippets.manifest.json");
const OUT = path.join(GUIDE, "data", "snippets.json");
const PIN = path.join(GUIDE, "data", "pin.json");

const CHECK_ONLY = process.argv.includes("--check");

// Extensions the highlighter has rules for. Anything else renders as plain
// text, which is correct-looking; a wrong grammar is not.
const LANG_BY_EXT = {
  ".rs": "rust",
  ".go": "go",
  ".py": "python",
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".ts": "ts",
  ".tsx": "tsx",
  ".jsx": "jsx",
  ".c": "clike",
  ".h": "clike",
  ".cc": "clike",
  ".cpp": "clike",
  ".hpp": "clike",
  ".java": "clike",
  ".kt": "clike",
  ".cs": "clike",
  ".swift": "clike",
  ".toml": "toml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".json": "json",
  ".md": "markdown",
  ".sh": "bash",
  ".bash": "bash",
  ".lisp": "lisp",
  ".scm": "lisp",
  ".el": "lisp",
  ...(CONFIG.langByExt || {}),
};

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

/** Read the clone's HEAD so every permalink is pinned to the exact commit on disk. */
function readPin() {
  const sha = execFileSync("git", ["-C", CLONE, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const date = execFileSync(
    "git",
    ["-C", CLONE, "log", "-1", "--format=%cd", "--date=short"],
    { encoding: "utf8" },
  ).trim();
  return { sha, short: sha.slice(0, 8), date, repo: CONFIG.repo };
}

/**
 * The web URL for one excerpt. GitHub by default; `permalink` in the config
 * overrides it for GitLab, Sourcegraph, a corporate host, or "" for no links
 * at all (a private clone with no public home).
 */
function permalinkFor(pin, snip) {
  const template =
    CONFIG.permalink ?? "https://github.com/{repo}/blob/{sha}/{path}#L{start}-L{end}";
  if (!template) return "";
  return template
    .replace("{repo}", pin.repo)
    .replace("{sha}", pin.sha)
    .replace("{path}", snip.path)
    .replace("{start}", snip.startLine)
    .replace("{end}", snip.endLine);
}

const fileCache = new Map();
function readLines(relPath) {
  if (fileCache.has(relPath)) return fileCache.get(relPath);
  const abs = path.join(CLONE, relPath);
  if (!existsSync(abs)) throw new Error(`file not found in clone: ${relPath}`);
  // Normalise CRLF so anchors written with \n match on Windows checkouts.
  const lines = readFileSync(abs, "utf8").replace(/\r\n/g, "\n").split("\n");
  fileCache.set(relPath, lines);
  return lines;
}

/**
 * Find the single place `needle` occurs. Returns a 0-based line index — the
 * FIRST line of the match for a start anchor, the LAST line for an end anchor.
 *
 * A needle may span lines: `"foo\n    bar"` matches a two-line run. Multi-line
 * anchors are how a snippet pins to a closing brace, which is never unique on
 * its own. `from` restricts the search to lines at or after that index.
 */
function findUniqueLine(lines, needle, from = 0, label = "anchor", wantEnd = false) {
  const span = needle.split("\n");
  const hits = [];
  for (let i = from; i + span.length <= lines.length; i++) {
    let matched = true;
    for (let j = 0; j < span.length; j++) {
      // Interior lines of a multi-line anchor must match exactly (modulo trailing
      // whitespace); the first and last may be substrings, so an anchor can start
      // mid-line without repeating a whole line of code.
      const line = lines[i + j];
      const part = span[j];
      const exact = span.length > 1 && j > 0 && j < span.length - 1;
      if (exact ? line.trimEnd() !== part.trimEnd() : !line.includes(part)) {
        matched = false;
        break;
      }
    }
    if (matched) hits.push(i);
    if (hits.length > 8) break;
  }
  if (hits.length === 0) throw new Error(`${label} not found: ${JSON.stringify(needle)}`);
  if (hits.length > 1) {
    const at = hits.map((i) => i + 1).join(", ");
    throw new Error(
      `${label} is ambiguous (matches lines ${at}): ${JSON.stringify(needle)}`,
    );
  }
  return wantEnd ? hits[0] + span.length - 1 : hits[0];
}

/** Strip the common leading indentation shared by every non-blank line. */
function dedent(lines) {
  let min = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    if (indent < min) min = indent;
  }
  if (!isFinite(min) || min === 0) return lines;
  return lines.map((l) => (l.trim() ? l.slice(min) : l));
}

function resolve(entry) {
  const { id, path: relPath, start, end, lines: lineCount } = entry;
  if (!id) throw new Error("snippet entry is missing an id");
  if (!relPath) throw new Error(`[${id}] missing path`);
  if (!start) throw new Error(`[${id}] missing start anchor`);

  const source = readLines(relPath);
  let startIdx = findUniqueLine(source, start, 0, `[${id}] start anchor`);
  startIdx += entry.startOffset ?? 0;

  let endIdx;
  if (end) {
    endIdx = findUniqueLine(source, end, startIdx, `[${id}] end anchor`, true);
  } else if (lineCount) {
    endIdx = startIdx + lineCount - 1;
  } else {
    throw new Error(`[${id}] needs either an "end" anchor or a "lines" count`);
  }
  endIdx += entry.endOffset ?? 0;

  if (endIdx < startIdx) throw new Error(`[${id}] end resolves before start`);
  if (startIdx < 0 || endIdx >= source.length)
    throw new Error(`[${id}] resolved range falls outside the file`);

  let body = source.slice(startIdx, endIdx + 1);
  if (entry.dedent !== false) body = dedent(body);

  // Elided runs — usually a derive block or an import list that adds nothing to
  // the point being made. The lines stay in `code` so the tokeniser still sees
  // correct string/comment boundaries; the renderer hides them and shows a
  // marker, and the gutter keeps reporting true file line numbers either way.
  // Elide anchors are resolved against the snippet's own lines, not the whole
  // file, so they only have to be unique within the excerpt.
  const window = source.slice(startIdx, endIdx + 1);
  const elideLines = [];
  for (const [from, to] of entry.elide ?? []) {
    const a = findUniqueLine(window, from, 0, `[${id}] elide start`);
    const b = findUniqueLine(window, to, a, `[${id}] elide end`, true);
    for (let i = a; i <= b; i++) elideLines.push(startIdx + i + 1);
  }

  const ext = path.extname(relPath);
  return {
    id,
    path: relPath,
    startLine: startIdx + 1,
    endLine: endIdx + 1,
    lang: entry.lang ?? LANG_BY_EXT[ext] ?? "text",
    code: body.join("\n"),
    elideLines: elideLines.length ? elideLines : null,
  };
}

function main() {
  if (!existsSync(CLONE)) {
    console.error(red(`clone not found at ${CLONE} — check "clone" in atlas.config.json`));
    process.exit(2);
  }
  if (!existsSync(MANIFEST)) {
    console.error(red(`manifest not found at ${MANIFEST}`));
    process.exit(2);
  }

  const pin = readPin();
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const entries = Array.isArray(manifest) ? manifest : manifest.snippets;

  const seen = new Set();
  const resolved = {};
  const failures = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      failures.push(`duplicate snippet id: ${entry.id}`);
      continue;
    }
    seen.add(entry.id);
    try {
      const snip = resolve(entry);
      snip.permalink = permalinkFor(pin, snip);
      resolved[snip.id] = snip;
    } catch (err) {
      failures.push(err.message);
    }
  }

  const total = entries.length;
  const ok = Object.keys(resolved).length;

  if (failures.length) {
    console.error(bold(red(`\n  ${failures.length} snippet(s) failed to resolve\n`)));
    for (const f of failures) console.error(red(`  ✗ ${f}`));
    console.error(
      dim(`\n  ${ok}/${total} resolved. Fix the anchors above and re-run.\n`),
    );
    process.exit(1);
  }

  console.log(
    green(`  ✓ ${ok}/${total} snippets resolved`) +
      dim(` against ${pin.short} (${pin.date})`),
  );

  if (CHECK_ONLY) {
    console.log(dim("  --check: nothing written"));
    return;
  }

  const totalLines = Object.values(resolved).reduce(
    (n, s) => n + (s.endLine - s.startLine + 1),
    0,
  );
  writeFileSync(
    OUT,
    JSON.stringify({ pin, snippets: resolved }, null, 1) + "\n",
    "utf8",
  );
  writeFileSync(PIN, JSON.stringify(pin, null, 2) + "\n", "utf8");
  console.log(
    dim(
      `  → ${GUIDE_NAME}/data/snippets.json  (${totalLines} lines of real source across ${ok} excerpts)`,
    ),
  );
}

main();
