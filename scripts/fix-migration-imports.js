// fix-migration-imports.js
//
// Repairs files where the AppText migration script injected
// `import { AppText } from '@/components/ui';` in the middle of a
// multi-line import block.
//
// Run from the shega-mobile project root:
//
//   node scripts/fix-migration-imports.js
//
// Idempotent: running it on an already-fixed file is a no-op.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, out);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

let changed = 0;
const files = walk(src);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // 1) Strip any incorrectly-placed AppText import line.
  //    Matches a line whose contents are *exactly* the AppText
  //    import statement, allowing leading whitespace.
  const stripped = content.replace(
    /^[ \t]*import \{ AppText \} from ['"]@\/components\/ui['"];?\s*$\n?/gm,
    '',
  );
  content = stripped;

  // 2) Only re-insert the AppText import if the file actually uses
  //    <AppText ...> JSX. Otherwise leave it alone (the import was
  //    correctly absent before the migration).
  if (!/<AppText(?=[\s>\/])/.test(content)) {
    if (content === original) continue;
    fs.writeFileSync(file, content, 'utf8');
    changed++;
    continue;
  }

  // 3) Find every multi-line import block. We define a block as
  //    starting at a line `import {` and ending at the next
  //    `} from '...';` line. We capture the trailing newline so
  //    re-insertion lines up.
  const importBlockRe = /^[ \t]*import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\s*$\n?/gm;
  const matches = [...content.matchAll(importBlockRe)];

  if (matches.length === 0) {
    // No multi-line imports — nothing to do. (Single-line imports
    // were handled correctly by the original migration script.)
    if (content === original) continue;
    fs.writeFileSync(file, content, 'utf8');
    changed++;
    continue;
  }

  const last = matches[matches.length - 1];
  // Determine the leading whitespace from the FIRST import block so
  // our new line matches the rest of the file's indentation style.
  const first = matches[0];
  const lineStart = content.lastIndexOf('\n', first.index) + 1;
  const indent = content.slice(lineStart, first.index);

  const injection = `${indent}import { AppText } from '@/components/ui';\n`;
  const insertAt = last.index + last[0].length;
  content = content.slice(0, insertAt) + injection + content.slice(insertAt);

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
    console.log(`  fixed: ${path.relative(root, file)}`);
  }
}

console.log(`\nImport fix complete. Files updated: ${changed}`);
