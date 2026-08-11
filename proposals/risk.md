# Proposal: Block-level `risk` (replacing `unsafe_` naming)

Experimental language feature for [mojo-js](../README.md), enabled with `--feature risk` or `parse(source, { features: ['risk'] })`.

Implementation: [`src/extensions/risk/`](../src/extensions/risk/).

## 1. Motivation

Mojo today tracks unsafety largely by **naming convention**: identifiers such as `Pointer.unsafe_offset` and `List.unsafe_get` bake danger into the API surface. That keeps call sites greppable, but:

- Obscures algorithmic intent under repeated `unsafe_` prefixes.
- Conflates **semantic** names (`offset`, `get`) with **safety** acknowledgment.
- Does not say *which* invariant was verified (bounds vs init state vs lifetime).

This POC explores **block-level `risk(...)` scopes** as a successor to that practice: keep API names semantic, and move explicit, greppable acknowledgment to tight lexical blocks—aligned with the [Modular Risk Effect proposal](https://forum.modular.com/t/proposal-the-risk-effect-reducing-the-verbosity-of-unsafe-naming-convention/3382) and the [block-level comment](https://forum.modular.com/t/proposal-the-risk-effect-reducing-the-verbosity-of-unsafe-naming-convention/3382/4) arguing against signature pollution.

## 2. Mojo `unsafe_` risk scope (what this replaces)

| Semantic risk | What `unsafe_` / unsafe APIs acknowledge | Representative APIs |
|---|---|---|
| **`OOB`** | Access without a bounds proof | `List.unsafe_get` / `Array.unsafe_get`; proposal `Pointer.unsafe_offset`; `unsafe_ptr()` past `len` |
| **`UNINIT`** | Touching memory with unverified init state (proposal `UMemIn` / `UMemOut`) | `unsafe_write` / `unsafe_deinit`; `init_pointee_*` / `destroy_pointee` / `take_pointee`; `unsafe_uninit_length` |
| **`UAF`** | Use after lifetime/origin is invalid | `unsafe_dangling()`; `unsafe_origin_cast` / `as_unsafe_any_origin`; holding `unsafe_ptr()` after move/free |

Out of POC core (follow-on): leak helpers such as `unsafe_leak`. Proposal `UMemIn`/`UMemOut` collapse into **`UNINIT`** here.

Sources: [forum proposal](https://forum.modular.com/t/proposal-the-risk-effect-reducing-the-verbosity-of-unsafe-naming-convention/3382), [UnsafePointer](https://docs.modular.com/mojo/std/memory/unsafe_pointer/UnsafePointer/), List/Array docs.

## 3. Industry context — top 3 risks

Memory-unsafe defects still dominate critical reports (~70% historically at Microsoft/Chromium; [CISA](https://www.cisa.gov/news-events/news/urgent-need-memory-safety-software-products)). POC vocabulary:

1. **`OOB`** (CWE-787 / CWE-125) — [Heartbleed](https://heartbleed.com/) (CVE-2014-0160); [EternalBlue](https://en.wikipedia.org/wiki/EternalBlue) / WannaCry (CVE-2017-0144).
2. **`UAF`** (CWE-416) — Chrome/WebKit sandbox escapes; kernel UAF chains (e.g. CVE-2024-1086).
3. **`UNINIT`** (CWE-908 / CWE-457) — uninitialized reads → leaks / broken ASLR; called out in [ASD memory-safe roadmaps](https://www.cyber.gov.au/business-government/secure-design/secure-by-design/the-case-for-memory-safe-roadmaps).

## 4. Semantic risk vs hardware traps

Risk names describe **program semantics** (which invariant the author claims), not CPU/ISA events. Some risks *materialize* as traps on particular architectures (Intel page faults, #GP, Arm MTE). Documented CPU trap catalogs are a useful **source of candidates**, not a 1:1 naming scheme and not exhaustive. Keep vocabulary semantic (`OOB`, `UAF`, `UNINIT`).

## 5. Goals / non-goals

**Goals:** localized, greppable risk acknowledgment; comptime-conditional mitigation; extensible feature hooks under `src/extensions/`.

**Non-goals (this POC):** full effect inference beyond direct calls; `@risk` / `using risk` / general `with`; real Pointer APIs or UB checking; true comptime constant-folding of conditional risk masks.

## 6. Before / after (conceptual)

```text
# Today (naming convention)
ptr = ptr.unsafe_offset(k)
x = list.unsafe_get(i)

# With risk feature (semantic names + local acknowledgment)
risk(OOB):
    ptr = ptr + k
    x = list[i]
```

## 7. Syntax

```
risk_stmt     = "risk" "(" risk_clause { "|" risk_clause } ")" ":" block
risk_annot    = "risk" "(" risk_name { "|" risk_name } ")"   # on def/method signatures
risk_clause   = risk_name
              | risk_name "if" expression "else" risk_name
risk_name     = ID   # OOB | UAF | UNINIT | NO_RISK — identifiers only
```

**Identifiers only:** `risk(1):` or `risk(OOB | 4):` is a parse error. Risks must stay greppable and explicit.

**Signature annotation** (introduces risk; same as wrapping the body in that block for discharge of calls *inside* the function):

```
def read(buf, i) risk(UNINIT) -> Int:
    return buf[i]

def reverse(buf, start, end) risk(OOB | UNINIT):
    ...
```

**Call-site discharge:** calling a `risk(A|B)` function requires an enclosing scope that covers `A|B` — either a `risk(A|B):` block or the caller’s own `risk(A|B)` annotation. Otherwise this is a **semantic error** (not a parse error). Pass `--accept-risks` (or `parse(..., { acceptRisks: true })`) to skip the check.

### Simple

```text
risk(OOB):
    print(1)
```

### Comptime-conditional mitigation

```
def get[BOUNDS_CHECK: Bool]​(arr: List[Int], i: Int) raises -> Int:
    if BOUNDS_CHECK:
        if i < 0 or i >= len(arr):
            raise Error("index out of bounds")
    risk(OOB if not BOUNDS_CHECK else NO_RISK):
        return arr[i]
```

### Combined clauses

```text
risk(OOB if not BOUNDS_CHECK else NO_RISK | UAF):
    pass
```

## 8. Bitmask encoding

Internal encoding in [`src/extensions/risk/bits.js`](../src/extensions/risk/bits.js):

```
NO_RISK = 0
OOB     = 1 << 0   # 1
UAF     = 1 << 1   # 2
UNINIT  = 1 << 2   # 4
```

Source `|` between clauses is bitwise OR. Masks are never written as digits in Mojo source.

## 9. Semantics (mojo-js)

AST: `{ type: Risk, clauses: [...], body: Statement[] }`; functions/methods may carry `riskMask`.

- `mask` clause → `{ kind: 'mask', mask }`
- conditional → `{ kind: 'conditional', thenMask, condition, elseMask }`
- Signature `risk(A|B)` → `riskMask = A|B` (no conditionals on signatures)

**Compile-time coverage** ([`check.js`](../src/extensions/risk/check.js)): every call to a callee with non-zero `riskMask` must occur under an enclosing scope whose acknowledged bits cover that mask. Function `riskMask` is identical to wrapping the body in `risk(...)`. Block scopes OR bits from their clauses (conditionals contribute `then|else`). Failures throw `SemanticError`.

Emit still calls `acknowledgeRisk(<maskExpr>)` then runs block bodies (runtime no-op documentation in JS). Enforcement is the semantic check unless `--accept-risks`.

## 10. Extension hook integration

- Registry: [`src/extensions/index.js`](../src/extensions/index.js)
- Pack: [`src/extensions/risk/`](../src/extensions/risk/) (`index.js`, `bits.js`, `parse.js`, `emit.js`, `check.js`)
- Enable: `parse(source, { features: ['risk'] })`, `emitProgram(program, rt, { features: ['risk'] })`, CLI `node run.js --feature risk file.mojo`
- Skip coverage check: `parse(source, { features: ['risk'], acceptRisks: true })` or CLI `--accept-risks`
- Future POCs: add `src/extensions/<name>/` and register in the index.

## 11. Examples

Runnable demos under [`web/risk/`](../web/risk/) (`node run.js --feature risk web/risk/<file>.mojo`):

- [`oob.mojo`](../web/risk/oob.mojo) — `get_unchecked` annotated `risk(OOB)`; call sites use `risk(OOB):`
- [`uaf.mojo`](../web/risk/uaf.mojo) — `load_raw` annotated `risk(UAF)`
- [`uninit.mojo`](../web/risk/uninit.mojo) — Arena `read`/`write`/`take` annotated `risk(UNINIT)`
- [`rotate.mojo`](../web/risk/rotate.mojo) — `reverse`/`rotate` annotated `risk(OOB | UNINIT)`
- [`conditional.mojo`](../web/risk/conditional.mojo) — unchecked path calls `get_unchecked` under `risk(OOB):`

Tests: [`test/extensions/risk/`](../test/extensions/risk/).

## 12. Open questions

- `@risk` line decorator, `with risk`, `using risk`
- Signature-level effects beyond direct call coverage / `--accept-risks`
- Splitting `UNINIT` back into `UMemIn` / `UMemOut`
- True comptime folding of risk masks
- Resource-leak risks (`unsafe_leak`) as additional bits

## 13. Test plan

- Construct fixtures under `test/extensions/risk/` (feature enabled via directory name)
- Without `--feature risk`, `risk(...):` does not parse as this statement
- Numeric risk operands rejected when the feature is enabled
- Uncovered calls to `risk(...)`-annotated callees are a compile error; `--accept-risks` skips the check
