const fs = require('fs');
let c = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
// Find ALL occurrences of a single quote inside a string value that breaks the string
// Pattern: within a 'tutorial.xxx' line, if the value contains an unescaped single quote
// We need to find: ...you're...  (where 're looks like a string terminator)
// Strategy: find tutorial.* lines and programmatically fix the value

const lines = c.split('\n');
let fixed = 0;

for (let i = 0; i < lines.length; i++) {
  const t = lines[i];
  if (!t.includes('tutorial.')) continue;
  
  // Try to parse: 'key': 'value',
  const keyMatch = t.match(/^\s*'(tutorial\.[^']+)':\s*'/);
  if (!keyMatch) continue;
  
  const afterKey = t.substring(keyMatch[0].length);
  // Find the closing "',"
  // Look for the last occurrence of "'," in the line
  const lastClose = afterKey.lastIndexOf("',");
  if (lastClose < 0) continue;
  
  const value = afterKey.substring(0, lastClose);
  
  // Escape all unescaped single quotes in the value
  let escaped = '';
  for (let j = 0; j < value.length; j++) {
    if (value[j] === "'" && (j === 0 || value[j-1] !== '\\')) {
      escaped += "\\'";
    } else {
      escaped += value[j];
    }
  }
  
  if (escaped !== value) {
    const indent = t.match(/^\s*/)[0];
    lines[i] = indent + "'" + keyMatch[1] + "': '" + escaped + "',";
    fixed++;
    console.log('Fixed line ' + (i+1));
  }
}

fs.writeFileSync('src/context/SettingsContext.tsx', lines.join('\n'));
console.log('Fixed ' + fixed + ' lines');
