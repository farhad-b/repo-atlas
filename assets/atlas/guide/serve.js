#!/usr/bin/env node
/**
 * serve.js — a static file server for the guide. No dependencies.
 *
 *   node guide/serve.js [--port {{PORT}}] [--no-open]
 *
 * The guide is plain HTML + ES modules, so it needs a server only because
 * browsers refuse to load ES modules over file://. Nothing here talks to the
 * network; it serves the files in this directory and nothing else.
 */

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const portArg = argv.indexOf("--port");
const PORT = portArg !== -1 ? Number(argv[portArg + 1]) : {{PORT}};
const OPEN = !argv.includes("--no-open");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const server = createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("bad request");
    return;
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  // Resolve inside ROOT and refuse anything that escapes it.
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^([/\\])+/, ""));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }

  let stat;
  try {
    stat = statSync(filePath);
    if (stat.isDirectory()) throw new Error("dir");
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("404 — not found");
    return;
  }

  res.writeHead(200, {
    "content-type": TYPES[path.extname(filePath)] ?? "application/octet-stream",
    "content-length": stat.size,
    // Always revalidate: this is a dev/reading server, staleness is pure friction.
    "cache-control": "no-cache",
  });
  createReadStream(filePath).pipe(res);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  port ${PORT} is already in use — try: node guide/serve.js --port ${PORT + 1}\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`\n  \x1b[1m{{TITLE}}\x1b[0m`);
  console.log(`  \x1b[2mserving\x1b[0m ${ROOT}`);
  console.log(`  \x1b[32m→\x1b[0m ${url}\n  \x1b[2mCtrl-C to stop\x1b[0m\n`);
  if (OPEN) openBrowser(url);
});

function openBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* headless is fine — the URL is printed above */
  }
}
