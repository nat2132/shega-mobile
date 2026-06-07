// Fix remaining TypeScript errors

const fs = require('fs');

// Fix generateTestData.ts - fix type mismatches
let genTestData = fs.readFileSync('src/database/generateTestData.ts', 'utf8');

// Fix null -> undefined for optional fields (lines 225, 229, 230)
genTestData = genTestData.replace(
  /expiryDate: i % 3 === 0 \? new Date\(2027, 5, 1\)\.toISOString\(\)\.split\('T'\)\[0\] : null,/,
  "expiryDate: i % 3 === 0 ? new Date(2027, 5, 1).toISOString().split('T')[0] : undefined,"
);
genTestData = genTestData.replace(
  /supplierPhone: null,/g,
  'supplierPhone: undefined,'
);
genTestData = genTestData.replace(
  /supplierAccount: null,/g,
  'supplierAccount: undefined,'
);

// Fix insertSale call - remove dueDate and createdAt (not in interface)
genTestData = genTestData.replace(
  /dueDate: isDebt \? fmtDate\(randomDateInRange\(2026, 2026\)\) : null,/g,
  ''
);
genTestData = genTestData.replace(
  /paidAmount: isDebt \? randFloat\(0, totalPrice \* 0\.3\) : totalPrice,\n\s+createdAt: fmtDateTime\(createdAt\),/g,
  'paidAmount: isDebt ? randFloat(0, totalPrice * 0.3) : totalPrice,'
);

// Fix insertExpense call - remove createdAt (not in interface)
genTestData = genTestData.replace(
  /createdAt: fmtDateTime\(date\),/g,
  ''
);

// Fix insertReturn call - take arguments
// First need to update the db.ts stub signature
let db = fs.readFileSync('src/database/db.ts', 'utf8');

// Fix insertPack to accept args
db = db.replace(
  /export const insertPack = \(\) => \{[^}]+\}/,
  `export const insertPack = (data: { itemId: number; packNumber: number; quantity: number; unit: string }) => {
  try {
    const database = getDB();
    return database.prepareSync(\`
      INSERT INTO item_packs (itemId, packNumber, quantity, unit)
      VALUES (?, ?, ?, ?)
    \`).executeSync([data.itemId, data.packNumber, data.quantity, data.unit]) as any;
  } catch (error) {
    console.error('Insert pack error:', error);
    return null;
  }
};`
);

// Fix insertReturn to accept args
db = db.replace(
  /export const insertReturn = \(\) => \{[^}]+\}/,
  `export const insertReturn = (data: { saleId: number; itemId: number; quantity: number; unit: string; unitType: string; totalRefund: number; reason: string; createdAt: string }) => {
  try {
    const database = getDB();
    return database.prepareSync(\`
      INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    \`).executeSync([data.saleId, data.itemId, data.quantity, data.unit, data.unitType, data.totalRefund, data.reason, data.createdAt]) as any;
  } catch (error) {
    console.error('Insert return error:', error);
    return null;
  }
};`
);

// Fix usePushNotifications.ts - fix useRef arguments
let pushNotif = fs.readFileSync('src/hooks/usePushNotifications.ts', 'utf8');
pushNotif = pushNotif.replace(
  /const notificationListener = useRef<any>();/g,
  'const notificationListener = useRef<any>(null);'
);
pushNotif = pushNotif.replace(
  /const responseListener = useRef<any>();/g,
  'const responseListener = useRef<any>(null);'
);

// Write all fixes
fs.writeFileSync('src/database/db.ts', db, 'utf8');
fs.writeFileSync('src/database/generateTestData.ts', genTestData, 'utf8');
fs.writeFileSync('src/hooks/usePushNotifications.ts', pushNotif, 'utf8');

console.log('Fixed generateTestData.ts, db.ts, and usePushNotifications.ts');
