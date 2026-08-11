/**
 * Compile-time risk coverage: calls to functions/methods annotated risk(...)
 * must occur under an enclosing risk scope that covers those bits
 * (function signature risk(...) is identical to wrapping the body in that block).
 * Skipped when options.acceptRisks is true (--accept-risks).
 *
 * Call sites with comptime Bool type args fold `R if cond else S` when possible.
 */

const T = require('../../ast-types.js');
const { formatRiskMask } = require('./bits.js');

class SemanticError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SemanticError';
  }
}

/**
 * Static mask for acknowledgment scope (conditionals: then|else).
 * @param {object[]} clauses
 * @returns {number}
 */
function clausesAckMask(clauses) {
  let mask = 0;
  for (const c of clauses || []) {
    if (c.kind === 'mask') mask |= c.mask;
    else if (c.kind === 'conditional') mask |= c.thenMask | c.elseMask;
  }
  return mask;
}

/**
 * Evaluate a simple Bool expression under a name→boolean env (comptime params).
 * @param {object} expr
 * @param {Map<string, boolean>} env
 * @returns {boolean|null} null if not foldable
 */
function evalBoolExpr(expr, env) {
  if (!expr) return null;
  if (expr.type === T.Bool) return !!expr.value;
  if (expr.type === T.Id) {
    if (!env.has(expr.name)) return null;
    return env.get(expr.name);
  }
  if (expr.type === T.Unary && expr.op === 'not') {
    const v = evalBoolExpr(expr.arg, env);
    return v == null ? null : !v;
  }
  return null;
}

/**
 * Fold risk clauses to a concrete mask when conditions are decidable; else then|else union.
 * @param {object[]} clauses
 * @param {Map<string, boolean>} env
 * @returns {number}
 */
function foldRiskClauses(clauses, env) {
  let mask = 0;
  for (const c of clauses || []) {
    if (c.kind === 'mask') {
      mask |= c.mask;
    } else if (c.kind === 'conditional') {
      const v = evalBoolExpr(c.condition, env);
      if (v === true) mask |= c.thenMask;
      else if (v === false) mask |= c.elseMask;
      else mask |= c.thenMask | c.elseMask;
    }
  }
  return mask;
}

/**
 * @param {object} fn — Function/Method AST
 * @param {object[]} typeArgs — Call typeArgs
 * @returns {Map<string, boolean>}
 */
function typeParamEnv(fn, typeArgs) {
  const env = new Map();
  const params = fn.typeParams || [];
  for (let i = 0; i < params.length && i < (typeArgs || []).length; i++) {
    const a = typeArgs[i];
    if (a && a.type === T.Bool) env.set(params[i].name, !!a.value);
  }
  return env;
}

/**
 * @param {object} program
 */
function buildRiskTable(program) {
  /** @type {Map<string, { clauses: object[], fn: object }>} */
  const functions = new Map();
  /** @type {Map<string, Map<string, { clauses: object[], fn: object }>>} */
  const methods = new Map();
  /** @type {Map<string, string[]>} */
  const methodOwners = new Map();

  function addFn(fn) {
    if (!fn || !(fn.riskMask || (fn.riskClauses && fn.riskClauses.length))) return;
    const clauses = fn.riskClauses || (fn.riskMask ? [{ kind: 'mask', mask: fn.riskMask }] : []);
    functions.set(fn.name, { clauses, fn });
  }

  for (const fn of program.functions || []) addFn(fn);
  if (program.main) addFn(program.main);

  for (const st of program.structs || []) {
    const map = new Map();
    for (const m of st.methods || []) {
      if (!(m.riskMask || (m.riskClauses && m.riskClauses.length))) continue;
      const clauses = m.riskClauses || [{ kind: 'mask', mask: m.riskMask }];
      map.set(m.name, { clauses, fn: m });
      if (!methodOwners.has(m.name)) methodOwners.set(m.name, []);
      methodOwners.get(m.name).push(st.name);
    }
    if (map.size) methods.set(st.name, map);
  }

  return { functions, methods, methodOwners };
}

/**
 * @param {object} call — Call AST node
 * @param {object} table
 * @param {string|null} currentStruct
 * @returns {{ label: string, mask: number }|null}
 */
function resolveCallRisk(call, table, currentStruct) {
  const callee = call.callee;
  if (!callee) return null;

  function entryMask(entry) {
    if (!entry) return null;
    const env = typeParamEnv(entry.fn, call.typeArgs || []);
    const mask = foldRiskClauses(entry.clauses, env);
    return mask ? { mask, entry } : { mask: 0, entry };
  }

  if (callee.type === T.Id) {
    const entry = table.functions.get(callee.name);
    if (!entry) return null;
    const { mask } = entryMask(entry);
    if (!mask) return null;
    return { label: callee.name, mask };
  }
  if (callee.type === T.Member) {
    const name = callee.member;
    if (callee.object && callee.object.type === T.Id && callee.object.name === 'self' && currentStruct) {
      const map = table.methods.get(currentStruct);
      const entry = map && map.get(name);
      if (!entry) return null;
      const { mask } = entryMask(entry);
      if (!mask) return null;
      return { label: `${currentStruct}.${name}`, mask };
    }
    const owners = table.methodOwners.get(name) || [];
    if (owners.length === 1) {
      const entry = table.methods.get(owners[0]).get(name);
      const { mask } = entryMask(entry);
      if (!mask) return null;
      return { label: `${owners[0]}.${name}`, mask };
    }
    if (owners.length > 1) {
      let mask = 0;
      for (const st of owners) {
        const entry = table.methods.get(st).get(name);
        mask |= entryMask(entry).mask;
      }
      if (!mask) return null;
      return { label: name, mask };
    }
  }
  return null;
}

/**
 * @param {object} expr
 * @param {number} scopeMask
 * @param {object} table
 * @param {string|null} currentStruct
 * @param {number} [line]
 */
function checkExpr(expr, scopeMask, table, currentStruct, line) {
  if (!expr) return;
  if (expr.type === T.Call) {
    const info = resolveCallRisk(expr, table, currentStruct);
    if (info && (scopeMask & info.mask) !== info.mask) {
      const missing = info.mask & ~scopeMask;
      const where = line != null ? ` at line ${line}` : '';
      throw new SemanticError(
        `Call to '${info.label}' requires risk(${formatRiskMask(info.mask)})` +
          `${where}; missing ${formatRiskMask(missing)} ` +
          `(enclosing scope has ${formatRiskMask(scopeMask) || 'NO_RISK'}). ` +
          `Acknowledge with risk(...): / def ... risk(...):, or pass --accept-risks`
      );
    }
    checkExpr(expr.callee, scopeMask, table, currentStruct, line);
    for (const a of expr.args || []) checkExpr(a, scopeMask, table, currentStruct, line);
    for (const a of expr.typeArgs || []) checkExpr(a, scopeMask, table, currentStruct, line);
    return;
  }
  if (expr.type === T.Binary) {
    checkExpr(expr.left, scopeMask, table, currentStruct, line);
    checkExpr(expr.right, scopeMask, table, currentStruct, line);
    return;
  }
  if (expr.type === T.Unary) {
    checkExpr(expr.arg, scopeMask, table, currentStruct, line);
    return;
  }
  if (expr.type === T.Member) {
    checkExpr(expr.object, scopeMask, table, currentStruct, line);
    return;
  }
  if (expr.type === T.Index) {
    checkExpr(expr.object, scopeMask, table, currentStruct, line);
    checkExpr(expr.index, scopeMask, table, currentStruct, line);
    return;
  }
  if (expr.type === T.ListLiteral) {
    for (const el of expr.elements || []) checkExpr(el, scopeMask, table, currentStruct, line);
    return;
  }
  if (expr.type === T.ListConstructor && expr.arg) {
    checkExpr(expr.arg, scopeMask, table, currentStruct, line);
  }
}

/**
 * @param {object} stmt
 * @param {number} scopeMask
 * @param {object} table
 * @param {string|null} currentStruct
 */
function checkStmt(stmt, scopeMask, table, currentStruct) {
  if (!stmt) return;
  if (stmt.type === T.Risk) {
    const inner = scopeMask | clausesAckMask(stmt.clauses);
    for (const s of stmt.body || []) checkStmt(s, inner, table, currentStruct);
    return;
  }
  if (stmt.type === T.VarDecl) {
    checkExpr(stmt.value, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.Assign) {
    checkExpr(stmt.target, scopeMask, table, currentStruct);
    checkExpr(stmt.value, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.Return) {
    checkExpr(stmt.value, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.ExprStatement) {
    checkExpr(stmt.expr, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.Raise) {
    checkExpr(stmt.value, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.If) {
    checkExpr(stmt.cond, scopeMask, table, currentStruct);
    for (const s of stmt.then || []) checkStmt(s, scopeMask, table, currentStruct);
    for (const branch of stmt.elifs || []) {
      checkExpr(branch.cond, scopeMask, table, currentStruct);
      for (const s of branch.body || []) checkStmt(s, scopeMask, table, currentStruct);
    }
    for (const s of stmt.else || []) checkStmt(s, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.While) {
    checkExpr(stmt.cond, scopeMask, table, currentStruct);
    for (const s of stmt.body || []) checkStmt(s, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.For) {
    checkExpr(stmt.iterable, scopeMask, table, currentStruct);
    for (const s of stmt.body || []) checkStmt(s, scopeMask, table, currentStruct);
    return;
  }
  if (stmt.type === T.TryExcept) {
    for (const s of stmt.tryBody || []) checkStmt(s, scopeMask, table, currentStruct);
    for (const s of stmt.exceptBody || []) checkStmt(s, scopeMask, table, currentStruct);
  }
}

/**
 * @param {object} program
 * @param {{ acceptRisks?: boolean }} [options]
 */
function checkRisks(program, options = {}) {
  if (options.acceptRisks) return;
  const table = buildRiskTable(program);

  for (const fn of program.functions || []) {
    const scope = fn.riskMask || clausesAckMask(fn.riskClauses) || 0;
    for (const s of fn.body || []) checkStmt(s, scope, table, null);
  }
  if (program.main) {
    const scope = program.main.riskMask || clausesAckMask(program.main.riskClauses) || 0;
    for (const s of program.main.body || []) checkStmt(s, scope, table, null);
  }
  for (const st of program.structs || []) {
    for (const m of st.methods || []) {
      const scope = m.riskMask || clausesAckMask(m.riskClauses) || 0;
      for (const s of m.body || []) checkStmt(s, scope, table, st.name);
    }
  }
}

module.exports = {
  checkRisks,
  clausesAckMask,
  foldRiskClauses,
  buildRiskTable,
  SemanticError,
};
