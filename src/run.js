#!/usr/bin/env node
/**
 * Minimal Mojo interpreter: read a .mojo file, transpile to JS, run it.
 * Usage: node run.js [options] <file.mojo> [args...]
 * Options:
 *   -p, --print            Print emitted JavaScript to stdout instead of running.
 *   --feature <name>       Enable an experimental language feature (repeatable).
 *   --accept-risks         Skip compile-time risk coverage checks (risk feature).
 * Example: node run.js ../mojo/ivi_standalone.mojo 3127
 * Example: node run.js --feature risk --print example.mojo
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('./parser.js');
const { emitProgram } = require('./emit.js');
const runtime = require('./runtime.js');

function main() {
  const argv = process.argv.slice(2);
  let printJs = false;
  let acceptRisks = false;
  const features = [];
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-p' || argv[i] === '--print') {
      printJs = true;
    } else if (argv[i] === '--accept-risks') {
      acceptRisks = true;
    } else if (argv[i] === '--feature') {
      if (i + 1 >= argv.length) {
        console.error('Error: --feature requires a name');
        process.exit(1);
      }
      features.push(argv[++i]);
    } else {
      rest.push(argv[i]);
    }
  }
  if (rest.length === 0) {
    console.error(
      'Usage: node run.js [-p|--print] [--feature <name>]... [--accept-risks] <file.mojo> [args...]'
    );
    process.exit(1);
  }
  const filePath = path.resolve(rest[0]);
  const mojoArgs = [filePath, ...rest.slice(1)];
  const options = { features, acceptRisks };

  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error('Error reading file:', e.message);
    process.exit(1);
  }

  let program;
  try {
    program = parse(source, options);
  } catch (e) {
    const label = e.name === 'SemanticError' ? 'Semantic error' : 'Parse error';
    console.error(`${label}:`, e.message);
    process.exit(1);
  }

  let jsCode;
  try {
    jsCode = emitProgram(program, '__runtime', options);
  } catch (e) {
    console.error('Emit error:', e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  }

  if (printJs) {
    console.log(jsCode);
    return;
  }

  const compiled = eval(jsCode);
  const mainFn = compiled(runtime);
  try {
    mainFn(mojoArgs);
  } catch (e) {
    console.error('Runtime error:', e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  }
}

main();
