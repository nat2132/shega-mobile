const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'src/context/SettingsContext.tsx');
let content = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const lines = content.split('\n');

// Find section boundaries
const sections = {};
let currentSection = null;
let currentStart = -1;

for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  const sectionMatch = trimmed.match(/^(en|am|om|ti):\s*\{$/);
  if (sectionMatch) {
    if (currentSection) {
      for (let j = currentStart + 1; j < lines.length; j++) {
        if (lines[j].trim() === '},') {
          const next = (j + 1 < lines.length) ? lines[j + 1].trim() : '';
          if (next.match(/^(am|om|ti):\s*\{$/) || next === '};') {
            sections[currentSection] = { start: currentStart, end: j };
            break;
          }
        }
      }
    }
    currentSection = sectionMatch[1];
    currentStart = i;
  }
}
if (currentSection) {
  for (let j = currentStart + 1; j < lines.length; j++) {
    if (lines[j].trim() === '},' && j + 1 < lines.length && lines[j + 1].trim() === '};') {
      sections[currentSection] = { start: currentStart, end: j };
      break;
    }
  }
}

function extractKeyValues(start, end) {
  const map = {};
  for (let i = start; i <= end; i++) {
    const m = lines[i].match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

const enMap = extractKeyValues(sections.en.start, sections.en.end);

// Build translation memory: for each language, create a map of EN phrase -> translation
function buildTranslationMemory(targetMap) {
  const phrases = [];
  for (const [key, enVal] of Object.entries(enMap)) {
    const tVal = targetMap[key];
    if (!tVal) continue;
    if (enVal.length >= 2 && !enVal.includes('{') && !tVal.includes('{')) {
      phrases.push({ en: enVal, t: tVal, len: enVal.length });
    }
  }
  // Sort by length descending (longest match first)
  phrases.sort((a, b) => b.len - a.len);
  return phrases;
}

// Translate text using longest-phrase matching
function translateText(text, memory) {
  let result = text;
  let applied = new Set(); // track which phrases we've applied to avoid overlapping
  
  for (const { en, t } of memory) {
    // Find all occurrences of this phrase
    let idx = 0;
    while (true) {
      idx = result.indexOf(en, idx);
      if (idx === -1) break;
      
      // Check if this position is already partially translated
      let overlap = false;
      for (const appliedIdx of applied) {
        if ((idx >= appliedIdx && idx < appliedIdx + en.length) ||
            (appliedIdx >= idx && appliedIdx < idx + en.length)) {
          overlap = true;
          break;
        }
      }
      
      if (!overlap) {
        result = result.substring(0, idx) + t + result.substring(idx + en.length);
        applied.add(idx);
        idx += t.length;
      } else {
        idx += en.length;
      }
    }
  }
  
  return result;
}

// Extract tutorial keys from EN section
const enTutorialEntries = [];
for (let i = sections.en.start; i <= sections.en.end; i++) {
  const m = lines[i].match(/^\s*'(tutorial\.[^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
  if (m && m[1].startsWith('tutorial.')) {
    enTutorialEntries.push({ key: m[1], value: m[2], line: i });
  }
}

console.log('English tutorial entries:', enTutorialEntries.length);

// Process each language
const langs = ['am', 'om', 'ti'];
for (const lang of langs) {
  console.log('\nProcessing ' + lang + '...');
  const section = sections[lang];
  if (!section) { console.log('Section ' + lang + ' not found!'); continue; }
  
  const targetMap = extractKeyValues(section.start, section.end);
  const memory = buildTranslationMemory(targetMap);
  console.log('  Translation memory size:', memory.length);
  
  // Check if section already has tutorial entries
  let existingTutorialKeys = new Set();
  let insertIndex = section.end; // Insert before closing brace
  
  for (let i = section.start; i <= section.end; i++) {
    const m = lines[i].match(/^\s*'(tutorial\.[^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (m) {
      existingTutorialKeys.add(m[1]);
    }
    if (i < section.end && lines[i].trim() !== '},') {
      // Find insertion point for new entries
      insertIndex = i + 1;
    }
  }
  
  console.log('  Existing tutorial keys:', existingTutorialKeys.size);
  
  // Generate new entries for keys that don't exist yet
  let newEntries = [];
  let translatedCount = 0;
  
  for (const { key, value } of enTutorialEntries) {
    if (!existingTutorialKeys.has(key)) {
      const translated = translateText(value, memory);
      if (translated !== value) translatedCount++;
      
      // Escape single quotes for JS
      const escaped = translated.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      newEntries.push({ key, value: escaped });
    }
  }
  
  console.log('  New entries to add:', newEntries.length);
  console.log('  Entries with some translation:', translatedCount);
  
  // Insert new entries before the closing brace
  if (newEntries.length > 0) {
    // Find the closing '},' line
    const closeBraceLine = section.end;
    const indent = lines[section.start + 1].match(/^\s*/)[0]; // get indentation
    
    // Build insertion content
    const insertLines = newEntries.map(e => indent + "'" + e.key + "': '" + e.value + "',");
    
    // Insert before the closing brace
    const before = lines.slice(0, closeBraceLine);
    const after = lines.slice(closeBraceLine);
    lines.splice(closeBraceLine, 0, ...insertLines);
    
    // Update all section boundaries since we inserted lines
    const insertCount = insertLines.length;
    for (const [s, bounds] of Object.entries(sections)) {
      if (bounds.start >= closeBraceLine) bounds.start += insertCount;
      if (bounds.end >= closeBraceLine) bounds.end += insertCount;
    }
  }
}

// Write output
const output = lines.join('\n');
fs.writeFileSync(FILE + '.translated', output, 'utf8');
console.log('\nOutput written to ' + FILE + '.translated');
console.log('File size:', output.length, 'bytes');
