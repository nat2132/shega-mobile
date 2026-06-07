const fs = require('fs');

const content = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
const lines = content.split('\n');

// Find the English block boundaries
let enStart = -1;
let enEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('en: {')) {
    enStart = i + 1;
  }
  if (enStart !== -1 && enEnd === -1 && lines[i].includes('am: {')) {
    enEnd = i;
  }
}

console.log(`English block: lines ${enStart} to ${enEnd}`);

// Find duplicate keys within English block
const seen = new Set();
const duplicates = new Set();
for (let i = enStart; i < enEnd; i++) {
  const m = lines[i].match(/^\s*'([^']+)':\s/);
  if (m) {
    const key = m[1];
    if (seen.has(key)) {
      duplicates.add(i);
    } else {
      seen.add(key);
    }
  }
}

console.log(`Found ${duplicates.size} duplicate lines to remove`);

// Remove duplicate lines
const filtered = lines.filter((_, idx) => !duplicates.has(idx));
fs.writeFileSync('src/context/SettingsContext.tsx', filtered.join('\n'), 'utf8');
console.log('File updated successfully');
