/* ============================================================================
   highlight.js — a small, dependency-free tokeniser.

   Enough to read Rust, Go, Python, JavaScript/TypeScript, C-family, TOML,
   YAML, JSON, Markdown, shell and Lisp-ish policy DSLs accurately: string and
   comment boundaries are respected, so nothing inside a string is ever
   mis-coloured as a keyword.

   Adding a language is one entry in RULES: an ordered list of
   [sticky regex, class | fn(match, nextChar) -> class]. The first rule that
   matches at the cursor wins, so comments and strings must come first. A
   language you have no rules for renders as plain text, which is fine — wrong
   colours are worse than none.

   Tokens are produced for the whole text first, then split at newlines, so a
   construct that spans lines (a block comment, a raw string, a Rust doc block)
   stays correctly coloured across the line-numbered gutter.
   ========================================================================= */

const RUST_KEYWORDS = new Set(
  `as async await break const continue crate dyn else enum extern false fn for if impl in let
   loop match mod move mut pub ref return self Self static struct super trait true type union
   unsafe use where while yield box macro_rules`.split(/\s+/),
);

const RUST_PRIMS = new Set(
  `u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64 bool char str String Vec Option
   Result Box Arc Rc Duration HashMap HashSet BTreeMap`.split(/\s+/),
);

const SHELL_KEYWORDS = new Set(
  `if then else elif fi for while do done case esac function in return exit export local set`.split(
    /\s+/,
  ),
);

const PY_KEYWORDS = new Set(
  `and as assert async await break class continue def del elif else except finally for from
   global if import in is lambda nonlocal not or pass raise return try while with yield match
   case`.split(/\s+/),
);

const PY_CONSTS = new Set(["True", "False", "None", "self", "cls"]);

const GO_KEYWORDS = new Set(
  `break case chan const continue default defer else fallthrough for func go goto if import
   interface map package range return select struct switch type var`.split(/\s+/),
);

const GO_PRIMS = new Set(
  `bool string error any byte rune int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64
   uintptr float32 float64 complex64 complex128 nil true false iota make new len cap append`.split(
    /\s+/,
  ),
);

/* -- rule tables ----------------------------------------------------------
   Each rule is [regex (sticky), class | fn(match) -> class]. Order matters:
   the first rule that matches at the cursor wins.                          */

const RULES = {
  rust: [
    [/\/\/[!/][^\n]*/y, "t-doc"],
    [/\/\/[^\n]*/y, "t-com"],
    [/\/\*[\s\S]*?\*\//y, "t-com"],
    [/r#*"[\s\S]*?"#*/y, "t-str"],
    [/b?"(?:\\.|[^"\\])*"/y, "t-str"],
    [/'(?:\\.|[^'\\])'/y, "t-str"],
    [/#!?\[[\s\S]*?\]/y, "t-att"],
    [/\b[A-Za-z_][A-Za-z0-9_]*!/y, "t-mac"],
    [/\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?(?:[iuf](?:8|16|32|64|128|size))?\b/y, "t-num"],
    [/\b0x[0-9a-fA-F_]+\b/y, "t-num"],
    [/'[a-z_][a-z0-9_]*\b/y, "t-typ"], // lifetimes
    [
      /\b[A-Za-z_][A-Za-z0-9_]*\b/y,
      (m, after) => {
        if (RUST_KEYWORDS.has(m)) return "t-key";
        if (RUST_PRIMS.has(m)) return "t-typ";
        if (/^[A-Z]/.test(m)) return "t-typ";
        if (after === "(" || after === "!") return "t-fn";
        return null;
      },
    ],
    [/[{}()[\];,.:<>|&+\-*/%=!?#@]+/y, "t-pun"],
  ],

  toml: [
    [/#[^\n]*/y, "t-com"],
    [/"""[\s\S]*?"""/y, "t-str"],
    [/'''[\s\S]*?'''/y, "t-str"],
    [/"(?:\\.|[^"\\])*"/y, "t-str"],
    [/'[^'\n]*'/y, "t-str"],
    [/^\s*\[\[?[^\]\n]+\]\]?/my, "t-typ"],
    [/\b(?:true|false)\b/y, "t-key"],
    [/\b\d[\d_]*(?:\.\d+)?\b/y, "t-num"],
    [/^\s*[A-Za-z0-9_.-]+(?=\s*=)/my, "t-att"],
    [/[=,[\]{}]+/y, "t-pun"],
  ],

  json: [
    [/"(?:\\.|[^"\\])*"(?=\s*:)/y, "t-att"],
    [/"(?:\\.|[^"\\])*"/y, "t-str"],
    [/\b(?:true|false|null)\b/y, "t-key"],
    [/-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y, "t-num"],
    [/[{}[\],:]+/y, "t-pun"],
  ],

  // Seatbelt policy is a Lisp-ish DSL.
  lisp: [
    [/;[^\n]*/y, "t-com"],
    [/#"(?:\\.|[^"\\])*"/y, "t-str"], // regex literal
    [/"(?:\\.|[^"\\])*"/y, "t-str"],
    [/(?<=\()\s*[a-z][a-z0-9*-]*/y, "t-fn"],
    [/\b(?:allow|deny|require-all|require-any|require-not|version)\b/y, "t-key"],
    [/\b[a-z][a-z0-9*-]*(?=\s)/y, "t-att"],
    [/\b\d+\b/y, "t-num"],
    [/[()]+/y, "t-pun"],
  ],

  bash: [
    [/#[^\n]*/y, "t-com"],
    [/"(?:\\.|[^"\\])*"/y, "t-str"],
    [/'[^']*'/y, "t-str"],
    [/\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/y, "t-typ"],
    [/(?:^|(?<=[|&;(]\s))\s*[A-Za-z0-9_./-]+/y, "t-fn"],
    [/\s--?[A-Za-z0-9][A-Za-z0-9-]*/y, "t-att"],
    [
      /\b[A-Za-z_][A-Za-z0-9_]*\b/y,
      (m) => (SHELL_KEYWORDS.has(m) ? "t-key" : null),
    ],
    [/[|&;<>()$]+/y, "t-pun"],
  ],

  markdown: [
    [/^#{1,6}\s[^\n]*/my, "t-typ"],
    [/^\s*[-*+]\s/my, "t-pun"],
    [/`[^`\n]+`/y, "t-str"],
    [/\*\*[^*\n]+\*\*/y, "t-key"],
    [/`{3}[\s\S]*?`{3}/y, "t-str"],
  ],

  js: [
    [/\/\/[^\n]*/y, "t-com"],
    [/\/\*[\s\S]*?\*\//y, "t-com"],
    [/`(?:\\.|[^`\\])*`/y, "t-str"],
    [/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y, "t-str"],
    [/\b\d+(?:\.\d+)?\b/y, "t-num"],
    [
      /\b[A-Za-z_$][A-Za-z0-9_$]*\b/y,
      (m, after) => {
        if (
          /^(const|let|var|function|return|if|else|for|while|await|async|import|export|from|new|class|try|catch|throw|of|in|default|typeof)$/.test(
            m,
          )
        )
          return "t-key";
        if (/^(true|false|null|undefined)$/.test(m)) return "t-num";
        if (/^[A-Z]/.test(m)) return "t-typ";
        if (after === "(") return "t-fn";
        return null;
      },
    ],
    [/[{}()[\];,.:<>|&+\-*/%=!?]+/y, "t-pun"],
  ],

  python: [
    [/#[^\n]*/y, "t-com"],
    [/"""[\s\S]*?"""|'''[\s\S]*?'''/y, "t-str"],
    [/[rbfu]{0,2}"(?:\\.|[^"\\])*"|[rbfu]{0,2}'(?:\\.|[^'\\])*'/y, "t-str"],
    [/@[A-Za-z_][\w.]*/y, "t-att"],
    [/\b0[xob][0-9a-fA-F_]+\b/y, "t-num"],
    [/\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y, "t-num"],
    [
      /\b[A-Za-z_]\w*\b/y,
      (m, after) => {
        if (PY_KEYWORDS.has(m)) return "t-key";
        if (PY_CONSTS.has(m)) return "t-num";
        if (/^[A-Z]/.test(m)) return "t-typ";
        if (after === "(") return "t-fn";
        return null;
      },
    ],
    [/[{}()[\];,.:<>|&+\-*/%=!?]+/y, "t-pun"],
  ],

  go: [
    [/\/\/[^\n]*/y, "t-com"],
    [/\/\*[\s\S]*?\*\//y, "t-com"],
    [/`[^`]*`/y, "t-str"],
    [/"(?:\\.|[^"\\])*"/y, "t-str"],
    [/'(?:\\.|[^'\\])'/y, "t-str"],
    [/\b0x[0-9a-fA-F_]+\b/y, "t-num"],
    [/\b\d[\d_]*(?:\.\d+)?\b/y, "t-num"],
    [
      /\b[A-Za-z_]\w*\b/y,
      (m, after) => {
        if (GO_KEYWORDS.has(m)) return "t-key";
        if (GO_PRIMS.has(m)) return "t-typ";
        if (/^[A-Z]/.test(m)) return "t-typ";
        if (after === "(") return "t-fn";
        return null;
      },
    ],
    [/[{}()[\];,.:<>|&+\-*/%=!?]+/y, "t-pun"],
  ],

  yaml: [
    [/#[^\n]*/y, "t-com"],
    [/"(?:\\.|[^"\\])*"|'[^'\n]*'/y, "t-str"],
    [/^\s*-\s/my, "t-pun"],
    [/^\s*[A-Za-z0-9_.-]+(?=\s*:)/my, "t-att"],
    [/\b(?:true|false|null|yes|no|on|off)\b/y, "t-key"],
    [/\b\d+(?:\.\d+)?\b/y, "t-num"],
    [/[:[\]{},|>]+/y, "t-pun"],
  ],
};

/* Close-enough aliases. A C-family file highlighted with the JS rules gets
   comments, strings and numbers right, which is most of the benefit; only the
   keyword set is approximate. */
/* What the model actually receives: fragment markers, headings, key: value
   lines. Not a real grammar — just enough structure to read a transcript. */
RULES.wire = [
  [/<\/?[A-Za-z_][A-Za-z0-9_.:-]*>/y, "t-typ"],
  [/^\s*#{1,6}\s[^\n]*/my, "t-key"],
  [/^\s*[A-Za-z_][A-Za-z0-9_ ()-]*:(?=\s|$)/my, "t-att"],
  [/"(?:\\.|[^"\\])*"/y, "t-str"],
  [/\b\d+(?:[._]\d+)*\b/y, "t-num"],
  [/[|<>]+/y, "t-pun"],
];

RULES.ts = RULES.js;
RULES.tsx = RULES.js;
RULES.jsx = RULES.js;
RULES.clike = RULES.js;
RULES.text = [];

export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Tokenise `code` into a flat [{cls, text}] list. */
function tokenize(code, lang) {
  const rules = RULES[lang] || RULES.text;
  if (!rules.length) return [{ cls: null, text: code }];

  const out = [];
  let i = 0;
  let plainStart = 0;

  const flushPlain = (upto) => {
    if (upto > plainStart) out.push({ cls: null, text: code.slice(plainStart, upto) });
  };

  outer: while (i < code.length) {
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        const text = m[0];
        const resolved =
          typeof cls === "function" ? cls(text, code[i + text.length]) : cls;
        if (resolved) {
          flushPlain(i);
          out.push({ cls: resolved, text });
          i += text.length;
          plainStart = i;
        } else {
          i += text.length; // matched, but stays plain — keep it in the run
        }
        continue outer;
      }
    }
    i++;
  }
  flushPlain(code.length);
  return out;
}

/**
 * Render `code` as an array of HTML strings, one per line, with tokens split
 * correctly across newlines.
 */
export function highlightLines(code, lang) {
  const tokens = tokenize(code, lang);
  const lines = [""];
  for (const { cls, text } of tokens) {
    const parts = text.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push("");
      if (!part) return;
      const html = escapeHtml(part);
      lines[lines.length - 1] += cls ? `<span class="${cls}">${html}</span>` : html;
    });
  }
  return lines;
}
