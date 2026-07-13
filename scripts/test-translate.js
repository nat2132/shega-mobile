const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(
  path.resolve(__dirname, '..', 'src/context/SettingsContext.tsx'),
  'utf8'
).replace(/\r\n/g, '\n').replace(/\r/g, '');
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
    const match = lines[i].match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (match) map[match[1]] = match[2];
  }
  return map;
}

const enMap = extractKeyValues(sections.en.start, sections.en.end);

// Build individual word-level translation dictionary from all existing translation pairs
function buildWordDict(targetMap) {
  const wordDict = {};
  for (const [key, enVal] of Object.entries(enMap)) {
    const amVal = targetMap[key];
    if (!amVal) continue;
    
    // Extract individual words from both languages
    const enWords = enVal.split(/[\s,;:.!?()—\-]+/).filter(w => w.length >= 2 && /^[a-zA-Z]/.test(w));
    const amWords = amVal.split(/[\s,;:.!?()—\-]+/).filter(w => w.length >= 1);
    
    // Build word pairs (simple alignment: same position)
    const minLen = Math.min(enWords.length, amWords.length);
    for (let i = 0; i < minLen; i++) {
      if (enWords[i].length >= 2 && !wordDict[enWords[i].toLowerCase()]) {
        wordDict[enWords[i].toLowerCase()] = amWords[i];
      }
    }
  }
  return wordDict;
}

// Also build phrase-level dictionary
function buildPhraseDict(targetMap) {
  const phrases = [];
  for (const [key, enVal] of Object.entries(enMap)) {
    const amVal = targetMap[key];
    if (!amVal) continue;
    if (enVal.length >= 3 && enVal.length < 120 && !enVal.includes('{')) {
      phrases.push({ en: enVal, am: amVal });
    }
  }
  // Sort longest first
  phrases.sort((a, b) => b.en.length - a.en.length);
  return phrases;
}

const amMap = extractKeyValues(sections.am.start, sections.am.end);
const wordDict = buildWordDict(amMap);
const phrases = buildPhraseDict(amMap);

console.log('Word dictionary entries:', Object.keys(wordDict).length);
console.log('Phrase dictionary entries:', phrases.length);

// Show sample words
const sampleWords = Object.keys(wordDict).slice(0, 30);
console.log('\nSample word mappings:');
for (const w of sampleWords) {
  console.log(`  ${w} → ${wordDict[w]}`);
}

// Now test translation using phrase + word approach
function translateText(text) {
  let result = text;
  
  // 1. Apply phrase matches (longest first)
  for (const { en, am } of phrases) {
    if (result.includes(en)) {
      result = result.replace(en, am);
    }
  }
  
  // 2. Apply word matches for remaining English words
  const words = result.split(/(\s+|[^a-zA-Z0-9\s])/);
  const translated = words.map(w => {
    // Skip whitespace and punctuation
    if (/^\s+$/.test(w) || /^[^a-zA-Z]+$/.test(w)) return w;
    // Check for known translation
    const lower = w.toLowerCase();
    if (wordDict[lower]) return wordDict[lower];
    // Capitalized version check
    if (wordDict[w]) return wordDict[w];
    return w; // keep original
  });
  
  return translated.join('');
}

// Get sample tutorial descriptions
const enTutorialLines = [];
for (let i = sections.en.start; i <= sections.en.end; i++) {
  if (lines[i].match(/^\s*'tutorial\..*?\.desc'/)) {
    const m = lines[i].match(/^\s*'[^']+':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (m) enTutorialLines.push(m[1]);
  }
}

console.log('\n--- Sample translations (Amharic) ---');
for (let t = 0; t < 5 && t < enTutorialLines.length; t++) {
  const text = enTutorialLines[t];
  const translated = translateText(text);
  console.log(`\nEN: ${text.substring(0, 120)}`);
  console.log(`AM: ${translated.substring(0, 120)}`);
}
