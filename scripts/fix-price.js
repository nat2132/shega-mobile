const fs = require('fs');
let c = fs.readFileSync('scripts/add-tutorial-translations.js', 'utf8');
c = c.replace("'Gatiin Hir\\'uu'", "'Gatiin Hiruu'");
fs.writeFileSync('scripts/add-tutorial-translations.js', c);
console.log('Fixed');
