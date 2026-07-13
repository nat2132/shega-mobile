const fs = require('fs');
const batch = process.argv[2]; // batch number
const entries = JSON.parse(fs.readFileSync('scripts/translations-all.json', 'utf8'));
function t(en, am, om, ti) { entries.push({en, am, om, ti}); }

// ==== START BATCH ' + batch + ' ====
