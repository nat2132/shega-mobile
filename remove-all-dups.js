const fs = require('fs');

const content = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
const lines = content.split('\n');

// Find all language blocks with their range
const blocks = [];
let currentBlock = null;
lines.forEach((l, i) => {
  const m = l.match(/^(\s*)(en|am|om|ti):\s*\{/);
  if (m) {
    if (currentBlock) currentBlock.end = i;
    currentBlock = { key: m[2], start: i, end: -1 };
    blocks.push(currentBlock);
  }
});
if (currentBlock) currentBlock.end = lines.length;

const toRemove = new Set();

blocks.forEach(block => {
  const seen = new Set();
  for (let i = block.start; i < block.end; i++) {
    const km = lines[i].match(/^\s*'([^']+)':\s/);
    if (km) {
      const key = km[1];
      if (seen.has(key)) {
        toRemove.add(i);
      } else {
        seen.add(key);
      }
    }
  }
});

console.log(`Removing ${toRemove.size} duplicate lines`);

const filtered = lines.filter((_, idx) => !toRemove.has(idx));
fs.writeFileSync('src/context/SettingsContext.tsx', filtered.join('\n'), 'utf8');
console.log('Done');
