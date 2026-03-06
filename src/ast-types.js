/**
 * AST node type enum (short tags for smaller minified bundle). Parser and emitter use these.
 */
const AST = Object.freeze({
  Program: 'P',
  Struct: 'St',
  Method: 'Mt',
  Function: 'Fn',
  Return: 'Rt',
  VarDecl: 'Vd',
  If: 'If',
  While: 'Wh',
  For: 'Fr',
  Continue: 'Cn',
  Pass: 'Ps',
  Assign: 'As',
  ExprStatement: 'Ex',
  Binary: 'Bn',
  Unary: 'Un',
  Member: 'Me',
  Call: 'Cl',
  Index: 'Ix',
  None: 'Nn',
  Number: 'Nu',
  String: 'Sr',
  Bool: 'Bl',
  Id: 'Id',
  ListConstructor: 'Lc',
  List: 'Ls',
});

module.exports = AST;
