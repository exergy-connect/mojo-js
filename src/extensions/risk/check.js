/**
 * Compile-time risk coverage: calls to functions/methods annotated risk(A|B)
 * must occur under an enclosing risk scope that covers those bits
 * (function signature risk(...) is identical to wrapping the body in that block).
 * Skipped when options.acceptRisks is true (--accept-risks).
 */

const T = require('../../ast-types.js');
const { formatRiskMask } = require('./bits.js');

/**
 * Static mask introduced by a risk(...) block's clauses.
 * Conditionals contribute thenMask | elseMask (bits that may be acknowledged).
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
 * @param {object} program
 * @returns {{ functions: Map<string, number>, methods: Map<string, Map<string, number>>, methodOwners: Map<string, string[]> }}
 */
function buildRiskTable(program) {
  const functions = new Map();
  const methods = new Map(); // structName -> Map(methodName -> mask)
  const methodOwners = new Map(); // methodName -> [structName, ...]

  for (const fn of program.functions || []) {
    if (fn.riskMask) functions.set(fn.name, fn.riskMask);
  }
  if (program.main && program.main.riskMask) {
    functions.set(program.main.name || 'main', program.main.riskMask);
  }

  for (const st of program.structs || []) {
    const map = new Map();
    for (const m of st.methods || []) {
      if (!m.riskMask) continue;
      map.set(m.name, m.riskMask);
      if (!methodOwners.has(m.name)) methodOwners.set(m.name, []);
      methodOwners.get(m.name).push(st.name);
    }
    if (map.size) methods.set(st.name, map);
  }

  return { functions, methods, methodOwners };
}

/**
 * @param {object} callee — Call.callee expr
 * @param {{ functions: Map, methods: Map, methodOwners: Map }} table
 * @param {string|null} currentStruct
 * @returns {{ label: string, mask: number }|null}
 */
function resolveCalleeRisk(callee, table, currentStruct) {
  if (!callee) return null;
  if (callee.type === T.Id) {
    const mask = table.functions.get(callee.name);
    if (mask) return { label: callee.name, mask };
    return null;
  }
  if (callee.type === T.Member) {
    const name = callee.member;
    if (callee.object && callee.object.type === T.Id && callee.object.name === 'self' && currentStruct) {
      const map = table.methods.get(currentStruct);
      const mask = map && map.get(name);
      if (mask) return { label: `${currentStruct}.${name}`, mask };
      return null;
    }
    const owners = table.methodOwners.get(name) || [];
    if (owners.length === 1) {
      const mask = table.methods.get(owners[0]).get(name);
      return { label: `${owners[0]}.${name}`, mask };
    }
    if (owners.length > 1) {
      // Same method name on multiple structs: require union of all declared risks.
      let mask = 0;
      for (const st of owners) mask |= table.methods.get(st).get(name);
      if (mask) return { label: name, mask };
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
    const info = resolveCalleeRisk(expr.callee, table, currentStruct);
    if (info && (scopeMask & info.mask) !== info.mask) {
      const missing = info.mask & ~scopeMask;
      const where = line != null ? ` at line ${line}` : '';
      throw new Error(
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
    const scope = fn.riskMask || 0;
    for (const s of fn.body || []) checkStmt(s, scope, table, null);
  }
  if (program.main) {
    const scope = program.main.riskMask || 0;
    for (const s of program.main.body || []) checkStmt(s, scope, table, null);
  }
  for (const st of program.structs || []) {
    for (const m of st.methods || []) {
      const scope = m.riskMask || 0;
      for (const s of m.body || []) checkStmt(s, scope, table, st.name);
    }
  }
}

module.exports = { checkRisks, clausesAckMask, buildRiskTable };
