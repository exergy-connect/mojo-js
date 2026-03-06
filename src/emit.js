/**
 * Emit JavaScript from Mojo AST. Supports simple Mojo subset (structs, fn, def, control flow, List, range, etc.).
 */

const T = require('./ast-types.js');

function emitProgram(program, runtimeVar = '__runtime') {
  const out = [];
  const structNames = new Set(program.structs.map((s) => s.name));

  const inner = '    ';
  out.push(`(function(${runtimeVar}) {`);
  out.push(`  const { argv, atol, print, range, rangeFromTo, len } = ${runtimeVar};`);
  out.push(`  return function(__argv) {`);
  out.push('');

  for (const s of program.structs) {
    emitStruct(s, out, structNames, inner);
  }

  for (const fn of program.functions) {
    emitFunction(fn, out, structNames, inner);
  }

  const mainFn = program.main || program.functions.find((f) => f.name === 'main');
  if (mainFn) {
    out.push(`${inner}function main() {`);
    for (const stmt of mainFn.body) {
      emitStatement(stmt, out, structNames, 6);
    }
    out.push(`${inner}}`);
    out.push(`${inner}main();`);
  } else {
    out.push(`${inner}console.log("No main() defined");`);
  }
  out.push('  };');
  out.push('})');

  return out.join('\n');
}

function emitStruct(struct, out, structNames, baseIndent) {
  const ind = baseIndent || '  ';
  const name = struct.name;
  const inits = struct.methods.filter((m) => m.name === '__init__');
  const initWithParams = inits.find((m) => {
    const p = m.params.filter((x) => x.name !== 'self' && x.name !== 'copy' && x.name !== 'take');
    return p.length > 0 && !m.params.some((x) => x.name === 'take');
  });
  const copyInit = struct.methods.find((m) => m.name === '__copyinit__');

  out.push(`${ind}function ${name}(...args) {`);
  out.push(`${ind}  const self = {};`);
  if (initWithParams) {
    const params = initWithParams.params.filter((p) => p.name !== 'self' && p.name !== 'copy' && p.name !== 'take');
    for (let i = 0; i < params.length; i++) {
      out.push(`${ind}  let ${params[i].name} = args[${i}];`);
    }
    for (const stmt of initWithParams.body) {
      emitStatementForSelf(stmt, out, structNames, 'self', ind.length + 2);
    }
  }
  if (copyInit) {
    out.push(`${ind}  self.copy = function() { return ${name}_copy(self); };`);
  }
  out.push(`${ind}  return self;`);
  out.push(`${ind}}`);
  if (copyInit) {
    out.push(`${ind}function ${name}_copy(o) { return {`);
    for (const f of struct.fields) {
      if (f.type && f.type.kind === T.List) {
        out.push(`${ind}  ${f.name}: (o.${f.name} && o.${f.name}.slice) ? o.${f.name}.slice() : [...(o.${f.name} || [])],`);
      } else {
        out.push(`${ind}  ${f.name}: o.${f.name},`);
      }
    }
    out.push(`${ind}}; }`);
  }
  out.push('');
}

function emitStatementForSelf(stmt, out, structNames, selfVar, indent) {
  const i = ' '.repeat(indent);
  if (!stmt) return;
  if (stmt.type === T.VarDecl) {
    const rhs = stmt.value !== null ? emitExpr(stmt.value, structNames, selfVar) : 'undefined';
    out.push(`${i}let ${stmt.name} = ${rhs};`);
    return;
  }
  if (stmt.type === T.Assign) {
    const left = emitExpr(stmt.target, structNames, selfVar);
    const right = emitExpr(stmt.value, structNames, selfVar);
    if (stmt.compoundOp === '+=') {
      out.push(`${i}${left} = ${left} + ${right};`);
    } else {
      out.push(`${i}${left} = ${right};`);
    }
    return;
  }
  if (stmt.type === T.Return) return;
  if (stmt.type === T.ExprStatement) {
    const e = stmt.expr;
    if (e.type === T.Member && e.object.type === T.Id && e.object.name === 'self') {
      const right = e.member;
      out.push(`${i}${selfVar}.${right};`);
      return;
    }
    if (e.type === T.Call && e.callee.type === T.Member) {
      const obj = e.callee.object;
      const member = e.callee.member;
      const args = e.args.map((a) => emitExpr(a, structNames, selfVar));
      if (member === 'append') {
        const base = obj.type === T.Id && obj.name === 'self' ? selfVar : emitExpr(obj, structNames, selfVar);
        out.push(`${i}${base}.push(${args[0]});`);
        return;
      }
    }
    out.push(`${i}${emitExpr(e, structNames, selfVar)};`);
  }
}

function emitFunction(fn, out, structNames, baseIndent) {
  const ind = baseIndent || '  ';
  const name = fn.name;
  const params = fn.params.map((p) => p.name).filter((n) => n !== 'self');
  out.push(`${ind}function ${name}(${params.join(', ')}) {`);
  for (const stmt of fn.body) {
    emitStatement(stmt, out, structNames, ind.length + 2);
  }
  out.push(`${ind}}`);
  out.push('');
}

function emitStatement(stmt, out, structNames, indent) {
  const i = ' '.repeat(indent);
  if (!stmt) return;
  if (stmt.type === T.VarDecl) {
    const rhs = stmt.value !== null ? emitExpr(stmt.value, structNames) : 'undefined';
    out.push(`${i}let ${stmt.name} = ${rhs};`);
    return;
  }
  if (stmt.type === T.Assign) {
    const left = emitExpr(stmt.target, structNames);
    const right = emitExpr(stmt.value, structNames);
    if (stmt.compoundOp === '+=') {
      out.push(`${i}${left} = ${left} + ${right};`);
    } else {
      out.push(`${i}${left} = ${right};`);
    }
    return;
  }
  if (stmt.type === T.Return) {
    out.push(stmt.value ? `${i}return ${emitExpr(stmt.value, structNames)};` : `${i}return;`);
    return;
  }
  if (stmt.type === T.If) {
    out.push(`${i}if (${emitExpr(stmt.cond, structNames)}) {`);
    for (const s of stmt.then) emitStatement(s, out, structNames, indent + 2);
    out.push(`${i}}`);
    if (stmt.else && stmt.else.length > 0) {
      out.push(`${i}else {`);
      for (const s of stmt.else) emitStatement(s, out, structNames, indent + 2);
      out.push(`${i}}`);
    }
    return;
  }
  if (stmt.type === T.While) {
    out.push(`${i}while (${emitExpr(stmt.cond, structNames)}) {`);
    for (const s of stmt.body) emitStatement(s, out, structNames, indent + 2);
    out.push(`${i}}`);
    return;
  }
  if (stmt.type === T.For) {
    const it = stmt.loopVar === '_' ? '__' : stmt.loopVar;
    const iter = emitExpr(stmt.iterable, structNames);
    out.push(`${i}for (const ${it} of ${iter}) {`);
    for (const s of stmt.body) emitStatement(s, out, structNames, indent + 2);
    out.push(`${i}}`);
    return;
  }
  if (stmt.type === T.Continue) {
    out.push(`${i}continue;`);
    return;
  }
  if (stmt.type === T.Pass) return;
  if (stmt.type === T.ExprStatement) {
    const e = stmt.expr;
    if (e.type === T.Call && e.callee.type === T.Member && e.callee.object.type === T.Id) {
      const obj = e.callee.object.name;
      const member = e.callee.member;
      if (member === 'append' && e.args.length === 1) {
        out.push(`${i}${obj}.push(${emitExpr(e.args[0], structNames)});`);
        return;
      }
    }
    if (e.type === T.Member && e.object.type === T.Id && e.member) {
      const left = emitExpr(e, structNames);
      out.push(`${i}${left};`);
      return;
    }
    out.push(`${i}${emitExpr(e, structNames)};`);
  }
}

function emitExpr(e, structNames, selfVar) {
  if (!e) return '';
  if (e.type === T.Number) return String(e.value);
  if (e.type === T.String) return JSON.stringify(e.value);
  if (e.type === T.Bool) return e.value ? 'true' : 'false';
  if (e.type === T.None) return 'undefined';
  if (e.type === T.Id) return e.name === 'self' && selfVar ? selfVar : e.name;
  if (e.type === T.Binary) {
    const left = emitExpr(e.left, structNames, selfVar);
    const right = emitExpr(e.right, structNames, selfVar);
    if (e.op === 'and') return `(${left} && ${right})`;
    if (e.op === 'or') return `(${left} || ${right})`;
    if (e.op === '//') return `Math.floor(${left} / ${right})`;
    const jsOp = { lt: '<', le: '<=', gt: '>', ge: '>=', eq: '===', ne: '!==' }[e.op] || e.op;
    return `(${left} ${jsOp} ${right})`;
  }
  if (e.type === T.Unary) {
    if (e.op === 'not') return `(!${emitExpr(e.arg, structNames, selfVar)})`;
    if (e.op === '-') return `(-${emitExpr(e.arg, structNames, selfVar)})`;
    return `(${e.op}${emitExpr(e.arg, structNames, selfVar)})`;
  }
  if (e.type === T.Member) {
    const obj = emitExpr(e.object, structNames, selfVar);
    return `${obj}.${e.member}`;
  }
  if (e.type === T.Call) {
    const callee = e.callee;
    const args = e.args.map((a) => emitExpr(a, structNames, selfVar));
    if (callee.type === T.Id) {
      if (callee.name === 'range') {
        if (args.length === 1) return `range(${args[0]})`;
        if (args.length === 2) return `rangeFromTo(${args[0]}, ${args[1]})`;
      }
      if (callee.name === 'len') return `len(${args[0]})`;
      if (callee.name === 'argv') return 'argv(__argv)';
      if (callee.name === 'atol') return `atol(${args[0]})`;
      if (callee.name === 'print') return `print(...[${args.join(', ')}])`;
      if (structNames.has(callee.name)) {
        return `${callee.name}(...([${args.join(', ')}]))`;
      }
    }
    if (callee.type === T.Member) {
      const obj = emitExpr(callee.object, structNames, selfVar);
      const member = callee.member;
      if (member === 'append') return `${obj}.push(${args[0]})`;
      if (member === 'copy') return `(${obj}.copy ? ${obj}.copy() : (Array.isArray(${obj}) ? ${obj}.slice() : (typeof ${obj} === 'object' && ${obj} !== null ? { ...${obj} } : ${obj})))`;
    }
    const fn = emitExpr(callee, structNames);
    return `${fn}(${args.join(', ')})`;
  }
  if (e.type === T.Index) {
    const obj = emitExpr(e.object, structNames, selfVar);
    const index = emitExpr(e.index, structNames, selfVar);
    return `${obj}[${index}]`;
  }
  if (e.type === T.ListConstructor) {
    if (e.arg) return `(${emitExpr(e.arg, structNames, selfVar)}).slice()`;
    return '[]';
  }
  return '';
}

module.exports = { emitProgram, emitExpr, emitStatement };
