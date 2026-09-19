#!/usr/bin/env node
/**
 * init-atlas.mjs — scaffold an atlas next to a clone.
 *
 *   node <skill>/scripts/init-atlas.mjs --clone codex
 *   node <skill>/scripts/init-atlas.mjs --root . --clone ../linux --repo torvalds/linux \
 *        --title "The Linux Scheduler Atlas" --port 8140
 *
 * Copies the scaffold into --root, substituting the placeholders, and refuses
 * to overwrite anything that already exists unless --force. Everything it
 * writes is yours afterwards: edit the files, do not re-run this.
 *
 * Zero dependencies. Node 18+.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCAFFOLD = path.resolve(HERE, "..", "assets", "atlas");

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

/* -- arguments ----------------------------------------------------------- */

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const FORCE = argv.includes("--force");
const ROOT = path.resolve(arg("root", process.cwd()));
const CLONE_ARG = arg("clone");

if (!CLONE_ARG) {
  console.error(red("  --clone is required: the path to the repository this atlas reads."));
  console.error(dim("  e.g. node init-atlas.mjs --clone codex --title \"Codex Harness Atlas\""));
  process.exit(2);
}

const CLONE_ABS = path.resolve(ROOT, CLONE_ARG);
if (!existsSync(CLONE_ABS)) {
  console.error(red(`  no such directory: ${CLONE_ABS}`));
  process.exit(2);
}

/** The clone's GitHub-style owner/name, read from its origin remote. */
function inferRepo() {
  try {
    const url = execFileSync("git", ["-C", CLONE_ABS, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1];
  } catch {
    /* no remote, or not a git repo — the caller can pass --repo */
  }
  return path.basename(CLONE_ABS);
}

const REPO = arg("repo", inferRepo());
const NAME = REPO.split("/").pop();
const TITLE = arg("title", `${NAME[0].toUpperCase()}${NAME.slice(1)} Atlas`);
const SLUG =
  arg("slug") ||
  TITLE.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
  "atlas";
const PORT = arg("port", "8137");
const TAGLINE = arg(
  "tagline",
  `A local, offline guide to how ${REPO} is built, read out of its own source.`,
);

/** Relative to the atlas root when that stays readable; absolute when it does not. */
function cloneRef() {
  const rel = path.relative(ROOT, CLONE_ABS).split(path.sep).join("/");
  if (!rel) return ".";
  return rel.startsWith("../..") ? CLONE_ABS.split(path.sep).join("/") : rel;
}

const VARS = {
  "{{TITLE}}": TITLE,
  "{{TAGLINE}}": TAGLINE,
  "{{REPO}}": REPO,
  "{{CLONE}}": cloneRef(),
  "{{PORT}}": PORT,
  "{{SLUG}}": SLUG,
};

/* -- copy ---------------------------------------------------------------- */

const TEXT = new Set([".js", ".mjs", ".json", ".html", ".css", ".md", ".txt"]);
const written = [];
const skipped = [];

function substitute(text) {
  for (const [k, v] of Object.entries(VARS)) text = text.split(k).join(v);
  return text;
}

function copyInto(fromDir, toDir) {
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    const from = path.join(fromDir, entry.name);
    // launch.json belongs under .claude/, not at the root.
    const to =
      fromDir === SCAFFOLD && entry.name === "launch.json"
        ? path.join(toDir, ".claude", "launch.json")
        : path.join(toDir, entry.name);

    if (entry.isDirectory()) {
      copyInto(from, to);
      continue;
    }
    const rel = path.relative(ROOT, to).split(path.sep).join("/");
    if (existsSync(to) && !FORCE) {
      skipped.push(rel);
      continue;
    }
    mkdirSync(path.dirname(to), { recursive: true });
    const raw = readFileSync(from);
    writeFileSync(to, TEXT.has(path.extname(entry.name)) ? substitute(raw.toString("utf8")) : raw);
    written.push(rel);
  }
}

copyInto(SCAFFOLD, ROOT);

/* -- report -------------------------------------------------------------- */

const isGit = existsSync(path.join(CLONE_ABS, ".git"));

console.log(bold(`\n  ${TITLE}`));
console.log(dim(`  reading ${REPO} at ${CLONE_ABS}`));
console.log(green(`\n  ${written.length} file(s) written`) + dim(` into ${ROOT}`));
if (skipped.length) {
  console.log(dim(`  ${skipped.length} left alone (already there — pass --force to overwrite):`));
  for (const s of skipped.slice(0, 12)) console.log(dim(`    · ${s}`));
  if (skipped.length > 12) console.log(dim(`    · …and ${skipped.length - 12} more`));
}
if (!isGit) {
  console.log(
    red("\n  the clone is not a git checkout — extract-snippets.mjs cannot pin a commit."),
  );
  console.log(dim("  clone the repository with git, or the excerpts cannot carry permalinks."));
}

console.log(`
  ${bold("Next")}
    1  read the repo and write ${path.basename(ROOT)}/guide/data/snippets.manifest.json
    2  node tools/extract-snippets.mjs        ${dim("resolve every anchor")}
    3  write guide/content/*.js and list them in guide/assets/js/chapters.js
    4  node tools/check-content.mjs           ${dim("check the prose against the clone")}
    5  node guide/serve.js                    ${dim(`→ http://127.0.0.1:${PORT}/`)}
    6  in devtools: await import('/audit-layout.js'); await auditLayout();
`);
