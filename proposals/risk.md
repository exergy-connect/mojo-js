# Proposal: Block-level `risk` for Explicit Safety Acknowledgment

Experimental language-design POC for [mojo-js](../README.md). Enable with `--feature risk` or `parse(source, { features: ['risk'] })`.

Implementation: [`src/extensions/risk/`](../src/extensions/risk/). Demos: [`web/risk/`](../web/risk/). Tests: [`test/extensions/risk/`](../test/extensions/risk/).

Related discussion: [Modular Risk Effect proposal](https://forum.modular.com/t/proposal-the-risk-effect-reducing-the-verbosity-of-unsafe-naming-convention/3382) and the [block-level acknowledgment comment](https://forum.modular.com/t/proposal-the-risk-effect-reducing-the-verbosity-of-unsafe-naming-convention/3382/4).

## 1. Value of the experiment

Mojo often tracks unsafety by **naming convention**: `Pointer.unsafe_offset`, `List.unsafe_get`, and similar APIs bake caution into the identifier ([UnsafePointer](https://docs.modular.com/mojo/std/memory/unsafe_pointer/UnsafePointer/), List/Array docs). That keeps call sites greppable, but one name does two jobs:

1. **Semantic operation** — what the call does (`offset`, `get`, `take`, `write`).
2. **Safety acknowledgment** — accepting that some invariant is not established at this site.

This POC separates those concerns:

- Keep **semantic** API names.
- Name the **specific invariant** that remains open (`OOB`, `UNINIT`, `UAF`, …).
- Make **acknowledgment** an explicit lexical (or signature) act: `risk(OOB):`.
- Allow **mitigation** on a path that never uses the risk-bearing operation (e.g. a bounds-checked specialization).

Binary `unsafe` is largely all-or-nothing. Named risks let one invariant be established (bounds) while another stays open (init or lifetime) at the same point—and make that residual risk greppable without `unsafe_` noise on every call.

### Introduction vs acknowledgment vs mitigation

| Concept | Meaning in this design |
|---|---|
| **Introduction / propagation** | Using an operation depends on an unproven invariant. Declared on the callee: `def get_unchecked(...) risk(OOB) -> Int:`. |
| **Acknowledgment** | `risk(OOB):` — lexical scope where the programmer *accepts* that risk for covered calls. Does not create the risk. Signature `def f(...) risk(OOB):` acknowledges for calls inside `f` and propagates `OOB` to callers of `f`. |
| **Mitigation / discharge** | Establish the invariant (or avoid the risk-bearing API) so the obligation does not remain on that path—e.g. bounds check then return without calling `get_unchecked`. |

## 2. Motivating vocabulary

Familiar memory-safety shapes supply labels for the experiment (not a final Mojo taxonomy). Context: [CISA on memory safety](https://www.cisa.gov/news-events/news/urgent-need-memory-safety-software-products).

| Risk | Invariant in question | Illustrative references |
|---|---|---|
| **`OOB`** | Bounds | CWE-787 / CWE-125; [Heartbleed](https://heartbleed.com/); [EternalBlue](https://en.wikipedia.org/wiki/EternalBlue) |
| **`UAF`** | Lifetime / origin | CWE-416; e.g. CVE-2024-1086 |
| **`UNINIT`** | Initialization state | CWE-908 / CWE-457; [ASD roadmap discussion](https://www.cyber.gov.au/business-government/secure-design/secure-by-design/the-case-for-memory-safe-roadmaps) |

Names are **semantic** (which invariant is open), not CPU trap codes. Forum discussion sometimes splits init further (`UMemIn` / `UMemOut`); this POC folds those into **`UNINIT`**.

Rough map from `unsafe_`-style APIs:

| Risk | Typical API role |
|---|---|
| **`OOB`** | `unsafe_get`, `unsafe_offset`, access past `len` |
| **`UNINIT`** | write / deinit / init / take pointee; uninit length |
| **`UAF`** | dangling / origin-cast; raw pointer across free |

## 3. Before / after

```text
# Naming convention: acknowledgment baked into the name
ptr = ptr.unsafe_offset(k)
x = list.unsafe_get(i)

# Separated: semantic ops + explicit acknowledgment of residual risk
risk(OOB):
    ptr = ptr + k
    x = list[i]
```

In the POC, introduction is on the callee (`risk(OOB)` on the signature); acknowledgment is required at the call site (block or caller annotation).

## 4. What the POC builds

| Piece | Role |
|---|---|
| `risk(A\|B):` / `risk(A if cond else B):` | Lexical acknowledgment |
| `def f(...) risk(A\|B):` | Introduces/propagates bits; acknowledges for calls inside `f` |
| Coverage check ([`check.js`](../src/extensions/risk/check.js)) | Semantic error if an annotated callee is called without covering acknowledgment |
| `--accept-risks` | Explicit escape hatch for the check |
| Bitmasks `OOB`, `UAF`, `UNINIT`, `NO_RISK` | Internal encoding; identifiers only in source |

```
risk_stmt   = "risk" "(" risk_clause { "|" risk_clause } ")" ":" block
risk_annot  = "risk" "(" risk_name { "|" risk_name } ")"
risk_clause = risk_name | risk_name "if" expression "else" risk_name
risk_name   = ID
```

Encoding ([`bits.js`](../src/extensions/risk/bits.js)): `NO_RISK=0`, `OOB=1`, `UAF=2`, `UNINIT=4`. CLI: `node run.js --feature risk file.mojo` (optional `--accept-risks`).

## 5. Central experiment: comptime specialization and `OOB`

Can a **`comptime` specialization carry a different statically visible risk contract**—not only a runtime branch that skips an unchecked load?

([`web/risk/conditional.mojo`](../web/risk/conditional.mojo), [`test/extensions/risk/risk_conditional.mojo`](../test/extensions/risk/risk_conditional.mojo)):

```
def get_unchecked(arr: List[Int], i: Int) risk(OOB) -> Int:
    return arr[i]

def get[BOUNDS_CHECK: Bool](arr: List[Int], i: Int) raises -> Int:
    if BOUNDS_CHECK:
        if i < 0 or i >= len(arr):
            raise Error("index out of bounds")
        return arr[i]
    risk(OOB):
        return get_unchecked(arr, i)
```

- **`get[True]`** — Bounds check; never calls `get_unchecked` on that path. Mitigation keeps `OOB` off the checked specialization’s success path.
- **`get[False]`** — Calls `get_unchecked` (**introduces** `OOB`) under `risk(OOB):` (**acknowledges**). Missing acknowledgment → semantic error (unless `--accept-risks`).

The parser also accepts `risk(OOB if not BOUNDS_CHECK else NO_RISK):`; the demos emphasize specialization + a risk-bearing callee.

## 6. Another dimension: `UNINIT` and state

([`web/risk/uninit.mojo`](../web/risk/uninit.mojo)) — arena slots with an init flag; methods annotated `risk(UNINIT)`:

- **`write`** — Treats the slot as open for init write, then marks initialized.
- **`take`** — Moves the value out and returns the slot to uninitialized.
- **`read`** — Load under an open init obligation in this model.

Call sites use `risk(UNINIT):`. Risk tracks a **state transition** (initialized ↔ uninitialized), not only a fixed `unsafe_*` name.

## 7. Other demos

| File | Focus |
|---|---|
| [`oob.mojo`](../web/risk/oob.mojo) | `get_unchecked` / overread past live length |
| [`uaf.mojo`](../web/risk/uaf.mojo) | `load_raw` after free + reuse |
| [`rotate.mojo`](../web/risk/rotate.mojo) | `risk(OOB \| UNINIT)` on reverse/rotate |
| [`conditional.mojo`](../web/risk/conditional.mojo) | §5 |
| [`uninit.mojo`](../web/risk/uninit.mojo) | §6 |

Hooks: [`src/extensions/`](../src/extensions/) registry; risk pack under [`src/extensions/risk/`](../src/extensions/risk/).

## 8. Questions being explored

1. **Taxonomy** — What should count as a risk, and who defines the set?
2. **Inference vs declaration** — Declare on APIs (as here), infer from bodies, or both?
3. **Propagation** — How should risk flow through calls, generics, and higher-order code?
4. **Discharge** — When does a check or proof clear an obligation, and how is that shown in the language?
5. **Comptime conditionality** — Can specializations expose different risk contracts (§5)?
6. **Composition** — Is bitmask OR (`OOB | UNINIT`) the right algebra for simultaneous risks?
7. **Other effects** — How should risk interact with `raises` and future effects?
8. **Public contract** — Should signature `risk(...)` be part of a function’s API surface?
9. **Tooling** — How should IDEs and auditors surface and review acknowledgment?
10. **Surface syntax** — `@risk`, `with` / `using`, alternate spellings, finer `UNINIT` splits, leak-related risks, …

## 9. Test plan (mojo-js)

- Fixtures under `test/extensions/risk/`
- Feature off → `risk(...):` is not this form
- Numeric risk operands rejected when the feature is on
- Uncovered annotated calls → `SemanticError`; `--accept-risks` skips the check
