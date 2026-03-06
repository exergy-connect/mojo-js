#!/usr/bin/env node
/**
 * Bundle web/entry.js for browser. Output: dist/mojo-js.js (and dist/mojo-js.min.js if --minify).
 */
const esbuild = require('esbuild');
const path = require('path');

const minify = process.argv.includes('--minify');
const outDir = path.join(__dirname, minify ? 'web' : 'dist');

async function build() {
  const outFile = path.join(outDir, minify ? 'mojo-js.min.js' : 'mojo-js.js');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'web', 'entry.js')],
    bundle: true,
    platform: 'browser',
    target: ['es2020'],
    outfile: outFile,
    minify,
    sourcemap: !minify,
    format: 'iife',
  });
  console.log('Built:', outFile);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
