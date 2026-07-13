const fs = require('fs');
const c = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
const lines = c.split('\n');

// Extract all tutorial.* keys from EN section
let inEn = false, bc = 0, tutorialKeys = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (t === 'en: {') { inEn = true; bc = 1; continue; }
  if (inEn) {
    const o = (t.match(/{/g)||[]).length;
    const cl = (t.match(/}/g)||[]).length;
    bc += o - cl;
    // Match both normal keys and escaped ones
    const m = t.match(/^'(tutorial\.[^']+)':\s*'((?:[^'\\]|\\.)*)'/);
    if (m) tutorialKeys.push({ key: m[1], val: m[2] });
    if (bc <= 0) break;
  }
}
console.log('EN tutorial keys:', tutorialKeys.length);

// Build AM values — use Amharic translations
// For overlay keys, translate; for step keys, keep EN as-is
const am = {};
const om = {};
const ti = {};

// Hardcoded overlay/menu translations
const amOverlay = {
  'tutorial.resume': 'ቀጥል',
  'tutorial.skip': 'ዝለል',
  'tutorial.paused_title': 'ማጠናከሪያ ቆሟል',
  'tutorial.paused_desc': 'ማጠናከሪያህ ቆሟል። ለመቀጠል ቀጥል የሚለውን ይጫኑ።',
  'tutorial.complete_title': 'ማጠናከሪያ ተጠናቋል!',
  'tutorial.complete_desc': '{name} ን ተምረዋል!',
  'tutorial.restart': 'እንደገና ጀምር',
  'tutorial.close': 'ዝጋ',
  'tutorial.done': 'ተከናውኗል',
  'tutorial.next': 'ቀጣይ',
  'tutorial.action_done': '\u2713 ተከናውኗል!',
  'tutorial.action_tap': 'የደመቀውን ክፍል ይንኩ',
  'tutorial.action_swipe': 'የደመቀውን አካባቢ ያንሸራትቱ',
  'tutorial.action_type': 'በደመቀው መስክ ውስጥ ይጻፉ',
  'tutorial.action_scroll': 'የደመቀውን አካባቢ ይጎትቱ',
  'tutorial.menu_title': '{name} ማጠናከሪያ',
  'tutorial.menu_completed': 'ይህን ማጠናከሪያ አጠናቀዋል! እንደገና ለማየት ወይም ለመጀመር ይችላሉ።',
  'tutorial.menu_continue': 'ከ{step} ደረጃ ቀጥል',
  'tutorial.menu_learn': 'ይህን ስክሪን እንዴት መጠቀም እንዳለቦት ደረጃ በደረጃ ይማሩ።',
  'tutorial.menu_continue_btn': 'ቀጥል ({current}/{total})',
  'tutorial.menu_start': 'ማጠናከሪያ ጀምር',
};

const omOverlay = {
  'tutorial.resume': 'Itti fufi',
  'tutorial.skip': 'Darbi',
  'tutorial.paused_title': 'Tutorial Dhaabameera',
  'tutorial.paused_desc': 'Tutorial kee dhaabameera. Itti fufuuf Itti fufi tuqui.',
  'tutorial.complete_title': 'Tutorial Xumurameera!',
  'tutorial.complete_desc': '{name} barattee jirta!',
  'tutorial.restart': 'Irra deebi\'i',
  'tutorial.close': 'Cufi',
  'tutorial.done': 'Xumurameera',
  'tutorial.next': 'Itti aanu',
  'tutorial.action_done': '\u2713 Xumurameera!',
  'tutorial.action_tap': 'Qaama ifatti mul\'atu tuqui',
  'tutorial.action_swipe': 'Naannoo ifatti mul\'atu sii\'i',
  'tutorial.action_type': 'Dirree ifatti mul\'atu keessatti barreessi',
  'tutorial.action_scroll': 'Naannoo ifatti mul\'atu garagagsi',
  'tutorial.menu_title': '{name} Tutorial',
  'tutorial.menu_completed': 'Tutorial kana xumurteerta! Irra deebi\'uu ykn jalqabuun dandeessa.',
  'tutorial.menu_continue': 'Tarkaanfii {step} irraa itti fufi',
  'tutorial.menu_learn': 'Akkataa iskiriinii kana itti fayyadamuu tarkaanfii tarkaanfiidhaan baradhu.',
  'tutorial.menu_continue_btn': 'Itti fufi ({current}/{total})',
  'tutorial.menu_start': 'Tutorial Jalqabi',
};

const tiOverlay = {
  'tutorial.resume': 'ቀጽል',
  'tutorial.skip': 'ዝለል',
  'tutorial.paused_title': 'ምምሃሮ ተቋሪጹ',
  'tutorial.paused_desc': 'ምምሃሮኻ ተቋሪጹ ኣሎ። ንምቕጻል ቀጽል ጠውቕ።',
  'tutorial.complete_title': 'ምምሃሮ ተዛዚሙ!',
  'tutorial.complete_desc': '{name} ተማሂርካ!',
  'tutorial.restart': 'ዳግማይ ጀምር',
  'tutorial.close': 'ዕጸው',
  'tutorial.done': 'ተዛዚሙ',
  'tutorial.next': 'ዝቕጥር',
  'tutorial.action_done': '\u2713 ተዛዚሙ!',
  'tutorial.action_tap': 'ነቲ ዝበርህ ክፋል ጠውቕ',
  'tutorial.action_swipe': 'ነቲ ዝበርህ ከባቢ ስሕብ',
  'tutorial.action_type': 'ኣብቲ ዝበርህ መሮጺ ጸሓፍ',
  'tutorial.action_scroll': 'ነቲ ዝበርህ ከባቢ ጉትት',
  'tutorial.menu_title': 'ምምሃሮ {name}',
  'tutorial.menu_completed': 'ነዚ ምምሃሮ ዛዚምካዮ! ከምበር ንምርኣይ ወይ ንምድላስ ትኽእል ኢኻ።',
  'tutorial.menu_continue': 'ካብ መዕረግ {step} ቀጽል',
  'tutorial.menu_learn': 'ነዛ ስክሪን ብኸመይ ምጥቃም ከምዘሎካ መዕረግ ብመዕረግ ተምሃር።',
  'tutorial.menu_continue_btn': 'ቀጽል ({current}/{total})',
  'tutorial.menu_start': 'ምምሃሮ ጀምር',
};

// For step definition keys, translate only the tutorial titles/subtitles where possible
// For individual step descriptions, keep EN values (to avoid raw key display)
// We'll do a simple word replacement for common terms in AM/TI

// Map of English tutorial keys with Amharic translations
const amStepDefs = {};
const omStepDefs = {};
const tiStepDefs = {};

// Tutorial name translations
const tutorialNames = {
  'activity-ledger': { am: 'የእንቅስቃሴ መዝገብ', om: 'Galmea Gochaa', ti: 'መዝገብ ንጥፈታት' },
  'add-order-item': { am: 'የትእዛዝ እቃ ጨምር', om: 'Meshaa Ajajaa Dabali', ti: 'ናውቲ ትእዛዝ ወስኽ' },
  'adjustment': { am: 'ማስተካከያ', om: 'Sirreeffama', ti: 'ምቅንዓት' },
  'adjustment-history': { am: 'የማስተካከያ ታሪክ', om: 'Seenaa Sirreeffama', ti: 'ታሪኽ ምቅንዓት' },
  'budget': { am: 'በጀት', om: 'Bajata', ti: 'በጀት' },
  'collect-payments': { am: 'ክፍያ ሰብስብ', om: 'Kaffaltii Fudhu', ti: 'ክፍሊት ኣከብብ' },
  'contact-details': { am: 'የእውቂያ ዝርዝሮች', om: 'Ibsa Quunnamtii', ti: 'ዝርዝር መላላኺ' },
  'contacts': { am: 'እውቂያዎች', om: 'Quunnamtii', ti: 'መላላኺ' },
  'create-budget': { am: 'በጀት ፍጠር', om: 'Bajata Uumi', ti: 'በጀት ፍጠር' },
  'create-order': { am: 'ትእዛዝ ፍጠር', om: 'Ajaja Uumi', ti: 'ትእዛዝ ፍጠር' },
  'damaged-item': { am: 'የተበላሸ እቃ', om: 'Meeshaa Miidhame', ti: 'ዝተበላሸወ ናውቲ' },
  'dashboard': { am: 'ዳሽቦርድ', om: 'Dashboard', ti: 'ዳሽቦርድ' },
  'date-time': { am: 'ቀን እና ሰዓት ቅንጅቶች', om: 'Sajoo Guyyaa fi Sa\'aatii', ti: 'ቅንጅታት ዕለትን ሰዓትን' },
  'debt-detail': { am: 'የዕዳ ዝርዝር', om: 'Ibsa Liqii', ti: 'ዝርዝር ዕዳ' },
  'debt-list': { am: 'የዕዳ ዝርዝር', om: 'Tarree Liqii', ti: 'ዝርዝር ዕዳ' },
  'debt-management': { am: 'የዕዳ አስተዳደር', om: 'Bulchiinsa Liqii', ti: 'ምሕደራ ዕዳ' },
  'expense': { am: 'ወጪ', om: 'Baasii', ti: 'ወጻኢ' },
  'expense-details': { am: 'የወጪ ዝርዝሮች', om: 'Ibsa Baasii', ti: 'ዝርዝር ወጻኢ' },
  'expense-form': { am: 'የወጪ ቅጽ', om: 'Foormaa Baasii', ti: 'ቅጺ ወጻኢ' },
  'expense-list': { am: 'የወጪ ዝርዝር', om: 'Tarree Baasii', ti: 'ዝርዝር ወጻኢ' },
  'expense-loss': { am: 'ወጪ እና ኪሳራ', om: 'Baasii fi Hada', ti: 'ወጻኢን ኪሳራን' },
  'inventory': { am: 'ክምችት', om: 'Meeshaalee', ti: 'ክምችት' },
  'inventory-form': { am: 'የክምችት ቅጽ', om: 'Foormaa Meeshaa', ti: 'ቅጺ ክምችት' },
  'inventory-records': { am: 'የክምችት መዛግብት', om: 'Galmee Meeshaalee', ti: 'መዝገባት ክምችት' },
  'item-details': { am: 'የእቃ ዝርዝሮች', om: 'Ibsa Meeshaa', ti: 'ዝርዝር ናውቲ' },
  'low-stock-list': { am: 'ዝቅተኛ ክምችት', om: 'Tarree Meeshaa Xiqqaa', ti: 'ውሑድ ክምችት' },
  'notification-settings': { am: 'የማሳወቂያ ቅንጅቶች', om: 'Sajoo Beeksisaa', ti: 'ቅንጅታት መፍለጢ' },
  'notifications': { am: 'ማሳወቂያዎች', om: 'Beeksisaa', ti: 'መፍለጢታት' },
  'oncredit-list': { am: 'በዕዳ ዝርዝር', om: 'Tarree Liqaan', ti: 'ብዕዳ ዝርዝር' },
  'order-detail': { am: 'የትእዛዝ ዝርዝር', om: 'Ibsa Ajajaa', ti: 'ዝርዝር ትእዛዝ' },
  'orders': { am: 'ትእዛዞች', om: 'Ajaja', ti: 'ትእዛዛት' },
  'pending-sales': { am: 'ያልተጠናቀቁ ሽያጮች', om: 'Gurgurtaa Hanga Hin Xumuramne', ti: 'ዘይተዛዘሙ ሽያጣት' },
  'price-decrease': { am: 'የዋጋ ቅናሽ', om: 'Gatiin Hir\\'uu', ti: 'ምትሕታት ዋጋ' },
  'price-increase': { am: 'የዋጋ ጭማሪ', om: 'Gatiin Dabaluu', ti: 'ምውሳኽ ዋጋ' },
  'profile-settings': { am: 'የመገለጫ ቅንጅቶች', om: 'Sajoo Pirootaayilii', ti: 'ቅንጅታት መግለጺ' },
  'reminders': { am: 'አስታዋሾች', om: 'Yaadachiisota', ti: 'መዘንከሪታት' },
  'sale-form': { am: 'የሽያጭ ቅጽ', om: 'Foormaa Gurgurtaa', ti: 'ቅጺ ሽያጥ' },
  'sales-details': { am: 'የሽያጭ ዝርዝሮች', om: 'Ibsa Gurgurtaa', ti: 'ዝርዝር ሽያጥ' },
  'sales-hub': { am: 'የሽያጭ ማእከል', om: 'Bu\'aa Gurgurtaa', ti: 'ማእከል ሽያጥ' },
  'sales-records': { am: 'የሽያጭ መዛግብት', om: 'Galmee Gurgurtaa', ti: 'መዝገባት ሽያጥ' },
  'security-settings': { am: 'የደህንነት ቅንጅቶች', om: 'Sajoo Nageenyaa', ti: 'ቅንጅታት ድሕንነት' },
  'settings': { am: 'ቅንጅቶች', om: 'Sajoo', ti: 'ቅንጅታት' },
  'summary': { am: 'ማጠቃለያ', om: 'Cuunfaa', ti: 'ጠቕላላ' },
  'support': { am: 'ድጋፍ', om: 'Deeggarsa', ti: 'ደገፍ' },
  'translation': { am: 'የቋንቋ ቅንጅቶች', om: 'Sajoo Afaanii', ti: 'ቅንጅታት ቋንቋ' },
  'warehouse-manager': { am: 'የመጋዘን አስተዳዳሪ', om: 'Bulchaa Makasinaa', ti: 'ኣመሓዳሪ መኽዘን' },
  'warehouse-settings': { am: 'የመጋዘን ቅንጅቶች', om: 'Sajoo Makasinaa', ti: 'ቅንጅታት መኽዘን' },
};

// Subtitle translations
const tutorialSubtitles = {
  'activity-ledger': { am: 'ሁሉንም እንቅስቃሴዎች ይመልከቱ', om: 'Gochaa hunda ilaali', ti: 'ኩሉ ንጥፈታት ርአ' },
  'dashboard': { am: 'የንግድ ሥራዎን በአንድ ቦታ ይቆጣጠሩ', om: 'Hojiin kee iddoo tokkoo keessatti to\'achi', ti: 'ንግድኻ ኣብ ሓደ ቦታ ተቆጻጸር' },
  'inventory': { am: 'ክምችትዎን ያስተዳድሩ', om: 'Meeshaalee kee bulchi', ti: 'ክምችትካ ኣመሓድር' },
  'sales-hub': { am: 'ሽያጮችን ይቆጣጠሩ', om: 'Gurgurtaa to\'achi', ti: 'ሽያጣት ተቆጻጸር' },
  'settings': { am: 'የመተግበሪያ ቅንጅቶችዎን ያብጁ', om: 'Sajoo appii kee fooyyessi', ti: 'ቅንጅታት መተግበሪ ኣማሻርዮ' },
  'expense': { am: 'ወጪዎችን ይከታተሉ', om: 'Baasii hordofi', ti: 'ወጻኢታት ከታተል' },
  'contacts': { am: 'ግንኙነቶችዎን ያስተዳድሩ', om: 'Quunnamtii kee bulchi', ti: 'መላላኺ ኣመሓድር' },
  'summary': { am: 'ማጠቃለያ ሪፖርቶች', om: 'Gabaasa Cuunfaa', ti: 'ጠቕላላ ሪፖርታት' },
  // Default for others
  'default': { am: 'ይህን ባህሪ እንዴት መጠቀም እንዳለቦት ይማሩ', om: 'Akkataa amala kana itti fayyadamuu baradhu', ti: 'ነዚ ባህሪ ከመይ ጌርካ ምጥቃም ተምሃር' },
};

let enIdx = 0;
for (const k of tutorialKeys) {
  enIdx++;
  const { key, val } = k;
  
  // Check if it's an overlay key (has translation above)
  if (amOverlay[key]) {
    am[key] = amOverlay[key];
  }
  if (omOverlay[key]) {
    om[key] = omOverlay[key];
  }
  if (tiOverlay[key]) {
    ti[key] = tiOverlay[key];
  }
  
  // For non-overlay keys (step definitions), provide AM/OM/TI values
  if (!am[key]) {
    // Extract tutorial ID from key like 'tutorial.dashboard.title'
    const parts = key.split('.');
    if (parts.length >= 2) {
      const tutId = parts[1]; // e.g., 'dashboard'
      const subKey = parts.slice(2).join('.'); // e.g., 'title', 'subtitle', 'steps.0.title'
      
      if (subKey === 'title' && tutorialNames[tutId]) {
        am[key] = tutorialNames[tutId].am;
        om[key] = tutorialNames[tutId].om;
        ti[key] = tutorialNames[tutId].ti;
      } else if (subKey === 'subtitle' && tutorialSubtitles[tutId]) {
        am[key] = tutorialSubtitles[tutId].am;
        om[key] = tutorialSubtitles[tutId].om;
        ti[key] = tutorialSubtitles[tutId].ti;
      } else if (subKey === 'subtitle') {
        am[key] = tutorialSubtitles['default'].am;
        om[key] = tutorialSubtitles['default'].om;
        ti[key] = tutorialSubtitles['default'].ti;
      } else {
        // For step titles/descriptions, keep EN values
        // These are detailed descriptions that are too long to translate inline
        am[key] = val;
        om[key] = val;
        ti[key] = val;
      }
    } else {
      am[key] = val;
      om[key] = val;
      ti[key] = val;
    }
  }
}

// Now add all tutorial.* keys to AM, OM, TI sections
function findSectionEnd(sectionName) {
  let inSection = false, bc = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === sectionName + ': {') { inSection = true; bc = 1; continue; }
    if (inSection) {
      const o = (t.match(/{/g)||[]).length;
      const cl = (t.match(/}/g)||[]).length;
      bc += o - cl;
      if (bc <= 0) return i - 1;
    }
  }
  return -1;
}

function getExistingKeys(sectionName) {
  const keys = new Set();
  let inSection = false, bc = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === sectionName + ': {') { inSection = true; bc = 1; continue; }
    if (inSection) {
      const o = (t.match(/{/g)||[]).length;
      const cl = (t.match(/}/g)||[]).length;
      bc += o - cl;
      const m = t.match(/'([^']+)':/);
      if (m) keys.add(m[1]);
      if (bc <= 0) break;
    }
  }
  return keys;
}

const sections = ['am', 'om', 'ti'];
const vals = { am, om, ti };
const insertPts = {};
const existing = {};

for (const s of sections) {
  insertPts[s] = findSectionEnd(s);
  existing[s] = getExistingKeys(s);
  console.log(s + ' ends at line ' + insertPts[s]);
}

let result = '';
let added = 0;

for (let i = 0; i < lines.length; i++) {
  result += lines[i] + '\n';
  for (const s of sections) {
    if (i === insertPts[s]) {
      const exist = existing[s];
      for (const k of tutorialKeys) {
        if (!exist.has(k.key)) {
          const v = vals[s][k.key];
          if (v !== undefined) {
            // Escape single quotes in the value
            const escaped = v.replace(/'/g, "\\'");
            result += "    '" + k.key + "': '" + escaped + "',\n";
            added++;
          } else {
            console.error('MISSING VALUE for', s, k.key);
          }
        }
      }
    }
  }
}

fs.writeFileSync('src/context/SettingsContext.tsx', result);
console.log('Added ' + added + ' tutorial keys total');
console.log('AM tutorial keys: ' + Object.keys(am).length);
console.log('OM tutorial keys: ' + Object.keys(om).length);
console.log('TI tutorial keys: ' + Object.keys(ti).length);
