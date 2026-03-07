# Minimal Mojo 🔥 interpreter (JavaScript)

A **source-level transpiler** that reads simple Mojo programs and runs them by translating to JavaScript and executing with a small runtime.

**Try it in the browser:** [https://exergy-connect.github.io/mojo-js/web/](https://exergy-connect.github.io/mojo-js/web/)

## Usage

```bash
node run.js <file.mojo> [args...]
node run.js -p <file.mojo>   # print emitted JS only

# Examples:
node run.js web/example.mojo 42
node run.js web/ivi_standalone.mojo 3127
```

**Tests:** `npm test` runs the suite (47 construct tests under `test/constructs/`).

## What it does

1. **Tokenize** – Mojo source → tokens (including INDENT/DEDENT for block structure).
2. **Parse** – Tokens → AST (program with structs, functions, `def main`).
3. **Emit** – AST → JavaScript (structs as constructor functions, `fn`/`def` as functions, List → arrays).
4. **Run** – Evaluate emitted JS with a tiny runtime (`argv`, `print`, `atol`, `range`, `len`, `b64encode`, `b64decode`).

## Supported Mojo subset

- **Top-level:** `struct Name(Traits):` (fields, `__init__`, methods), `fn name(...):`, `def main():`
- **Statements:** `var x = ...`, `x = ...`, `x += ...`, `if`/`elif`/`else`, `while`, `for x in range(n):`, `return`, `continue`, `pass`, `raise`, `try`/`except`
- **Expressions:** literals, `+` `-` `*` `//` `%`, `==` `!=` `<` `<=` `>` `>=`, `and`/`or`/`not`, `len()`, `range(n)` / `range(a,b)`, `List[Int]()`, struct construction, `.copy()`, `.append()`, method calls (`s.method()`)
- **Runtime:** `argv()`, `print(...)`, `atol(s)`, `b64encode(s)`, `b64decode(s)` ([std.base64](https://docs.modular.com/mojo/std/base64/base64/) – base64 only)

## Project layout

- **`src/`** – Source: `tokenizer.js`, `parser.js`, `emit.js`, `runtime.js`, `run.js`, `ast-types.js`, `token-types.js`.
- **`test/`** – Test suite: `run-tests.js` (runner), `constructs/*.mojo` (one test per supported construct).
- **`web/`** – Web project: `index.html` (run Mojo in the browser), `entry.js` (browser bundle entry).
- **`run.js`** – CLI entry (delegates to `src/run.js`).
- **`build.js`** – Bundles `web/entry.js` with esbuild; `npm run build` produces `web/mojo-js.min.js`.

## Build (minified bundle)

```bash
cd mojo-js && npm install && npm run build
```

Opens `web/index.html` in a browser to run Mojo from the textarea. Use `?mojo=<URL>` to load a program from that URL on page load (e.g. `.../web/?mojo=https://.../script.mojo`).

**CI (GitHub Actions):**
- **`minify.yml`** – On push when `src/`, `web/entry.js`, or `build.js` change: install, `npm run build`, commit minified bundle.
- **`test.yml`** – On push/PR when `src/` or `test/` change: install, `npm test`.

## Status

The pipeline parses and runs a **Mojo subset** sufficient for programs like `ivi_standalone.mojo` (structs, `fn`/`def`, control flow, `+=`, etc.). Unsupported syntax or further edge cases may require parser/emitter updates.

To try a minimal program, use a short script that only uses the supported subset (e.g. `def main():` with `print`, `argv`, `atol`, `range`, `len`).
