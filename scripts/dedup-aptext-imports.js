// dedup-aptext-imports.js
//
// The fix-migration-imports.js script re-injected
// `import { AppText } from '@/components/ui';` into files that
// already export their own AppText / AppButton / AppListItem /
// AppRow component (because those files *are* the implementation).
// This script removes the duplicate import.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');

const localDefinitions = new Set([
  'src/components/AppText.tsx',
  'src/components/AppButton.tsx',
  'src/components/AppListItem.tsx',
  'src/components/AppRow.tsx',
  'src/constants/typography.ts',
  // ui.ts is the barrel itself; importing AppText from it would
  // create a circular import.
  'src/components/ui.ts',
]);

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
for (const file of walk(src)) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (!localDefinitions.has(rel)) continue;

  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Remove the `import { AppText } from '@/components/ui';` line.
  content = content.replace(
    /^[ \t]*import \{ AppText \} from ['"]@\/components\/ui['"];?\s*$\n?/gm,
    '',
  );

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
    console.log(`  dedup: ${rel}`);
  }
}

console.log(`\nDedup complete. Files updated: ${changed}`);
