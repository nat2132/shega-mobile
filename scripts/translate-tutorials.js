const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'context', 'SettingsContext.tsx');
let content = fs.readFileSync(filePath, 'utf8');
// Normalize line endings
content = content.replace(/\r\n/g, '\n').replace(/\r/g, '');
const lines = content.split('\n');
const originalEOL = '\r\n'; // Original file uses CRLF

// Helper: extract key-value pairs from a range of lines
function extractKeyValues(start, end) {
  const map = {};
  for (let i = start; i <= end; i++) {
    const match = lines[i].match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (match) {
      map[match[1]] = match[2];
    }
  }
  return map;
}

// Find section boundaries by searching for section headers and closing braces
function findSectionBoundaries() {
  const sections = {};
  const sectionOrder = ['en', 'am', 'om', 'ti'];

  let currentSection = null;
  let currentStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Check for section start
    const sectionMatch = trimmed.match(/^(en|am|om|ti):\s*\{$/);
    if (sectionMatch) {
      if (currentSection) {
        // Previous section was not properly closed
        console.warn(`Section ${currentSection} not closed before ${sectionMatch[1]} at line ${i}`);
      }
      currentSection = sectionMatch[1];
      currentStart = i;
      continue;
    }

    // Check for section end: a line that is just "}," with optional leading whitespace
    // and no other content (but not inside a value)
    if (currentSection && trimmed === '},') {
      // Verify this is not the end of the translations object (which is "};")
      if (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim();
        // If next line is another section or the closing of translations object
        if (nextTrimmed.match(/^(am|om|ti):\s*\{$/) || nextTrimmed === '};') {
          sections[currentSection] = { start: currentStart, end: i };
          currentSection = null;
          currentStart = -1;
          continue;
        }
      }
    }
  }

  // Handle last section (ti) - its next line should be "};"
  if (currentSection) {
    // Search forward for the closing '};'
    for (let i = currentStart + 1; i < lines.length; i++) {
      if (lines[i].trim() === '},' && i + 1 < lines.length && lines[i + 1].trim() === '};') {
        sections[currentSection] = { start: currentStart, end: i };
        break;
      }
    }
  }

  return sections;
}

const sections = findSectionBoundaries();
console.log('Section boundaries:', JSON.stringify(sections));

// Extract English tutorial entries
function extractTutorialKeys() {
  const entries = [];
  for (let i = sections.en.start; i <= sections.en.end; i++) {
    const match = lines[i].match(/^\s*'tutorial\.([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (match) {
      entries.push({ key: `tutorial.${match[1]}`, value: match[2] });
    }
  }
  return entries;
}

const tutorialEntries = extractTutorialKeys();
console.log(`Found ${tutorialEntries.length} tutorial entries in English section`);

// Build translation lookups
function buildTranslationLookups() {
  const enMap = extractKeyValues(sections.en.start, sections.en.end);
  const lookups = {};

  for (const lang of ['am', 'om', 'ti']) {
    const langMap = extractKeyValues(sections[lang].start, sections[lang].end);
    
    // Build reverse lookup: English value → translated value
    const reverse = {};
    for (const [key, enVal] of Object.entries(enMap)) {
      if (langMap[key] !== undefined) {
        reverse[enVal] = langMap[key];
      }
    }

    lookups[lang] = { map: langMap, reverse };
    console.log(`${lang}: ${Object.keys(langMap).length} existing keys, ${Object.keys(reverse).length} translatable phrases`);
  }
  return lookups;
}

const lookups = buildTranslationLookups();

// Translate text using the reverse lookup map
function translateText(text, reverseMap) {
  // Exact match
  if (reverseMap[text] !== undefined) {
    return reverseMap[text];
  }

  // Word-by-word replacement using known terms
  // Collect reasonable terms (not too long, not containing templates)
  const terms = {};
  for (const [en, trans] of Object.entries(reverseMap)) {
    if (en.length >= 2 && en.length < 80 && !en.includes('{') && !en.includes('}')) {
      terms[en] = trans;
    }
  }

  // Sort longest first for greedy matching
  const sorted = Object.entries(terms).sort(([a], [b]) => b.length - a.length);

  let result = text;
  for (const [en, trans] of sorted) {
    const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(?<=^|[^a-zA-Z])' + escaped + '(?=$|[^a-zA-Z])', 'g');
    if (regex.test(result)) {
      result = result.replace(regex, trans);
    }
  }

  return result;
}

// Insert translations into a language section
function insertTranslations(lang, langName) {
  const { map: langMap, reverse: reverseMap } = lookups[lang];
  const section = sections[lang];
  const insertLine = section.end;

  // Check which tutorial keys already exist
  const existingKeys = new Set(Object.keys(langMap).filter(k => k.startsWith('tutorial.')));

  const missing = tutorialEntries.filter(e => !existingKeys.has(e.key));
  console.log(`${langName}: ${missing.length} missing tutorial entries (${existingKeys.size} existing)`);

  if (missing.length === 0) return;

  // Generate translated lines
  const newLines = [];
  for (const entry of missing) {
    const translated = translateText(entry.value, reverseMap);
    newLines.push(`    '${entry.key}': '${translated.replace(/'/g, "\\'")}',`);
  }

  // Check what's just before the closing "},"
  const lineBefore = lines[insertLine - 1].trim();
  const hasCommentAbove = lines[insertLine - 1].includes('//');

  // Build insertion array
  const toInsert = [];
  if (!hasCommentAbove && lineBefore !== '') {
    toInsert.push('');
  }
  toInsert.push('    // Tutorial Definitions');
  toInsert.push(...newLines);

  // Splice in the lines
  lines.splice(insertLine, 0, ...toInsert);

  // Shift all subsequent section boundaries
  const shift = toInsert.length;
  for (const s of ['am', 'om', 'ti']) {
    if (sections[s].start > section.end) {
      sections[s].start += shift;
    }
    if (sections[s].end >= section.end) {
      sections[s].end += shift;
    }
  }

  console.log(`${langName}: Inserted ${newLines.length} entries before line ${insertLine}`);
}

// Process in order: am, om, ti
insertTranslations('am', 'Amharic');
insertTranslations('om', 'Oromo');
insertTranslations('ti', 'Tigrinya');

// Write back
fs.writeFileSync(filePath, lines.join(originalEOL), 'utf8');
console.log('\nFile written successfully!');
