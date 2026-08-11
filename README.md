# Minimal Mojo 🔥 interpreter (JavaScript)

A **source-level transpiler** that reads simple Mojo programs and runs them by translating to JavaScript and executing with a small runtime.

**Try it in the browser:** [https://exergy-connect.github.io/mojo-js/web/](https://exergy-connect.github.io/mojo-js/web/)

## Usage

```bash
node run.js <file.mojo> [args...]
node run.js -p <file.mojo>   # print emitted JS only
node run.js --feature risk <file.mojo>   # enable experimental risk blocks

# Examples:
node run.js web/example.mojo 42
node run.js web/ivi_standalone.mojo 3127
node run.js --feature risk web/risk/oob.mojo
node run.js --feature risk web/risk/rotate.mojo 3
```

**Tests:** `npm test` runs the suite (construct, tokenizer, and runtime tests).

## What it does

1. **Tokenize** – Mojo source → tokens (including INDENT/DEDENT for block structure).
2. **Parse** – Tokens → AST (program with structs, functions, `def main`).
3. **Emit** – AST → JavaScript (structs as constructor functions, `def` as functions, List → arrays).
4. **Run** – Evaluate emitted JS with a tiny runtime (`argv`, `print`, `atol`, `range`, `len`, `b64encode`, `b64decode`).

## Supported Mojo subset

- **Top-level:** `trait Name:`, `struct Name(Traits):` (fields, `__init__`, methods), `def name(...):`, `def main():`
- **Traits** (see [Mojo traits manual](https://docs.modular.com/mojo/manual/traits)): `trait Name:` or `trait Name(Parent):` (refinement); trait methods `def method(self):` with body (e.g. `pass` or default impl); structs conform via `struct Name(Copyable, TraitName):`; runtime helpers `requireTrait(obj, ["method"])`, `hasMethod(obj, "method")` in `runtime-traits.js`.
- **Structs** (see [Mojo structs manual](https://docs.modular.com/mojo/manual/structs/)): `struct Name:` or `struct Name(Copyable):` / `struct Name(Movable):`; fields as `var name: Type`; constructor `def __init__(out self, ...):`; optional copy/move via `def __init__(out self, *, copy: Self):` / `def __init__(out self, *, deinit take: Self):`; instance methods with `self` (and `mut self`); `Struct(args...)` construction and `instance.copy()` when Copyable (trait or `__init__(*, copy:)`).
- **Statements:** `var x = ...`, `x = ...`, `x += ...`, `if`/`elif`/`else`, `while`, `for x in range(n):`, `return`, `continue`, `pass`, `raise`, `try`/`except`
- **Expressions:** literals, `+` `-` `*` `//` `%`, `==` `!=` `<` `<=` `>` `>=`, `and`/`or`/`not`, `len()`, `range(n)` / `range(a,b)`, `List[Int]()`, struct construction, `.copy()`, `.append()`, method calls (`s.method()`)
- **Runtime:** `src/runtime.js` (argv, print, atol, range, len, b64encode, b64decode, acknowledgeRisk); `src/runtime-traits.js` (hasMethod, requireTrait for trait conformance).

Deprecated Mojo forms (`fn`, `inout`, `__copyinit__`, `__moveinit__`) are rejected.

### Experimental features

Enable with `--feature <name>` (CLI) or `{ features: ['name'] }` on `parse` / `emitProgram` / `runMojo`. Extensions live under `src/extensions/`.

- **`risk`** — block-level `risk(OOB):` / `risk(OOB if not BOUNDS_CHECK else NO_RISK):` acknowledgment (bitmasks; identifiers only). Intended as a POC successor to Mojo’s `unsafe_` naming convention. Design note: [proposals/risk.md](proposals/risk.md). Examples: [web/risk/](web/risk/).

## Project layout

- **`src/`** – Source: `tokenizer.js`, `parser.js`, `emit.js`, `runtime.js`, `runtime-traits.js`, `run.js`, `ast-types.js`, `token-types.js`, `extensions/` (experimental feature packs).
- **`proposals/`** – Design notes for experimental language features (e.g. `risk.md`).
- **`test/`** – Test suite: `run-tests.js` (runner), `constructs/*.mojo` (core constructs), `extensions/<feature>/*.mojo` (experimental packs).
- **`web/`** – Web project: `index.html` (run Mojo in the browser), `entry.js` (browser bundle entry), `risk/` (experimental risk feature examples).
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

## Workflow: adding full support for a language feature

When adding or completing support for a Mojo language feature (e.g. structs), use this workflow:

1. **Use the official manual** – Start from the relevant [Modular Mojo docs](https://docs.modular.com/mojo/) (e.g. [Structs](https://docs.modular.com/mojo/manual/structs/)) to define the target behavior and syntax.
2. **Audit current support** – In this repo: parser (`src/parser.js`), AST (`ast.d.ts`, `src/ast-types.js`), emitter (`src/emit.js`), and existing tests under `test/constructs/` and `grammar.ebnf`. Note what already works and what is missing.
3. **Implement gaps** – Add or adjust tokens/keywords, parser rules, AST shapes, and emit logic so behavior matches the manual (e.g. Copyable trait generating `.copy()` even without a custom `__init__(*, copy:)`).
4. **Add a manual-aligned test** – Add a `test/constructs/<feature>_*.mojo` file that mirrors an example from the manual (e.g. `struct_mypair.mojo` for the MyPair struct), and ensure `npm test` passes.
5. **Update the README** – In “Supported Mojo subset”, add or update a bullet that references the manual and briefly lists what is supported (syntax, traits, special methods, etc.).

## Status

The pipeline parses and runs a **Mojo subset** sufficient for programs like `ivi_standalone.mojo` (structs, `def`, control flow, `+=`, etc.). Unsupported syntax or further edge cases may require parser/emitter updates.

To try a minimal program, use a short script that only uses the supported subset (e.g. `def main():` with `print`, `argv`, `atol`, `range`, `len`).
