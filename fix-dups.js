const fs = require('fs');

const content = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
const lines = content.split('\n');

// Find all language blocks
const blocks = [];
let currentBlock = null;
lines.forEach((l, i) => {
  const m = l.match(/^(\s*)(en|am|om|ti):\s*\{/);
  if (m) {
    if (currentBlock) currentBlock.end = i;
    currentBlock = { key: m[2], start: i + 1, end: -1 };
    blocks.push(currentBlock);
  }
});
if (currentBlock) currentBlock.end = lines.length;

const toRemove = new Set();

blocks.forEach(block => {
  const seen = new Set();
  for (let i = block.start; i < block.end; i++) {
    const m = lines[i].match(/^\s*'([^']+)':\s/);
    if (m) {
      const key = m[1];
      if (seen.has(key)) toRemove.add(i);
      else seen.add(key);
    }
  }
});

console.log('Removing', toRemove.size, 'duplicates');
const filtered = lines.filter((_, idx) => !toRemove.has(idx));
fs.writeFileSync('src/context/SettingsContext.tsx', filtered.join('\n'), 'utf8');
