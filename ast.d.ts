/**
 * Minimal AST definition for the Mojo subset used by ivi_standalone.mojo.
 * Matches the structures produced by parser.js.
 */

// ---------------------------------------------------------------------------
// Program & top-level
// ---------------------------------------------------------------------------

export interface Program {
  type: 'Program';
  structs: Struct[];
  functions: Function[];
  main: Function | null;
}

export interface Struct {
  type: 'Struct';
  name: string;
  traits: string[];
  fields: StructField[];
  methods: Method[];
}

export interface StructField {
  name: string;
  type: Type | null;
}

export interface Method {
  type: 'Method';
  name: string;
  params: Param[];
  returnType: Type | null;
  body: Statement[];
}

export interface Function {
  type: 'Function';
  name: string;
  params: Param[];
  returnType: Type | null;
  body: Statement[];
  isDef: boolean;
  raises?: boolean;
}

export interface Param {
  name: string;
  type: Type | null;
}

// ---------------------------------------------------------------------------
// Types (used in params, fields, var decls)
// ---------------------------------------------------------------------------

export type Type =
  | { kind: 'List'; inner: Type }
  | { kind: 'Id'; name: string }
  | { kind: 'None' };

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export type Statement =
  | VarDecl
  | If
  | While
  | For
  | Return
  | Assign
  | Raise
  | TryExcept
  | ExprStatement
  | Continue
  | Pass;

export interface Raise {
  type: 'Raise';
  value: Expression;
}

export interface TryExcept {
  type: 'TryExcept';
  tryBody: Statement[];
  exceptVar: string | null;
  exceptBody: Statement[];
}

export interface VarDecl {
  type: 'VarDecl';
  name: string;
  valueType: Type | null;
  value: Expression | null;
}

export interface IfElifBranch {
  cond: Expression;
  body: Statement[];
}

export interface If {
  type: 'If';
  cond: Expression;
  then: Statement[];
  elifs: IfElifBranch[];
  else: Statement[];
}

export interface While {
  type: 'While';
  cond: Expression;
  body: Statement[];
}

export interface For {
  type: 'For';
  loopVar: string;
  iterable: Expression;
  body: Statement[];
}

export interface Return {
  type: 'Return';
  value: Expression | null;
}

export interface Assign {
  type: 'Assign';
  target: Expression;
  value: Expression;
}

export interface ExprStatement {
  type: 'ExprStatement';
  expr: Expression;
}

export interface Continue {
  type: 'Continue';
}

export interface Pass {
  type: 'Pass';
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

export type Expression =
  | Binary
  | Unary
  | Call
  | Member
  | Index
  | Id
  | Number
  | String
  | Bool
  | None
  | ListConstructor;

export interface Binary {
  type: 'Binary';
  op: string;  // 'or' | 'and' | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | '+' | '-' | '*' | '//' | '%'
  left: Expression;
  right: Expression;
}

export interface Unary {
  type: 'Unary';
  op: 'not' | '-';
  arg: Expression;
}

export interface Call {
  type: 'Call';
  callee: Expression;
  args: Expression[];
}

export interface Member {
  type: 'Member';
  object: Expression;
  member: string;
}

export interface Index {
  type: 'Index';
  object: Expression;
  index: Expression;
}

export interface Id {
  type: 'Id';
  name: string;
}

export interface Number {
  type: 'Number';
  value: number;
}

export interface String {
  type: 'String';
  value: string;
}

export interface Bool {
  type: 'Bool';
  value: boolean;
}

export interface None {
  type: 'None';
}

export interface ListConstructor {
  type: 'ListConstructor';
  inner: Type;
  arg: Expression | null;
}
