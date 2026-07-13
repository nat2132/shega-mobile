const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'src/context/SettingsContext.tsx');
let content = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const lines = content.split('\n');

// Translation data: am, om, ti maps
const am = {};
const om = {};
const ti = {};

function t(enVal, amVal, omVal, tiVal) {
  am[enVal] = amVal;
  om[enVal] = omVal;
  ti[enVal] = tiVal;
}
// === Common UI ===
t('Close','??','Cufi','???');
t('Done','??????','Xumurame','????');
t('Next','???','Kan itti aanuu','????');
t('Restart','????? ???','Irra deebi\'i jalqabi','???? ????');
t('Start Tutorial','??? ???? ????','Leenjii jalqabi','???? ???');
t('Scroll the highlighted area','?????? ?? ?????','Bakka ifti itti caale suuqi','?? ???? ?? ?????');
t('Swipe the highlighted area','?????? ?? ??????','Bakka ifti itti caale siigi','?? ???? ?? ??????');
t('Tap the highlighted element','?????? ??? ???','Qaama ifti itti caale tuqi','?? ???? ??? ???');
t('Type in the highlighted field','?????? ??? ????','Dirree ifti itti caale keessa barreessi','??? ???? ?? ???');
t('You completed this tutorial! Take a refresher or restart.','??? ??? ???? ??????! ????? ???? ??? ????? ?????','Leenjii kana xumurte! Irra deebi\'i ilaali ykn irra deebi\'i jalqabi.','?? ???? ?????! ???? ???? ?? ???? ?????');
t('Continue from step {step}','?{step} ??? ???','Tarkaanfata {step} irraa itti fufi','?? ??? {step} ???');
t('Continue ({current}/{total})','??? ({current}/{total})','Itti fufi ({current}/{total})','??? ({current}/{total})');
t('Learn how to use this screen step by step.','??? ???? ??? ???? ???? ??????? ????','Iskiriinii kana tarkaanfataan tarkaanfataan akka itti fayyadamtu baradhu.','?? ???? ??? ???? ??? ?? ?????? ?????');
t('Tutorial Complete!','??? ???? ?????!','Leenjii xumurameera!','???? ????!');
t('{name} Tutorial','?{name} ??? ????','Leenjii {name}','???? {name}');
// === activity-ledger ===
t('Activity Ledger','የእንቅስቃሴ መዝገብ','Galmee Sochii','መዝገብ ንጥፈታት');
t('View all business activity','ሁሉንም የንግድ እንቅስቃሴ ይመልከቱ','Sochii daldalaa hunda ilaali','ንጥፈታት ንግድ ብምሉኡ ርአ');
t('Activity Feed','የእንቅስቃሴ መግብ','Sochii Feedii','መጋብ ንጥፈታት');
t('This is your business activity feed — every transaction, adjustment, and event recorded in chronological order.','ይህ የንግድ እንቅስቃሴ መግብዎ ነው — እያንዳንዱ ግብይት፣ ማስተካከያ እና ክስተት በጊዜ ቅደም ተከተል የተመዘገበ።','Kun sochii daldalaa kee feedii — jijjiirama gatii, sirreeffamoota, fi gochiiwwan hunduu yeroo tartiibaan galmeeffaman.','እዚ መጋብ ንጥፈታት ንግድኩም እዩ — ነፍሲ ወከፍ ልውውጥ፣ ምትዕርራይ ከምኡውን ኣጋጣሚ ብተፈጥሮ ቅደም ተከተል ዝተመዝገበ።');
t('Filter Activity','እንቅስቃሴ አጣራ','Sochii calleessii','ንጥፈታት ኣጣርሩ');
t('Every action is listed here: sales, expenses, inventory changes, price adjustments, and payments received.','እያንዳንዱ ድርጊት እዚህ ተዘርዝሯል፦ ሽያጮች፣ ወጪዎች፣ የክምችት ለውጦች፣ የዋጋ ማስተካከያዎች እና የተቀበሉ ክፍያዎች።','Gochiiwwan hunduma asitti tarreeffaman: gurgurtaalee, baasii, jijjiirama kuusaa, sirreeffama gatii, fi kaffaltiiwwan fudhataman.','ነፍሲ ወከፍ ተግባር ኣብዚ ተዘርዚሩ ኣሎ፦ ሽያጣት፣ ወጻኢታት፣ ምቕያር ክምችት፣ ምትእርራይ ዋጋ ከምኡውን እተቐበሉ ክፍሊታት።');
t('Filter by activity type (sales, expenses, inventory, payments) or date range to find specific events.','የተወሰኑ ክስተቶችን ለማግኘት በእንቅስቃሴ አይነት (ሽያጭ፣ ወጪ፣ ክምችት፣ ክፍያ) ወይም በቀን ክልል አጣራ።','Gosa sochii (gurgurtaa, baasii, kuusaa, kaffaltii) ykn daangaa guyyaatiin calleessii gochaalee addaa argachuuf.','ብኣይነት ንጥፈታት (ሽያጥ፣ ወጻኢ፣ ክምችት፣ ክፍሊት) ወይ ብዝምድና መዓልቲ ንፍሉያት ኣጋጣሚታት ንምርካብ ኣጣርሩ።');
// === add-order-item ===
t('Add Order Item','የትእዛዝ ዕቃ ጨምር','Meelata Ajaja Idaatii','ዕቃ ትእዛዝ ወስኽ');
t('Add products to a purchase order','ምርቶችን ወደ የግዢ ትእዛዝ ያክሉ','Oomishaalee ajaja bitaa irratti ida\'i','ምርታት ናብ ትእዛዝ ግዢ ወስኹ');
t('Adding an Order Item','የትእዛዝ ዕቃ በመጨመር ላይ','Meelata Ajaja Idachaatti','ዕቃ ትእዛዝ ይውስኽ ኣሎ');
t('Follow these steps to add a product to your purchase order. You can search for existing inventory items or enter a custom description.','ምርት ወደ የግዢ ትእዛዝዎ ለመጨመር እነዚህን ደረጃዎች ይከተሉ። ያሉትን የክምችት ዕቃዎች መፈለግ ወይም ብጁ መግለጫ ማስገባት ይችላሉ።','Tarkaanfiiwwan kana hordofi oomishaa ajaja bitaa keetti idaasuuf. Meelawwan kuusaa jiran barbaaduu ykn ibsa ofii barreessuu dandeessa.','ነዞም ደረጃታት ተኸተሉ ምርት ናብ ትእዛዝ ግዢኩም ንምውስኽ። ንዘለዉ እቃታት ክምችት ክትደልዩ ወይ ብጁ መግለጺ ከተእትዉ ትኽእሉ ኢኹም።');
t('Item Name','የዕቃ ስም','Maqaa Meelataa','ስም ዕቃ');
t('Enter the name of the product you want to order. If it exists in inventory, it will auto-fill details.','ማዘዝ የሚፈልጉትን ምርት ስም ያስገቡ። በክምችት ውስጥ ካለ ዝርዝሮቹን በራስ-ሰር ይሞላል።','Maqaa oomishaa ajajuu barbaadduu galchi. Yoo kuusaa keessa jiraate, ofumaan guutama.','ስም እቲ ክትእዝዝዎ እትደልዩ ምርት ኣእትዉ። ኣብ ክምችት እንተሎ፡ ብርእሱ ዝርዝራት ይመልእ።');
t('Supplier / Company','አቅራቢ / ኩባንያ','Dhiyeessaa / Kaampaanii','ኣቕራቢ / ኩባንያ');
t('Enter the supplier or company name for this item. This is useful for tracking purchases by vendor.','ለዚህ ዕቃ የአቅራቢውን ወይም የኩባንያውን ስም ያስገቡ። ይህ ግዢዎችን በአቅራቢ ለመከታተል ጠቃሚ ነው።','Maqaa dhiyeessaa ykn kaampaanii meelata kanaaf galchi. Kun bitoota dhiyeessaan hordofuuf fayya.','ስም ኣቕራቢ ወይ ኩባንያ ንዛ ዕቃ ኣእትዉ። እዚ ንምክትታል ግዚ በኣቕራቢ ይጠቅም እዩ።');
t('Order Quantity','የትእዛዝ ብዛት','Hamma Ajajaa','ልዕሊ ትእዛዝ');
t('Enter the quantity you want to order. This will be added to your purchase order.','ማዘዝ የሚፈልጉትን ብዛት ያስገቡ። ይህ ወደ የግዢ ትእዛዝዎ ይጨመራል።','Hamma ajajuu barbaaddu galchi. Kun ajaja bitaa keetti ida\'ama.','እቲ ክትእዝዝዎ እትደልዩ ብዝሒ ኣእትዉ። እዚ ናብ ትእዛዝ ግዢኩም ይውሰኽ እዩ።');
t('Add to Order','ወደ ትእዛዝ ጨምር','Ajaja Irratti Ida\'i','ናብ ትእዛዝ ወስኽ');
t('Tap to add this item to your purchase order. You can add multiple items before finalizing.','ይህን ዕቃ ወደ የግዢ ትእዛዝዎ ለመጨመር ይንኩ። ከማጠናቀቅዎ በፊት በርካታ ዕቃዎችን መጨመር ይችላሉ።','Tuqi meelata kana ajaja bitaa keetti idaasuuf. Meelawwan baay\'ee yoo xumuruu hin oofin dura ida\'uu dandeessa.','ነዛ ዕቃ ናብ ትእዛዝ ግዢኩም ንምውስኽ ጠውቑ። ቅድሚ ምውዳእኩም ብዙሓት እቃታት ክትወስኹ ትኽእሉ ኢኹም።');
// === adjustment ===
t('Adjustments','ማስተካከያዎች','Sirreeffamoota','ምትእርራያት');
t('Manage price and stock changes','የዋጋ እና የክምችት ለውጦችን ያስተዳድሩ','Jijjiirama gatii fi kuusaa bulchi','ምቕያር ዋጋ ከምኡውን ክምችት ኣመሓድሩ');
t('Adjustments Hub','የማስተካከያ ማዕከል','Waltajjii Sirreeffamaa','ማእከል ምትእርራይ');
t('Make corrections to your inventory — price changes, damaged items, stock adjustments.','በክምችትዎ ላይ እርማቶችን ያድርጉ — የዋጋ ለውጦች፣ የተበላሹ ዕቃዎች፣ የክምችት ማስተካከያዎች።','Kuusaa kee irratti sirreeffama hojii — jijjiirama gatii, meelawwan miidhaman, sirreeffama kuusaa.','ኣብ ክምችትኩም ምትእርራይ ግበሩ — ምቕያር ዋጋ፣ እተበላሹ እቃታት፣ ምትእርራይ ክምችት።');
t('Adjustment Types','የማስተካከያ ዓይነቶች','Gosa Sirreeffamaa','ኣይነታት ምትእርራይ');
t('Choose from three types: Price Increase, Price Decrease, or Damaged Item.','ከሶስት ዓይነቶች ይምረጡ፦ የዋጋ መጨመሪያ፣ የዋጋ መቀነሻ፣ ወይም የተበላሸ ዕቃ።','Gosa sadii irraa filadhu: Gatiin Dabaluu, Gatiin Hir\'isuu, ykn Meelata Miidhame.','ካብ ሰለስተ ኣይነታት ምረጹ፦ ዋጋ ምውሳኽ፣ ዋጋ ምቕናስ፣ ወይ እተበላሸ ዕቃ።');
t('Calibration Ledger','የማስተካከያ መዝገብ','Galmee Sirreeffamaa','መዝገብ ምትእርራይ');
t('All past adjustments are recorded here. View the audit trail for every change.','ሁሉም ያለፉ ማስተካከያዎች እዚህ ተመዝግበዋል። የእያንዳንዱን ለውጥ የኦዲት ዱካ ይመልከቱ።','Sirreeffamoota darbe hunda asitti galmeeffame. Jijjiirama hundaaf karaa qorumsaa ilaali.','ኩሎም ዝሓለፉ ምትእርራያት ኣብዚ ተመዝጊቦም ኣለዉ። ንነፍሲ ወከፍ ምቕያር መንገዲ ምርመራ ርአ።');
t('Integrity Statistics','የታማኝነት ስታቲስቲክስ','Istaatistiksii Amanamummaa','ስታቲስቲክስ ቅንዕና');
t('Track monthly corrections, capital leakage from damaged items, and overall inventory integrity.','ወርሃዊ እርማቶችን፣ ከተበላሹ ዕቃዎች የካፒታል ፍሳሽን እና አጠቃላይ የክምችት ትክክለኛነትን ይከታተሉ።','Sirreeffamoota ji\'aa, hoongoo kaapitaalaa meelawwan miidhaman irraa, fi amanamummaa kuusaa walii galaa hordofi.','ወርሓዊ ምትእርራያት፣ ምጥፋእ ካፒታል ካብ እተበላሹ እቃታት ከምኡውን ምሉእ ቅንዕና ክምችት ክታበሉ።');
// === adjustment-history ===
t('Adjustment History','የማስተካከያ ታሪክ','Seenaa Sirreeffamaa','ታሪኽ ምትእርራይ');
t('Review all price and stock adjustments','ሁሉንም የዋጋ እና የክምችት ማስተካከያዎች ይከልሱ','Sirreeffamoota gatii fi kuusaa hunda ilaali','ኩሎም ምትእርራያት ዋጋን ክምችትን ምርምሩ');
t('View the complete history of all price changes, stock adjustments, and damaged items.','የሁሉም የዋጋ ለውጦች፣ የክምችት ማስተካከያዎች እና የተበላሹ ዕቃዎች ሙሉ ታሪክ ይመልከቱ።','Seenaa guutuu jijjiirama gatii, sirreeffama kuusaa, fi meelawwan miidhamanii ilaali.','ምሉእ ታሪኽ ኩሎም ምቕያራት ዋጋ፣ ምትእርራያት ክምችት ከምኡውን እተበላሹ እቃታት ርአ።');
t('Filter Adjustments','ማስተካከያዎችን አጣራ','Sirreeffamoota Calleessii','ምትእርራያት ኣጣርሩ');
t('Filter by adjustment type (price increase, decrease, damaged) or date range.','በማስተካከያ ዓይነት (የዋጋ መጨመሪያ፣ መቀነሻ፣ የተበላሸ) ወይም በቀን ክልል አጣራ።','Gosa sirreeffamaan (gatii dabaluu, hir\'isuu, miidhame) ykn daangaa guyyaatiin calleessii.','ብኣይነት ምትእርራይ (ዋጋ ምውሳኽ፣ ምቕናስ፣ ምብላሽ) ወይ ብዝምድና መዓልቲ ኣጣርሩ።');
t('Adjustment Entries','የማስተካከያ ግቤቶች','Galmeewwan Sirreeffamaa','ኣእታው ምትእርራይ');
t('Each entry shows the item name, adjustment type, old and new values, and who made the change.','እያንዳንዱ ግቤት የዕቃውን ስም፣ የማስተካከያ ዓይነት፣ አሮጌ እና አዲስ ዋጋዎች እና ለውጡን ያደረገውን ሰው ያሳያል።','Galmee tokkoon tokkoon maqaa meelataa, gosa sirreeffamaa, gatii durii fi haaraa, fi namna jijjiirama kana hojjete agarsiisa.','ነፍሲ ወከፍ ኣእታው ስም ዕቃ፣ ኣይነት ምትእርራይ፣ ኣረጊትን ሓዳስን ዋጋታት ከምኡውን ነቲ ምቕያር ዝገበረ ሰብ የርእይ እዩ።');
// === budget ===
t('Budget Management','የበጀት አስተዳደር','Bulchiinsa Baajetaa','ምሕደራ በጀት');
t('Plan and track spending','ወጪን ያቅዱ እና ይከታተሉ','Baasii karoorfadhuu fi hordofi','ወጻኢ ምድላውን ምክትታልን');
t('Budget Dashboard','የበጀት ዳሽቦርድ','Daashboordii Baajetaa','ዳሽቦርድ በጀት');
t('Create and manage budgets for your business. Track planned vs actual spending.','ለንግድዎ በጀቶችን ይፍጠሩ እና ያስተዳድሩ። የታቀደ እና ትክክለኛ ወጪን ይከታተሉ።','Daldala keetiif baajetota uumuu fi bulchi. Baasii karoorfamee fi dhugaa hordofi.','ንንግድኩም በጀታት ፍጠሩ ከምኡውን ኣመሓድሩ። እተዳለወን ሃቆን ወጻኢ ክታበሉ።');
t('Create a Budget','በጀት ይፍጠሩ','Baajeta Uumi','በጀት ፍጠሩ');
t('Tap to create a new budget. Set a name, type (business, department, project), period, and categories.','አዲስ በጀት ለመፍጠር ይንኩ። ስም፣ ዓይነት (ንግድ፣ ክፍል፣ ፕሮጀክት)፣ ጊዜ እና ምድቦች ያዘጋጁ።','Tuqi baajeta haaraa uumuuf. Maqaa, gosa (daldala, miseensa, piroojektii), yeroo, fi ramaddiiwwan galchi.','ሓድሽ በጀት ንምፍጣር ጠውቑ። ስም፣ ኣይነት (ንግዲ፣ ክፋል፣ ፕሮጀክት)፣ እዋን ከምኡውን መደባት ኣዘጋጅሉ።');
t('Budget Overview','የበጀት ግምገማ','Irradeebii Baajetaa','ጠቕላላ በጀት');

// =============================================
// PROCESS THE FILE
// =============================================

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

// English entries
function extractKeyValues(start, end) {
  const map = {};
  for (let i = start; i <= end; i++) {
    const m = lines[i].match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

const enEntries = extractKeyValues(sections.en.start, sections.en.end);

// Insert translations into a section
function translateSection(sectionName, translationMap, sourceLines) {
  const section = sections[sectionName];
  if (!section) { console.log('Section ' + sectionName + ' not found'); return; }

  const newLines = [];
  const insertedKeys = new Set();

  for (let i = section.start; i <= section.end; i++) {
    const line = sourceLines[i] || lines[i];
    const m = line.match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/);

    if (m && m[1].startsWith('tutorial.')) {
      const key = m[1];
      const enVal = enEntries[key];
      const translated = translationMap[enVal];

      if (translated && !insertedKeys.has(key)) {
        // Replace the English seed value with the translation
        const isLast = lines[i + 1] && lines[i + 1].trim() === '},' ? false : true;
        const comma = (i < section.end && !lines[i].trim().endsWith(',')) ? ',' : '';
        // If the line had a trailing comma, preserve it
        const hadComma = line.trim().endsWith(',');
        const escaped = translated.replace(/'/g, "\\'");
        newLines.push(line.replace(/'[^']*'/, "'" + escaped + "'"));
        insertedKeys.add(key);
      } else if (insertedKeys.has(key)) {
        // Skip duplicate keys
        continue;
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }

  // Check for missing entries
  const sectionKeys = Object.keys(enEntries).filter(k => k.startsWith('tutorial.'));
  for (const key of sectionKeys) {
    if (!insertedKeys.has(key)) {
      const enVal = enEntries[key];
      const translated = translationMap[enVal];
      if (translated) {
        const escaped = translated.replace(/'/g, "\\'");
        newLines.push(`  '${key}': '${escaped}',`);
        insertedKeys.add(key);
      }
    }
  }

  // Replace section content
  // newLines already spans from header to closing brace (section.start..section.end)
  const before = sourceLines.slice(0, section.start);
  const after = sourceLines.slice(section.end + 1);
  const result = before.concat(newLines, after);
  return result;
}

let result = lines;

// Process each non-English section in reverse order (last section first)
// so that adding lines to later sections doesn't shift indices of earlier ones.
const langOrder = ['ti', 'om', 'am'];
for (const lang of langOrder) {
  const map = { am, om, ti }[lang];
  console.log(`Processing ${lang}...`);
  const section = sections[lang];
  if (!section) { console.log(`Section ${lang} not found!`); continue; }

  // Count existing tutorial entries
  let existingCount = 0;
  for (let i = section.start; i <= section.end; i++) {
    if (lines[i].match(/^\s*'tutorial\./)) existingCount++;
  }
  console.log(`  Existing tutorial entries: ${existingCount}`);
  console.log(`  Translation map size: ${Object.keys(map).length}`);

  result = translateSection(lang, map, result);
}

// Write result
fs.writeFileSync(FILE + '.new', result.join('\n'), 'utf8');
console.log('Written to ' + FILE + '.new');
