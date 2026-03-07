#!/usr/bin/env node
/**
 * Unit tests for the tokenizer. Run: node test/tokenizer-test.js
 */

const assert = require('assert');
const { tokenize, KEYWORDS } = require('../src/tokenizer.js');
const Tok = require('../src/token-types.js');

function tokens(source) {
  return tokenize(source).map((t) => ({ type: t.type, value: t.value }));
}

function run(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    return false;
  }
}

function main() {
  let passed = 0;
  let failed = 0;

  run('empty string', () => {
    const t = tokens('');
    assert(Array.isArray(t));
    assert(t.length >= 1);
    // Tokenizer ends with NEWLINE; parser treats end-of-array as EOF
    assert.strictEqual(t[t.length - 1].type, Tok.NEWLINE);
  }) ? passed++ : failed++;

  run('number integer', () => {
    const t = tokens('42');
    assert.strictEqual(t[0].type, Tok.NUMBER);
    assert.strictEqual(t[0].value, 42);
  }) ? passed++ : failed++;

  run('number float', () => {
    const t = tokens('3.14');
    assert.strictEqual(t[0].type, Tok.NUMBER);
    assert.strictEqual(t[0].value, 3.14);
  }) ? passed++ : failed++;

  run('string double quote', () => {
    const t = tokens('"hello"');
    assert.strictEqual(t[0].type, Tok.STRING);
    assert.strictEqual(t[0].value, 'hello');
  }) ? passed++ : failed++;

  run('string single quote', () => {
    const t = tokens("'world'");
    assert.strictEqual(t[0].type, Tok.STRING);
    assert.strictEqual(t[0].value, 'world');
  }) ? passed++ : failed++;

  run('identifier', () => {
    const t = tokens('foo');
    assert.strictEqual(t[0].type, Tok.ID);
    assert.strictEqual(t[0].value, 'foo');
  }) ? passed++ : failed++;

  run('keyword if', () => {
    const t = tokens('if');
    assert.strictEqual(t[0].type, Tok.IF);
    assert.strictEqual(t[0].value, 'if');
  }) ? passed++ : failed++;

  run('keyword def', () => {
    const t = tokens('def');
    assert.strictEqual(t[0].type, Tok.DEF);
  }) ? passed++ : failed++;

  run('operators', () => {
    const t = tokens('+ - * // % == != < <= > >=');
    assert.strictEqual(t[0].type, Tok.PLUS);
    assert.strictEqual(t[2].type, Tok.STAR);
    assert.strictEqual(t[3].type, Tok.SLASHSLASH);
    assert.strictEqual(t[5].type, Tok.EQ);
    assert.strictEqual(t[6].type, Tok.NE);
  }) ? passed++ : failed++;

  run('symbols', () => {
    const t = tokens('( ) [ ] : , . ->');
    assert.strictEqual(t[0].type, Tok.LPAREN);
    assert.strictEqual(t[1].type, Tok.RPAREN);
    assert.strictEqual(t[6].type, Tok.DOT);
    assert.strictEqual(t[7].type, Tok.RARROW);
  }) ? passed++ : failed++;

  run('indent and dedent', () => {
    const t = tokenize('def main():\n    pass\n');
    const types = t.map((x) => x.type);
    assert(types.includes(Tok.INDENT), 'has INDENT');
    assert(types.includes(Tok.DEDENT), 'has DEDENT');
    assert(types.includes(Tok.DEF));
    assert(types.includes(Tok.PASS));
  }) ? passed++ : failed++;

  run('newlines', () => {
    const t = tokenize('1\n\n2');
    const types = t.map((x) => x.type);
    assert(types.filter((x) => x === Tok.NEWLINE).length >= 1);
  }) ? passed++ : failed++;

  run('unsupported keyword raises', () => {
    assert.throws(() => tokenize('def main():\n    match'), /Unknown keyword.*match/);
  }) ? passed++ : failed++;

  run('KEYWORDS set', () => {
    assert(KEYWORDS.has('if'));
    assert(KEYWORDS.has('def'));
    assert(KEYWORDS.has('elif'));
    assert(!KEYWORDS.has('match'));
  }) ? passed++ : failed++;

  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
