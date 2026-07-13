const fs = require('fs');

// Read existing NDJSON if any, start fresh
const data = [];

function t(en, am, om, ti) {
  data.push({en, am, om, ti});
}

// Write data function  
function save() {
  fs.writeFileSync('scripts/translations-all.json', JSON.stringify(data, null, 2), 'utf8');
  console.log('Saved ' + data.length + ' entries');
}
