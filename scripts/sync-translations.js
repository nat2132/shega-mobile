const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'src/context/SettingsContext.tsx');
const TUTORIAL_DIR = path.resolve(__dirname, '..', 'src/tutorials/definitions');

// ---- helpers ----

function parseSection(allLines, start, end) {
  const map = {};
  for (let i = start; i < end; i++) {
    const m = allLines[i].match(/^\s+'([^']+)':\s*'((?:[^'\\]|\\.)*)',\s*$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

function isThemeBaseKey(k) {
  return /^theme\.(light|dark|midnight|emerald|charcoal|slate|cocoa)$/.test(k);
}

const commonAllowed = new Set(['app_name', 'd', 's', 'paid', 'order', 'debt', 'cancelled', 'percent']);
function isCommonAllowed(k) {
  return commonAllowed.has(k.slice('common.'.length));
}

/** Check if a key is in scope (the groups we want to sync) */
function isKeyInScope(k) {
  const supportedGroups = ['subscription.', 'dialog.', 'toast.', 'language.', 'snooze.', 'screen.'];
  if (supportedGroups.some(p => k.startsWith(p))) return true;
  if (k.startsWith('theme.') && isThemeBaseKey(k)) return true;
  if (k.startsWith('common.') && isCommonAllowed(k)) return true;
  return false;
}

/** Rebuild section lines preserving comments/blanks, inserting missing keys in alpha order */
function rebuildSection(allLines, start, end, updatedMap) {
  const keys = Object.keys(updatedMap).sort();
  const originalKeys = [];
  for (let i = start; i < end; i++) {
    const m = allLines[i].match(/^\s+'([^']+)':/);
    if (m) originalKeys.push(m[1]);
  }
  const originalSet = new Set(originalKeys);
  const allSorted = keys;

  // We'll rebuild by walking through original lines and inserting missing keys
  const result = [];
  let insertIdx = 0;
  let missingIdx = 0;
  const missingKeys = allSorted.filter(k => !originalSet.has(k));

  for (let i = start; i < end; i++) {
    const line = allLines[i];
    const isKey = /^\s+'[^']+':/.test(line);

    if (!isKey) {
      result.push(line);
    } else {
      const m = line.match(/^\s+'([^']+)':/);
      if (m) {
        const currentKey = m[1];
        // Insert any missing keys that come before this one
        while (missingIdx < missingKeys.length && missingKeys[missingIdx] < currentKey) {
          const mk = missingKeys[missingIdx];
          result.push(`    '${mk}': '${updatedMap[mk]}',`);
          missingIdx++;
        }
        if (currentKey in updatedMap) {
          result.push(`    '${currentKey}': '${updatedMap[currentKey]}',`);
        }
        // else: key was deleted (e.g. renamed) - skip the line
      } else {
        result.push(line);
      }
    }
  }

  // remaining missing keys
  while (missingIdx < missingKeys.length) {
    const mk = missingKeys[missingIdx];
    result.push(`    '${mk}': '${updatedMap[mk]}',`);
    missingIdx++;
  }

  return result;
}

// ---- main ----

const content = fs.readFileSync(FILE, 'utf-8');
const allLines = content.split('\n');

// locate lang section start/end by finding `  xx: {` and corresponding `  },` / `};`
const langOrder = ['en', 'am', 'om', 'ti'];
const secStarts = {};
for (let i = 0; i < allLines.length; i++) {
  const m = allLines[i].match(/^\s+(en|am|om|ti):\s*\{\s*$/);
  if (m) secStarts[m[1]] = i;
}

// Find section ends: am/om/ti end with `  },` then the object closes with `};` after ti
// en: am line - 1 => line with `},`
// am: om line - 1 => line with `},`
// om: ti line - 1 => line with `},`
// ti: find the next `},` then the `};` below

const sections = {};
sections.en = { start: secStarts.en + 1, end: secStarts.am - 1 };
sections.am = { start: secStarts.am + 1, end: secStarts.om - 1 };
sections.om = { start: secStarts.om + 1, end: secStarts.ti - 1 };

// find ti end
let tiEnd = -1;
for (let j = secStarts.ti + 1; j < allLines.length; j++) {
  const t = allLines[j].trim();
  if (t === '},') {
    // This closes the ti section. The next `};` closes translations object.
    tiEnd = j;
    break;
  }
}
sections.ti = { start: secStarts.ti + 1, end: tiEnd };

console.log(`en: ${sections.en.start}-${sections.en.end}`);
console.log(`am: ${sections.am.start}-${sections.am.end}`);
console.log(`om: ${sections.om.start}-${sections.om.end}`);
console.log(`ti: ${sections.ti.start}-${sections.ti.end}`);

// Parse English keys
const enMap = parseSection(allLines, sections.en.start, sections.en.end);

console.log(`English keys in file: ${Object.keys(enMap).length}`);
const enScopeKeys = Object.keys(enMap).filter(isKeyInScope);
console.log(`English keys in scope: ${enScopeKeys.length}`);

// ---- STEP 1: Add missing keys to am/om/ti ----
const stats = { am: { added: [] }, om: { added: [] }, ti: { added: [] } };

// Pre-check how many are missing before modifying
for (const lang of ['am', 'om', 'ti']) {
  const langMap = parseSection(allLines, sections[lang].start, sections[lang].end);
  const present = new Set(Object.keys(langMap));
  const missing = enScopeKeys.filter(k => !present.has(k));
  console.log(`Missing in ${lang}: ${missing.length}`);
  if (missing.length > 0) {
    console.log(`  First 3: ${missing.slice(0, 3).join(', ')}`);
  }
}

for (const lang of ['am', 'om', 'ti']) {
  const langMap = parseSection(allLines, sections[lang].start, sections[lang].end);
  const added = [];
  for (const key of enScopeKeys) {
    if (!(key in langMap)) {
      langMap[key] = enMap[key];
      added.push(key);
    }
  }
  stats[lang].added = added;

  if (added.length > 0) {
    const newLines = rebuildSection(allLines, sections[lang].start, sections[lang].end, langMap);
    const oldLen = sections[lang].end - sections[lang].start;
    const delta = newLines.length - oldLen;
    allLines.splice(sections[lang].start, oldLen, ...newLines);

    // adjust offsets of subsequent sections
    const idx = langOrder.indexOf(lang);
    for (let li = idx + 1; li < langOrder.length; li++) {
      sections[langOrder[li]].start += delta;
      sections[langOrder[li]].end += delta;
    }
  }
}

// ---- STEP 2: Fix tutorial step ID mismatches ----

const enMap2 = parseSection(allLines, sections.en.start, sections.en.end);

const tutorialFiles = fs.readdirSync(TUTORIAL_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');
const tutorialDefs = [];

for (const file of tutorialFiles) {
  const fpath = path.join(TUTORIAL_DIR, file);
  const src = fs.readFileSync(fpath, 'utf-8');
  const idMatch = src.match(/^\s*id:\s*'([^']+)'/m);
  if (!idMatch) continue;
  const tutorialId = idMatch[1];

  const stepIds = [];
  const lines = src.split('\n');
  let inSteps = false;
  for (const line of lines) {
    if (line.includes('steps:')) inSteps = true;
    if (inSteps) {
      const sm = line.match(/^\s{6}id:\s*'([^']+)'/);
      if (sm) stepIds.push(sm[1]);
    }
  }
  if (stepIds.length > 0) tutorialDefs.push({ tutorialId, stepIds });
}

let mismatchFixCount = 0;

for (const def of tutorialDefs) {
  const { tutorialId, stepIds } = def;
  const prefix = `tutorial.${tutorialId}.steps.`;

  // get all existing keys for this tutorial
  const existingKeys = Object.keys(enMap2).filter(k => k.startsWith(prefix));

  for (const stepId of stepIds) {
    const expectedTitle = `${prefix}${stepId}.title`;
    if (expectedTitle in enMap2) continue;

    // Find a mismatched key: prefix + *.title where * is NOT in stepIds
    let wrongTitleKey = null;
    let wrongStepId = null;
    for (const ek of existingKeys) {
      const rest = ek.slice(prefix.length);
      const dotIdx = rest.indexOf('.');
      if (dotIdx === -1) continue;
      const embeddedId = rest.slice(0, dotIdx);
      if (!stepIds.includes(embeddedId) && rest.endsWith('.title')) {
        wrongTitleKey = ek;
        wrongStepId = embeddedId;
        break;
      }
    }

    if (!wrongTitleKey) continue;

    const oldBase = `${prefix}${wrongStepId}`;
    const newBase = `${prefix}${stepId}`;
    const expectedDesc = `${prefix}${stepId}.desc`;
    const oldDescKey = `${oldBase}.desc`;
    const hasDesc = existingKeys.includes(oldDescKey);

    // Rename in ALL sections
    for (const lang of ['en', 'am', 'om', 'ti']) {
      const langMap = parseSection(allLines, sections[lang].start, sections[lang].end);

      const oldTitle = `${oldBase}.title`;
      if (oldTitle in langMap) {
        langMap[expectedTitle] = langMap[oldTitle];
        delete langMap[oldTitle];
      }
      if (hasDesc) {
        if (oldDescKey in langMap) {
          langMap[expectedDesc] = langMap[oldDescKey];
          delete langMap[oldDescKey];
        }
      }

      const newLines = rebuildSection(allLines, sections[lang].start, sections[lang].end, langMap);
      const oldLen = sections[lang].end - sections[lang].start;
      const delta = newLines.length - oldLen;
      allLines.splice(sections[lang].start, oldLen, ...newLines);

      const idx = langOrder.indexOf(lang);
      for (let li = idx + 1; li < langOrder.length; li++) {
        sections[langOrder[li]].start += delta;
        sections[langOrder[li]].end += delta;
      }
    }

    // update enMap2
    if (wrongTitleKey in enMap2) delete enMap2[wrongTitleKey];
    enMap2[expectedTitle] = true;
    if (hasDesc) {
      if (oldDescKey in enMap2) delete enMap2[oldDescKey];
      enMap2[expectedDesc] = true;
    }

    mismatchFixCount++;
  }
}

// ---- REPORT ----

console.log('\n=== Sync Translations Report ===\n');

const groupLabels = [
  { prefix: 'subscription.', label: 'subscription.*' },
  { prefix: 'dialog.', label: 'dialog.*' },
  { prefix: 'toast.', label: 'toast.*' },
  { prefix: 'language.', label: 'language.*' },
  { prefix: 'snooze.', label: 'snooze.*' },
  { prefix: 'screen.', label: 'screen.*' },
];

for (const lang of ['am', 'om', 'ti']) {
  const added = stats[lang].added;
  console.log(`--- ${lang.toUpperCase()} ---`);

  for (const g of groupLabels) {
    const count = added.filter(k => k.startsWith(g.prefix)).length;
    if (count > 0) console.log(`  ${g.label}: ${count}`);
  }
  const themeAdded = added.filter(k => k.startsWith('theme.') && isThemeBaseKey(k)).length;
  if (themeAdded > 0) console.log(`  theme (base): ${themeAdded}`);

  const commonAdded = added.filter(k => k.startsWith('common.') && isCommonAllowed(k)).length;
  if (commonAdded > 0) console.log(`  common (allowed): ${commonAdded}`);

  const totalAdded = added.length;
  console.log(`  Total: ${totalAdded} keys added`);
  console.log('');
}

console.log(`Tutorial step ID mismatches fixed: ${mismatchFixCount}\n`);

// Write file
fs.writeFileSync(FILE, allLines.join('\n'), 'utf-8');
console.log('SettingsContext.tsx updated successfully.');
