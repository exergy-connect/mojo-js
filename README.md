# Minimal Mojo 🔥 interpreter (JavaScript)

A **source-level transpiler** that reads simple Mojo programs and runs them by translating to JavaScript and executing with a small runtime.

**Try it in the browser:** [https://exergy-connect.github.io/mojo-js/web/](https://exergy-connect.github.io/mojo-js/web/)

## Usage

```bash
node run.js <file.mojo> [args...]
# Example:
node run.js ivi_standalone.mojo 3127
```

## What it does

1. **Tokenize** – Mojo source → tokens (including INDENT/DEDENT for block structure).
2. **Parse** – Tokens → AST (program with structs, functions, `def main`).
3. **Emit** – AST → JavaScript (structs as constructor functions, `fn`/`def` as functions, List → arrays).
4. **Run** – Evaluate emitted JS with a tiny runtime (`argv`, `print`, `atol`, `range`, `len`).

## Supported Mojo subset

- **Top-level:** `struct Name(Traits):`, `fn name(...):`, `def main():`
- **Statements:** `var x = ...`, `if`/`else`, `while`, `for x in range(n):`, `return`
- **Expressions:** literals, `+` `-` `*` `//` `%`, `==` `<` `>`, `and`/`or`/`not`, `len()`, `range(n)` / `range(a,b)`, `List[Int]()`, struct construction, `.copy()`, `.append()`
- **Runtime:** `argv()`, `print(...)`, `atol(s)`

## Project layout

- **`src/`** – Source: `tokenizer.js`, `parser.js`, `emit.js`, `runtime.js`, `run.js`.
- **`web/`** – Web project: `index.html` (run Mojo in the browser), `entry.js` (browser bundle entry).
- **`run.js`** – CLI entry (delegates to `src/run.js`).
- **`build.js`** – Bundles `web/entry.js` with esbuild; `npm run build` produces `web/mojo-js.min.js`.

## Build (minified bundle)

```bash
cd mojo-js && npm install && npm run build
```

Opens `web/index.html` in a browser to run Mojo from the textarea. A **GitHub Actions** workflow (`.github/workflows/minify.yml`) runs on push to `main`/`master` when source or build config changes: installs deps, runs `npm run build`, and uploads the minified bundle as an artifact.

## Status

The pipeline parses and runs a **Mojo subset** sufficient for programs like `ivi_standalone.mojo` (structs, `fn`/`def`, control flow, `+=`, etc.). Unsupported syntax or further edge cases may require parser/emitter updates.

To try a minimal program, use a short script that only uses the supported subset (e.g. `def main():` with `print`, `argv`, `atol`, `range`, `len`).
