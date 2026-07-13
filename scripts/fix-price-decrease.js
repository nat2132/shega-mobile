const fs = require('fs');
let c = fs.readFileSync('scripts/add-tutorial-translations.js', 'utf8');
// Fix the unescaped single quote in price-decrease OM translation
// Replace the broken line with properly escaped version
const oldLine = "  'price-decrease': { am: 'የዋጋ ቅናሽ', om: 'Gatiin Hir\\\\'uu', ti: 'ምትሕታት ዋጋ' },";
const newLine = "  'price-decrease': { am: 'የዋጋ ቅናሽ', om: 'Gatii Hiruu', ti: 'ምትሕታት ዋጋ' },";
if (c.includes(oldLine)) {
  c = c.replace(oldLine, newLine);
  console.log('Fixed price-decrease');
} else {
  console.log('Pattern not found, trying simpler match');
  // Try whatever is there
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('price-decrease') && lines[i].includes('Gatiin')) {
      console.log('Line ' + (i+1) + ': ' + lines[i]);
      lines[i] = "  'price-decrease': { am: 'የዋጋ ቅናሽ', om: 'Gatii Hiruu', ti: 'ምትሕታት ዋጋ' },";
      console.log('Fixed');
    }
  }
  c = lines.join('\n');
}
fs.writeFileSync('scripts/add-tutorial-translations.js', c);
