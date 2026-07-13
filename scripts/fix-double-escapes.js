const fs = require('fs');
let c = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
// Fix double-escaped sequences (\\' -> \')
// In the added AM/OM/TI sections, find all lines where \\' appears inside a string value
// and change them to \'
c = c.replace(/\\\\'/g, "\\'");
fs.writeFileSync('src/context/SettingsContext.tsx', c);
console.log('Fixed');
