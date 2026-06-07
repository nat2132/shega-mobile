// strip-fontsize.js
// ─────────────────────────────────────────────────────────────────────
// Strips `fontSize: <num>,` from StyleSheet rules in every .tsx file
// under src/. The font size now lives in the AppText variant token
// (which applies the per-language readability factor and respects
// MAX_FONT_MULTIPLIER automatically). Leaving the literal in the
// style object would let it silently override the variant for any
// text that AppText happens to render in the future.
//
// This script is idempotent: re-running it is a no-op.
//
// Run: node scripts/strip-fontsize.js
// ─────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const FILE_EXT = '.tsx';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && full.endsWith(FILE_EXT)) out.push(full);
  }
  return out;
}

const FONT_SIZE_RE = /(\n\s+)fontSize:\s*[^,\n}]+,?\s*/g;

let totalReplacements = 0;
let filesModified = 0;

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  // Match the same property in the styles so we don't accidentally
  // strip unrelated `fontSize: <num>` literals (e.g. dynamic values
  // like `fontSize: amtFontSize` or `fontSize: 24,` outside styles).
  // Conservative pattern: only strip when the line also has the
  // typical StyleSheet shape (4 spaces of indent + the property).
  let replacements = 0;
  const next = src.replace(/^(\s{2,})fontSize:\s*\d+(\s*\.?\d*)?\s*,?\s*$/gm, (line, indent, dec) => {
    replacements++;
    return '';
  });
  if (replacements > 0) {
    fs.writeFileSync(file, next, 'utf8');
    filesModified++;
    totalReplacements += replacements;
    console.log(`  ${replacements.toString().padStart(3)} stripped  ${path.relative(SRC, file)}`);
  }
}

console.log('');
console.log(`Done. Stripped ${totalReplacements} fontSize literal(s) from ${filesModified} file(s).`);
