const fs = require('fs');
const path = require('path');

// Read the phrase-translated output and my direct translations
const translated = fs.readFileSync('src/context/SettingsContext.tsx.translated', 'utf8').replace(/\r\n/g, '\n');
const directData = JSON.parse(fs.readFileSync('scripts/translations-all.json', 'utf8'));

// Build lookup maps by English value
const amLookup = {};
const omLookup = {};
const tiLookup = {};
for (const entry of directData) {
  amLookup[entry.en] = entry.am;
  omLookup[entry.en] = entry.om;
  tiLookup[entry.en] = entry.ti;
}

console.log('Direct translations available:', directData.length);
console.log('Am lookup size:', Object.keys(amLookup).length);

// Process the file lines
const lines = translated.split('\n');

// Find sections and replace tutorial entries where we have direct translations
let currentSection = null;
let replaced = { am: 0, om: 0, ti: 0 };
let total = { am: 0, om: 0, ti: 0 };

// Build English lookup: tutorial key -> English value (from en section)
let inEn = false;
const enValues = {};
for (const line of lines) {
  if (line.trim() === 'en: {') { inEn = true; continue; }
  if (inEn && line.trim() === 'am: {') break;
  if (inEn) {
    const m = line.match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (m) enValues[m[1]] = m[2];
  }
}

console.log('English entries:', Object.keys(enValues).filter(k => k.startsWith('tutorial.')).length);

// Process each section
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  const secMatch = t.match(/^(am|om|ti):\s*\{$/);
  if (secMatch) { currentSection = secMatch[1]; continue; }
  if (t === '},') { currentSection = null; continue; }
  
  if (currentSection && ['am', 'om', 'ti'].includes(currentSection)) {
    const m = lines[i].match(/^\s*'(tutorial\.[^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (m) {
      total[currentSection]++;
      const key = m[1];
      const enVal = enValues[key];
      const lookup = currentSection === 'am' ? amLookup : currentSection === 'om' ? omLookup : tiLookup;
      
      if (enVal && lookup[enVal]) {
        // Replace with direct translation
        const escaped = lookup[enVal].replace(/'/g, "\\'");
        
        // Check if the line ends with comma
        const hadComma = lines[i].trim().endsWith(',');
        const indent = lines[i].match(/^(\s*)/)[1];
        
        lines[i] = indent + "'" + key + "': '" + escaped + "'" + (hadComma ? ',' : '');
        replaced[currentSection]++;
      }
    }
  }
}

console.log('Replaced entries:', replaced);
console.log('Total entries:', total);

// Write merged output
fs.writeFileSync('src/context/SettingsContext.tsx.merged', lines.join('\n'), 'utf8');
console.log('Written to src/context/SettingsContext.tsx.merged');
