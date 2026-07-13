const fs = require('fs');
let c = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
// Fix double-escaped quotes (\\'re -> 're, but keep properly escaped \')
// Find patterns like you\\'re, don\\'t, can\\'t etc. that have double escape
c = c.replace(/n\\'(?!,|\\n|$)/g, "n'");  // This won't work in general
// Instead, find any \\' sequence inside a string value and fix it
// \\' in the file means the string has \' which should just be '
c = c.replace(/([a-zA-Z])\\([0-9])/g, '$1\\\\$2');
c = c.replace(/\\([a-zA-Z])/g, '$1');
fs.writeFileSync('src/context/SettingsContext.tsx', c);
console.log('done');
