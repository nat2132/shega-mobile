const fs = require('fs');
const buf = fs.readFileSync('src/context/SettingsContext.tsx');
// Find the om section and look for Ga'aa
const text = buf.toString('utf-8');
const omStart = text.indexOf('  om: {');
const omSection = text.slice(omStart, omStart + 5000);
const lines = omSection.split('\n');
for (const line of lines) {
  if (line.includes("Ga")) {
    const idx = line.indexOf("Ga");
    console.log('Found Ga:', line.slice(Math.max(0, idx-3), idx+10));
    for (let i = Math.max(0, idx-3); i < Math.min(line.length, idx+10); i++) {
      console.log(i, line.charCodeAt(i), line[i], '0x' + line.charCodeAt(i).toString(16));
    }
    console.log('---');
  }
}
