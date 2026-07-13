const fs = require('fs');
let c = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');
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
    const m = t.match(/^'(tutorial\.[^']+)':\s*'((?:[^'\\]|\\.)*)'/);
    if (m) tutorialKeys.push({ key: m[1], val: m[2] });
    if (bc <= 0) break;
  }
}

// Load EN values for each key
const enVals = {};
for (const k of tutorialKeys) { enVals[k.key] = k.val; }

// Define overlay/menu translations (no apostrophes in any)
const overlay = {
  'tutorial.resume': { am: '\u1240\u1305\u120D', om: 'Itti fufi', ti: '\u1240\u128D\u120D' },
  'tutorial.skip': { am: '\u12D5\u1208\u120D', om: 'Darbi', ti: '\u12D5\u1208\u120D' },
  'tutorial.paused_title': { am: '\u121B\u1305\u1293\u12A8\u122D\u12EA \u126A\u134D\u1235\u120D', om: 'Tutorial Dhaabameera', ti: '\u121D\u121D\u1212\u122D\u12AE \u1240\u12C1\u122D\u12F0\u130D' },
  'tutorial.paused_desc': { am: '\u121B\u1305\u1293\u12A8\u122D\u12EA\u1205 \u126A\u134D\u1235\u120D\u1362 \u1208\u1218\u1240\u1274\u120D \u1240\u1305\u120D \u12E8\u121A\u1208\u1295 \u12ED\u1333\u1295\u1362', om: 'Tutorial kee dhaabameera. Itti fufuuf Itti fufi tuqui.', ti: '\u121D\u121D\u1212\u122D\u12AE\u12BB \u1240\u12C1\u122D\u12F0\u130D \u12A3\u120E\u1362 \u1295\u121D\u1240\u127C\u120D \u1240\u1305\u120D \u1300\u1275\u1265' },
  'tutorial.complete_title': { am: '\u121B\u1305\u1293\u12A8\u122D\u12EA \u1270\u1305\u1293\u1265\u12CB\u120D!', om: 'Tutorial Xumurameera!', ti: '\u121D\u121D\u1212\u122D\u12AE \u1270\u12B2\u121A\u12AE!' },
  'tutorial.complete_desc': { am: '{name} \u1295 \u1270\u121D\u122D\u12CB\u12CB\u120D!', om: '{name} barattee jirta!', ti: '{name} \u1270\u121B\u1212\u122D\u12AB!' },
  'tutorial.restart': { am: '\u12A5\u1295\u12F0\u1308\u129B \u1300\u121D\u122D', om: 'Irra deebii', ti: '\u12F3\u130D\u121B\u12ED \u1300\u121D\u122D' },
  'tutorial.close': { am: '\u12D5\u130B', om: 'Cufi', ti: '\u12D5\u130E\u1275' },
  'tutorial.done': { am: '\u1270\u12A8\u1293\u12CB\u1245\u120D', om: 'Xumurameera', ti: '\u1270\u12B2\u121A\u12AE' },
  'tutorial.next': { am: '\u1240\u1293\u12ED', om: 'Itti aanu', ti: '\u12D5\u1295\u1273\u122D' },
  'tutorial.action_done': { am: '\u2713 \u1270\u12A8\u1293\u12CB\u1245\u120D!', om: '\u2713 Xumurameera!', ti: '\u2713 \u1270\u12B2\u121A\u12AE!' },
  'tutorial.action_tap': { am: '\u12E8\u12F0\u1218\u1240\u12A8\u1295 \u12AD\u134D\u120D \u12ED\u1295\u12AB', om: 'Qaama ifatti mulatu tuqui', ti: '\u12A0\u1275\u1271 \u12D5\u1265\u122D\u1205 \u12AD\u134D\u120D \u1300\u1275\u1265' },
  'tutorial.action_swipe': { am: '\u12E8\u12F0\u1218\u1240\u12A8\u1295 \u12A0\u12AB\u1263\u12EE \u12E3\u1295\u123D\u122D\u1271\u1275\u12EB', om: 'Naannoo ifatti mulatu sii\'i', ti: '\u12A0\u1275\u1271 \u12D5\u1265\u122D\u1205 \u12A8\u1263\u1264 \u1235\u1215\u1265' },
  'tutorial.action_type': { am: '\u1265\u12F0\u1218\u1240\u12A8\u1295 \u1218\u1235\u12AD \u12C5\u1235\u1323 \u12ED\u1333\u1348\u12EB', om: 'Dirree ifatti mulatu keessatti barreessi', ti: '\u12A0\u1275\u1271 \u12D5\u1265\u122D\u1205 \u1218\u122D\u130E\u1325 \u1308\u1233\u1355' },
  'tutorial.action_scroll': { am: '\u12E8\u12F0\u1218\u1240\u12A8\u1295 \u12A0\u12AB\u1263\u12EE \u12ED\u130E\u1271\u1275\u12EB', om: 'Naannoo ifatti mulatu garagagsi', ti: '\u12A0\u1275\u1271 \u12D5\u1265\u122D\u1205 \u12A8\u1263\u1264 \u1309\u1271\u1275' },
  'tutorial.menu_title': { am: '{name} \u121B\u1305\u1293\u12A8\u122D\u12EA', om: '{name} Tutorial', ti: '\u121D\u121D\u1212\u122D\u12AE {name}' },
  'tutorial.menu_completed': { am: '\u12ED\u1205\u1295 \u121B\u1305\u1293\u12A8\u122D\u12EA \u12A0\u1305\u1293\u1265\u12CB\u12CB\u120D! \u12A5\u1295\u12F0\u1308\u129B \u1208\u121B\u12D0\u1275 \u12E8\u121D\u12ED\u1235 \u1208\u1218\u1218\u1309\u1308\u1275 \u12ED\u127D\u120D\u120E\u1362', om: 'Tutorial kana xumurteetta! Irra deebi\u02bcuu ykn jalqabuun dandeessa.', ti: '\u1294\u12DA \u121D\u121D\u1212\u122D\u12AE \u12B2\u121A\u121A\u12CB\u12ED! \u12A8\u121D\u1265\u122D \u1295\u121D\u122A\u12D0\u1275 \u12E8\u121D\u122D\u12DD \u1275\u1295\u12AB\u120D \u12A5\u1295\u12AB' },
  'tutorial.menu_continue': { am: '\u12A8{step} \u12F0\u122D\u1303 \u1240\u1305\u120D', om: 'Tarkaanfii {step} irraa itti fufi', ti: '\u12A8\u1210\u12D5\u1228\u130D {step} \u1240\u1305\u120D' },
  'tutorial.menu_learn': { am: '\u12ED\u1205\u1295 \u1235\u12AB\u122D\u12A8\u1295 \u12A5\u1295\u12F0\u12B5\u1275 \u121D\u1275\u1260\u1275 \u12A8\u1208\u1206\u1265\u1275 \u12F0\u122D\u1303 \u1265\u12F0\u122D\u1303 \u12ED\u121B\u122D\u12EB\u1362', om: 'Akkataa iskiriinii kana itti fayyadamuu baradhu.', ti: '\u1294\u12DA \u1235\u12AB\u122D\u12A8\u1295 \u1265\u12A8\u1211\u12ED \u121D\u1271\u122D\u121D \u12A8\u1216\u1208\u1265\u1275 \u1210\u12D5\u1228\u130D \u1265\u1210\u12D5\u1228\u130D \u1270\u121D\u1212\u122D\u1362' },
  'tutorial.menu_continue_btn': { am: '\u1240\u1305\u120D ({current}/{total})', om: 'Itti fufi ({current}/{total})', ti: '\u1240\u1305\u120D ({current}/{total})' },
  'tutorial.menu_start': { am: '\u121B\u1305\u1293\u12A8\u122D\u12EA \u1300\u121D\u122D', om: 'Tutorial Jalqabi', ti: '\u121D\u121D\u1212\u122D\u12AE \u1300\u121D\u122D' },
};

// Tutorial name translations (no apostrophes)
const tutNames = {
  'activity-ledger': { am: '\u12E8\u12A5\u1295\u1275\u1235\u1293\u1234 \u1218\u12D9\u1308', om: 'Galmea Gochaa', ti: '\u1218\u12D9\u1308 \u1295\u130D\u1348\u1270\u1275' },
  'add-order-item': { am: '\u12E8\u1270\u12A5\u12B2\u12DD \u12A5\u1240 \u1300\u121D\u122D', om: 'Meshaa Ajajaa Dabali', ti: '\u1293\u1275\u1271 \u1270\u12A5\u12B2\u12DD \u12CB\u1235\u12AB' },
  'adjustment': { am: '\u121B\u1235\u1270\u12AB\u12A8\u12EB', om: 'Sirreeffama', ti: '\u121D\u1275\u1295\u12D5\u1275' },
  'adjustment-history': { am: '\u12E8\u121B\u1235\u1270\u12AB\u12A8\u12EB \u1273\u122D\u12AD', om: 'Seenaa Sirreeffama', ti: '\u1273\u122D\u12AD \u121D\u1275\u1295\u12D5\u1275' },
  'budget': { am: '\u1265\u1300\u1275', om: 'Bajata', ti: '\u1265\u1300\u1275' },
  'collect-payments': { am: '\u12AD\u134D\u12EB \u1230\u1265\u1235\u1265', om: 'Kaffaltii Fudhu', ti: '\u12AD\u134D\u120A\u1275 \u12A0\u12A8\u1265\u1265' },
  'contact-details': { am: '\u12E8\u12A5\u12C5\u12ED\u12EB \u12D5\u122D\u12DD\u122D\u12AE\u1265', om: 'Ibsa Quunnamtii', ti: '\u12D5\u122D\u12DD\u122D \u1218\u120A\u120A\u12AB' },
  'contacts': { am: '\u12A5\u12C5\u12ED\u12EB\u12AE\u1265', om: 'Quunnamtii', ti: '\u1218\u120A\u120A\u12AB' },
  'create-budget': { am: '\u1265\u1300\u1275 \u134D\u1308\u122D', om: 'Bajata Uumi', ti: '\u1265\u1300\u1275 \u134D\u1308\u122D' },
  'create-order': { am: '\u1270\u12A5\u12B2\u12DD \u134D\u1308\u122D', om: 'Ajaja Uumi', ti: '\u1270\u12A5\u12B2\u12DD \u134D\u1308\u122D' },
  'damaged-item': { am: '\u12E8\u1270\u1265\u1208\u123D \u12A5\u1240', om: 'Meeshaa Miidhame', ti: '\u12DC\u1270\u1265\u1208\u1238\u12CB \u1293\u1275\u1271' },
  'dashboard': { am: '\u12F3\u123D\u1265\u122D\u12F5\u122D', om: 'Dashboard', ti: '\u12F3\u123D\u1265\u122D\u12F5\u122D' },
  'date-time': { am: '\u1240\u1295 \u12A5\u1293 \u1230\u12C3\u1275 \u1275\u1295\u130D\u1275\u12AE\u1265', om: 'Sajoo Guyyaa fi Saaatii', ti: '\u1275\u1295\u130D\u1275\u1275 \u12D5\u1208\u1275\u1295 \u1230\u12C3\u1275\u1295' },
  'debt-detail': { am: '\u12E8\u12D5\u12F3 \u12D5\u122D\u12DD\u122D', om: 'Ibsa Liqii', ti: '\u12D5\u122D\u12DD\u122D \u12D5\u12F3' },
  'debt-list': { am: '\u12E8\u12D5\u12F3 \u12D5\u122D\u12DD\u122D', om: 'Tarree Liqii', ti: '\u12D5\u122D\u12DD\u122D \u12D5\u12F3' },
  'debt-management': { am: '\u12E8\u12D5\u12F3 \u12A0\u1235\u1270\u12F3\u12F0\u122D', om: 'Bulchiinsa Liqii', ti: '\u121D\u1275\u12F0\u122D\u12EB \u12D5\u12F3' },
  'expense': { am: '\u12CB\u130E\u12AA', om: 'Baasii', ti: '\u12CB\u130E\u12A2\u1295' },
  'expense-details': { am: '\u12E8\u12CB\u130E\u12AA \u12D5\u122D\u12DD\u122D\u12AE\u1265', om: 'Ibsa Baasii', ti: '\u12D5\u122D\u12DD\u122D \u12CB\u130E\u12A2\u1295' },
  'expense-form': { am: '\u12E8\u12CB\u130E\u12AA \u1275\u132D', om: 'Foormaa Baasii', ti: '\u1275\u132A \u12CB\u130E\u12A2\u1295' },
  'expense-list': { am: '\u12E8\u12CB\u130E\u12AA \u12D5\u122D\u12DD\u122D', om: 'Tarree Baasii', ti: '\u12D5\u122D\u12DD\u122D \u12CB\u130E\u12A2\u1295' },
  'expense-loss': { am: '\u12CB\u130E\u12AA \u12A5\u1293 \u12AA\u1233\u122D', om: 'Baasii fi Hada', ti: '\u12CB\u130E\u12A2\u1295\u1295 \u12AA\u1233\u122D\u1295' },
  'inventory': { am: '\u12AD\u121D\u1275\u12F5\u1275', om: 'Meeshaalee', ti: '\u12AD\u121D\u1275\u12F5\u1275' },
  'inventory-form': { am: '\u12E8\u12AD\u121D\u1275\u12F5\u1275 \u1275\u132D', om: 'Foormaa Meeshaa', ti: '\u1275\u132A \u12AD\u121D\u1275\u12F5\u1275' },
  'inventory-records': { am: '\u12E8\u12AD\u121D\u1275\u12F5\u1275 \u1218\u12D9\u130D\u1265\u1275', om: 'Galmee Meeshaalee', ti: '\u1218\u12D9\u1308\u1275 \u12AD\u121D\u1275\u12F5\u1275' },
  'item-details': { am: '\u12E8\u12A5\u1240 \u12D5\u122D\u12DD\u122D\u12AE\u1265', om: 'Ibsa Meeshaa', ti: '\u12D5\u122D\u12DD\u122D \u1293\u1275\u1271' },
  'low-stock-list': { am: '\u12DC\u1275\u1270\u1295\u12EB \u12AD\u121D\u1275\u12F5\u1275', om: 'Tarree Meeshaa Xiqqaa', ti: '\u12CB\u1215\u12F5 \u12AD\u121D\u1275\u12F5\u1275' },
  'notification-settings': { am: '\u12E8\u121B\u1233\u12CB\u12ED\u12EB \u1275\u1295\u130D\u1275\u12AE\u1265', om: 'Sajoo Beeksisaa', ti: '\u1275\u1295\u130D\u1275\u1275 \u1218\u134D\u1208\u132A' },
  'notifications': { am: '\u121B\u1233\u12CB\u12ED\u12EB\u12AE\u1265', om: 'Beeksisaa', ti: '\u1218\u134D\u1208\u132A\u1275\u1275' },
  'oncredit-list': { am: '\u1265\u12D5\u12F3 \u12D5\u122D\u12DD\u122D', om: 'Tarree Liqaan', ti: '\u1265\u12D5\u12F3 \u12D5\u122D\u12DD\u122D' },
  'order-detail': { am: '\u12E8\u1270\u12A5\u12B2\u12DD \u12D5\u122D\u12DD\u122D', om: 'Ibsa Ajajaa', ti: '\u12D5\u122D\u12DD\u122D \u1270\u12A5\u12B2\u12DD' },
  'orders': { am: '\u1270\u12A5\u12B2\u12DD\u12AE\u1265', om: 'Ajaja', ti: '\u1270\u12A5\u12B2\u12DD\u1275' },
  'pending-sales': { am: '\u12E3\u120D\u1270\u1305\u1293\u1240\u1281\u12AE \u123D\u12EB\u130C\u12AE\u1265', om: 'Gurgurtaa Hanga Hin Xumuramne', ti: '\u12E8\u12ED\u1270\u12B2\u121A\u12AE \u123D\u12EB\u130C\u1275' },
  'price-decrease': { am: '\u12E8\u12CB\u130B \u1275\u1293\u123D', om: 'Gatii Hiruu', ti: '\u121D\u1275\u1275\u1275\u1275 \u12CB\u130B' },
  'price-increase': { am: '\u12E8\u12CB\u130B \u130C\u121B\u122D\u12AA', om: 'Gatii Dabaluu', ti: '\u121D\u12CB\u1235\u12AB \u12CB\u130B' },
  'profile-settings': { am: '\u12E8\u1218\u1308\u1208\u134A \u1275\u1295\u130D\u1275\u12AE\u1265', om: 'Sajoo Pirootaayilii', ti: '\u1275\u1295\u130D\u1275\u1275 \u1218\u130D\u1208\u132A' },
  'reminders': { am: '\u12A0\u1235\u1273\u12CB\u1234\u12AE\u1265', om: 'Yaadachiisota', ti: '\u1218\u12E8\u1295\u12A8\u122D\u12EA\u1275' },
  'sale-form': { am: '\u12E8\u123D\u12EB\u130C \u1275\u132D', om: 'Foormaa Gurgurtaa', ti: '\u1275\u132A \u123D\u12EB\u130C' },
  'sales-details': { am: '\u12E8\u123D\u12EB\u130C \u12D5\u122D\u12DD\u122D\u12AE\u1265', om: 'Ibsa Gurgurtaa', ti: '\u12D5\u122D\u12DD\u122D \u123D\u12EB\u130C' },
  'sales-hub': { am: '\u12E8\u123D\u12EB\u130C \u121B\u12A5\u12A8\u120D', om: 'Buca Gurgurtaa', ti: '\u121B\u12A5\u12A8\u120D \u123D\u12EB\u130C' },
  'sales-records': { am: '\u12E8\u123D\u12EB\u130C \u1218\u12D9\u130D\u1265\u1275', om: 'Galmee Gurgurtaa', ti: '\u1218\u12D9\u1308\u1275 \u123D\u12EB\u130C' },
  'security-settings': { am: '\u12E8\u12F0\u1205\u1295\u1294\u1275 \u1275\u1295\u130D\u1275\u12AE\u1265', om: 'Sajoo Nageenyaa', ti: '\u1275\u1295\u130D\u1275\u1275 \u12F5\u1205\u1295\u1294\u1275' },
  'settings': { am: '\u1275\u1295\u130D\u1275\u12AE\u1265', om: 'Sajoo', ti: '\u1275\u1295\u130D\u1275\u1275' },
  'summary': { am: '\u121B\u1305\u1275\u1240\u120A\u12EB', om: 'Cuunfaa', ti: '\u1300\u1275\u120A\u120A' },
  'support': { am: '\u12F5\u130D\u134D', om: 'Deeggarsa', ti: '\u12F0\u130E\u134D' },
  'translation': { am: '\u12E8\u1241\u1295\u1295\u130B \u1275\u1295\u130D\u1275\u12AE\u1265', om: 'Sajoo Afaanii', ti: '\u1275\u1295\u130D\u1275\u1275 \u1241\u1295\u1295\u130B' },
  'warehouse-manager': { am: '\u12E8\u1218\u130B\u12E8\u1295 \u12A0\u1235\u1270\u12F3\u12F3\u122D\u12AA', om: 'Bulchaa Makasinaa', ti: '\u12A0\u121B\u1212\u12F0\u12F2\u122D\u12AA \u1218\u1295\u12E8\u1295' },
  'warehouse-settings': { am: '\u12E8\u1218\u130B\u12E8\u1295 \u1275\u1295\u130D\u1275\u12AE\u1265', om: 'Sajoo Makasinaa', ti: '\u1275\u1295\u130D\u1275\u1275 \u1218\u1295\u12E8\u1295' },
};

// Subtitle translations
const tutSubtitles = {
  'activity-ledger': { am: '\u1209\u1208\u1295\u121D\u1295 \u12A5\u1295\u1275\u1235\u1293\u1234\u12AE\u1275 \u12ED\u1218\u120D\u12A8\u1275\u12EB', om: 'Gochaa hunda ilaali', ti: '\u1295\u130D\u1348\u1270\u1275 \u121B\u120D\u12A8\u1275' },
  'dashboard': { am: '\u12E8\u1295\u130D\u1265 \u1235\u122D\u12EB\u1295 \u1265\u12A0\u1295\u12F5 \u1265\u12CB\u1273\u1271\u1275\u12EB', om: 'Hojiin kee iddoo tokko keessatti toachi', ti: '\u1295\u130D\u1265\u12AB \u12A0\u1265 \u1205\u12F3 \u1265\u1273 \u1270\u1242\u133A\u130B\u122D' },
  'inventory': { am: '\u12AD\u121D\u1275\u12F5\u1275\u12EB\u1295 \u12E3\u1235\u1270\u12F3\u12F0\u122D\u12EB', om: 'Meeshaalee kee bulchi', ti: '\u12AD\u121D\u1275\u12F5\u1275\u12AB \u12A0\u121B\u1212\u12F0\u122D' },
  'sales-hub': { am: '\u123D\u12EB\u130C\u12AE\u1275\u1295 \u12ED\u1242\u133A\u130B\u122D\u12EB', om: 'Gurgurtaa toachi', ti: '\u123D\u12EB\u130C\u1275 \u1270\u1242\u133A\u130B\u122D' },
  'settings': { am: '\u12E8\u1218\u1270\u130D\u1265\u122D\u12EA \u1275\u1295\u130D\u1275\u12AE\u1265\u12EB\u1295 \u12E3\u1265\u1309', om: 'Sajoo appii kee fooyyessi', ti: '\u1275\u1295\u130D\u1275\u1275 \u1218\u1270\u130D\u1265\u122D\u12EA \u12A0\u121B\u1234\u121D\u122D\u12AE' },
  'expense': { am: '\u12CB\u130E\u12AA\u12AE\u1275\u1295 \u12ED\u12A8\u1273\u1270\u1208\u12EB', om: 'Baasii hordofi', ti: '\u12CB\u130E\u12A2\u1295\u1275 \u12A8\u1273\u1270\u1208' },
  'contacts': { am: '\u130D\u1295\u12A9\u1295\u12EB\u12EB\u1295 \u12E3\u1235\u1270\u12F3\u12F0\u122D\u12EB', om: 'Quunnamtii kee bulchi', ti: '\u1218\u120A\u120A\u12AB \u12A0\u121B\u1212\u12F0\u122D' },
  'summary': { am: '\u121B\u1305\u1275\u1240\u120A\u12EB \u122D\u128D\u122D\u1275\u12AE\u1265', om: 'Gabaasa Cuunfaa', ti: '\u1300\u1275\u120A\u120A \u122D\u128D\u122D\u1275\u1275' },
};

const defaultSub = { am: '\u12ED\u1205\u1295 \u1265\u1205\u122D\u12EA \u12A5\u1295\u12F0\u12B5\u1275 \u121D\u1275\u1260\u1275 \u12A8\u1208\u1206\u1265\u1275 \u12ED\u121B\u122D\u12EB\u1362', om: 'Akkataa amala kana itti fayyadamuu baradhu', ti: '\u1294\u12DA \u1265\u1205\u122D\u12EA \u12A8\u121A\u12ED \u130C\u122D\u12AB \u121D\u1271\u122D\u121D \u1270\u121D\u1212\u122D\u1362' };

const am = {};
const om = {};
const ti = {};

for (const k of tutorialKeys) {
  const key = k.key;
  const val = k.val;
  
  if (overlay[key]) {
    am[key] = overlay[key].am;
    om[key] = overlay[key].om;
    ti[key] = overlay[key].ti;
    continue;
  }
  
  const parts = key.split('.');
  if (parts.length >= 2) {
    const tutId = parts[1];
    const subKey = parts.slice(2).join('.');
    
    if (subKey === 'title' && tutNames[tutId]) {
      am[key] = tutNames[tutId].am;
      om[key] = tutNames[tutId].om;
      ti[key] = tutNames[tutId].ti;
    } else if (subKey === 'subtitle' && tutSubtitles[tutId]) {
      am[key] = tutSubtitles[tutId].am;
      om[key] = tutSubtitles[tutId].om;
      ti[key] = tutSubtitles[tutId].ti;
    } else if (subKey === 'subtitle') {
      am[key] = defaultSub.am;
      om[key] = defaultSub.om;
      ti[key] = defaultSub.ti;
    } else {
      am[key] = val;
      om[key] = val;
      ti[key] = val;
    }
  }
}

// Find section ends
function findSectionEnd(sn) {
  let inS = false, bc = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === sn + ': {') { inS = true; bc = 1; continue; }
    if (inS) {
      bc += (t.match(/{/g)||[]).length - (t.match(/}/g)||[]).length;
      if (bc <= 0) return i - 1;
    }
  }
  return -1;
}

function getExistingKeys(sn) {
  const ks = new Set();
  let inS = false, bc = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === sn + ': {') { inS = true; bc = 1; continue; }
    if (inS) {
      bc += (t.match(/{/g)||[]).length - (t.match(/}/g)||[]).length;
      const m = t.match(/'([^']+)':/);
      if (m) ks.add(m[1]);
      if (bc <= 0) break;
    }
  }
  return ks;
}

const sections = ['am', 'om', 'ti'];
const vals = { am, om, ti };
const insertPts = {};
for (const s of sections) { insertPts[s] = findSectionEnd(s); }

let result = '';
let added = 0;
for (let i = 0; i < lines.length; i++) {
  result += lines[i] + '\n';
  for (const s of sections) {
    if (i === insertPts[s]) {
      const exist = getExistingKeys(s);
      for (const k of tutorialKeys) {
        if (!exist.has(k.key)) {
          const v = vals[s][k.key];
          if (v !== undefined) {
            const escaped = v.replace(/'/g, "\\'");
            result += "    '" + k.key + "': '" + escaped + "',\n";
            added++;
          }
        }
      }
    }
  }
}

fs.writeFileSync('src/context/SettingsContext.tsx', result);
console.log('Added ' + added + ' tutorial keys');
