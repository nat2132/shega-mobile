const fs = require('fs');
const c = fs.readFileSync('scripts/apply-translations.js', 'utf-8');
const idx = c.indexOf("Ga'aa");
if (idx >= 0) {
  console.log('Found at', idx);
  for (let i = idx; i < idx + 20; i++) {
    console.log(i, c.charCodeAt(i), c[i], '0x' + c.charCodeAt(i).toString(16));
  }
} else {
  console.log('Not found');
}
// Also find all apostrophes within Oromo strings
let count = 0;
for (let i = 0; i < c.length; i++) {
  if (c.charCodeAt(i) === 0x27 && c[i - 1] !== '\\') {
    // Check if inside an Oromo translation value
    const before = c.slice(Math.max(0, i - 30), i);
    const after = c.slice(i, i + 30);
    if (before.includes("'") && !before.includes("'):")) {
      console.log('Unescaped quote at', i, 'context:', before.slice(-20) + '|' + after.slice(0, 20));
      count++;
    }
  }
}
console.log('Total unescaped quotes in values:', count);
