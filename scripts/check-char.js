const fs = require('fs');
const buf = fs.readFileSync('src/context/SettingsContext.tsx');
const str = 'Ga';
const idx = buf.indexOf(str);
if (idx >= 0) {
  const slice = buf.slice(idx, idx + 20);
  console.log('Hex:', slice.toString('hex'));
  console.log('Str:', slice.toString('utf-8'));
  for (let i = 0; i < slice.length; i++) {
    console.log(i, slice[i], String.fromCodePoint(slice[i]), '0x' + slice[i].toString(16));
  }
}
