/**
 * Shega Mobile - Comprehensive Test Data Generator
 * 
 * This script generates realistic test data for all entities in the app.
 * It creates data at 4 scale levels: 100, 1,000, 10,000, and 100,000 records.
 * 
 * Usage: node __tests__/qa/generate_test_data.js [record_count]
 *   or:  node __tests__/qa/generate_test_data.js (defaults to 1000)
 * 
 * It generates a SQL file that can be executed against the shegabe.db database.
 */

const fs = require('fs');
const path = require('path');

// ==================== CONFIG ====================
const TARGET_COUNT = parseInt(process.argv[2] || '1000', 10);
const OUTPUT_FILE = `__tests__/qa/test_data_${TARGET_COUNT}.sql`;
const OUTPUT_CSV = `__tests__/qa/test_data_${TARGET_COUNT}.csv`;

console.log(`\n📦 Shega Test Data Generator`);
console.log(`   Target records: ${TARGET_COUNT.toLocaleString()}\n`);

// ==================== SEED DATA ====================
const CATEGORIES = [
  { name: 'Fasteners', icon: 'screw' },
  { name: 'Measuring & Layout', icon: 'ruler' },
  { name: 'Hardware', icon: 'tool' },
  { name: 'Paint & Supplies', icon: 'paint' },
  { name: 'Electrical', icon: 'zap' },
  { name: 'Plumbing', icon: 'pipe' },
  { name: 'Packing & Storage', icon: 'box' },
  { name: 'Cleaning Supplies', icon: 'spray' },
  { name: 'Safety & PPE', icon: 'shield' },
  { name: 'Building Materials', icon: 'brick' },
  { name: 'Grocery / Consumables', icon: 'shopping' },
  { name: 'Other', icon: 'more' },
];

const PRODUCT_TEMPLATES = [
  { name: 'Cement (50KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 550, cost: 480 },
  { name: 'Nail (5mm)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 25, cost: 18 },
  { name: 'Nail (10mm)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 35, cost: 25 },
  { name: 'Paint Red (4L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 3, price: 1200, cost: 900 },
  { name: 'Paint White (4L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 3, price: 1100, cost: 820 },
  { name: 'PVC Pipe 1"', unit: 'm', baseUnit: 'm', categoryIdx: 5, price: 150, cost: 110 },
  { name: 'PVC Pipe 2"', unit: 'm', baseUnit: 'm', categoryIdx: 5, price: 250, cost: 190 },
  { name: 'PVC Elbow 1"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 5, price: 45, cost: 30 },
  { name: 'Electrical Wire 1.5mm', unit: 'm', baseUnit: 'm', categoryIdx: 4, price: 85, cost: 60 },
  { name: 'Electrical Wire 2.5mm', unit: 'm', baseUnit: 'm', categoryIdx: 4, price: 140, cost: 105 },
  { name: 'Light Bulb LED 9W', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 180, cost: 130 },
  { name: 'Light Bulb LED 12W', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 220, cost: 165 },
  { name: 'Switch Socket', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 90, cost: 60 },
  { name: 'Measuring Tape 5m', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 120, cost: 80 },
  { name: 'Measuring Tape 10m', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 200, cost: 145 },
  { name: 'Spirit Level 60cm', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 350, cost: 250 },
  { name: 'Bolt M8', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 8, cost: 5 },
  { name: 'Bolt M10', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 12, cost: 7 },
  { name: 'Screw 2"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 3, cost: 1.5 },
  { name: 'Screw 4"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 5, cost: 3 },
  { name: 'Cooking Oil (3L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 10, price: 380, cost: 320 },
  { name: 'Milk Powder (400g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 250, cost: 195 },
  { name: 'Sugar (50KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 10, price: 2800, cost: 2400 },
  { name: 'Rice (10KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 10, price: 650, cost: 520 },
  { name: 'Pasta (500g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 45, cost: 32 },
  { name: 'Tomato Paste (500g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 85, cost: 60 },
  { name: 'Sandpaper Grit 120', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 3, price: 35, cost: 22 },
  { name: 'Steel Wire (2mm)', unit: 'm', baseUnit: 'm', categoryIdx: 2, price: 55, cost: 38 },
  { name: 'Wood Glue (1L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 2, price: 180, cost: 130 },
  { name: 'Masking Tape', unit: 'roll', baseUnit: 'pieces', categoryIdx: 3, price: 65, cost: 42 },
  { name: 'Hand Soap (5L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 7, price: 350, cost: 270 },
  { name: 'Bleach (1L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 7, price: 80, cost: 55 },
  { name: 'Safety Gloves', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 120, cost: 85 },
  { name: 'Safety Goggles', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 200, cost: 150 },
  { name: 'Hard Hat', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 380, cost: 280 },
  { name: 'Bucket 10L', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 150, cost: 100 },
  { name: 'Mop', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 95, cost: 65 },
  { name: 'Broom', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 70, cost: 45 },
  { name: 'Ceramic Tile 30x30', unit: 'sqm', baseUnit: 'sqm', categoryIdx: 9, price: 450, cost: 350 },
  { name: 'Ceramic Tile 60x60', unit: 'sqm', baseUnit: 'sqm', categoryIdx: 9, price: 750, cost: 580 },
  { name: 'Adhesive Cement', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 180, cost: 130 },
  { name: 'Plaster (25KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 220, cost: 165 },
  { name: 'Steel Rebar 12mm', unit: 'm', baseUnit: 'm', categoryIdx: 9, price: 320, cost: 250 },
  { name: 'Steel Rebar 16mm', unit: 'm', baseUnit: 'm', categoryIdx: 9, price: 450, cost: 360 },
  { name: 'Water Tank 500L', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 5, price: 3500, cost: 2800 },
  { name: 'Water Tank 1000L', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 5, price: 5500, cost: 4400 },
  { name: 'Generator 2.5kVA', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 12500, cost: 10000 },
  { name: 'Generator 5kVA', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 22000, cost: 18000 },
  { name: 'Wheelbarrow', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 1800, cost: 1400 },
  { name: 'Shovel', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 350, cost: 250 },
  { name: 'Pickaxe', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 500, cost: 380 },
];

const CUSTOMER_FIRST_NAMES = [
  'Abebe', 'Almaz', 'Biruk', 'Chaltu', 'Daniel', 'Eden', 'Fikadu', 'Genet',
  'Haile', 'Iman', 'Jemal', 'Kebede', 'Lemlem', 'Mekdes', 'Negasi', 'Oumer',
  'Piriam', 'Rahel', 'Solomon', 'Tigist', 'Umer', 'Winta', 'Yonas', 'Zewditu',
  'Amanuel', 'Birtukan', 'Dawit', 'Eyerusalem', 'Frehiwot', 'Girma',
  'Hanna', 'Issac', 'Kalid', 'Liya', 'Mulatu', 'Nardos', 'Samuel', 'Tsion',
];

const CUSTOMER_LAST_NAMES = [
  '', 'Kebede', 'Mekonnen', 'Tesfaye', 'Wondimu', 'Abera', 'Belay',
  'Demissie', 'Eshetu', 'Fekadu', 'Getachew', 'Hailu', 'Lemma',
  'Mengistu', 'Nigussie', 'Shiferaw', 'Tadesse', 'Worku', 'Zeleke',
];

const PHONE_PREFIXES = ['0911', '0912', '0913', '0921', '0930', '0940', '0955', '0960', '0970', '0980'];

const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salary', 'Transport', 'Marketing', 'Equipment',
  'Maintenance', 'Insurance', 'Tax', 'Inventory Purchase', 'Miscellaneous',
];

const SUPPLIER_COMPANIES = [
  'Ethio Builders PLC', 'Addis Industrial Supply', 'Mesfin Industrial Engineering',
  'National Oil Ethiopia', 'Habesha Cement S.C.', 'Dashen Brewery S.C.',
  'East African Holding', 'Almeda Textile', 'Mohammed International',
  'Nyala Motors', 'BGI Ethiopia', 'Heineken Breweries',
];

const SPECIAL_CHARS_PAYLOADS = [
  "' OR '1'='1",  // SQL injection
  '<script>alert(1)</script>',  // XSS
  '""; DROP TABLE sales; --',   // SQL injection 2
  'test@example.com\nadmin',    // newline injection
  'a'.repeat(10000),            // 10K char string
  '🔥🚀💯✅❌',                   // emoji
  'null', 'undefined', 'NaN',
  '①②③④⑤⑥⑦⑧⑨⑩',              // unicode
];

// ==================== HELPERS ====================
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, decimals = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const pick = (arr) => arr[rand(0, arr.length - 1)];
const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
};
const randomDate = (startYear, endYear) => {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
};
const fmtDate = (d) => d.toISOString().split('T')[0];
const fmtDateTime = (d) => d.toISOString().replace('T', ' ').split('.')[0];
const generatePhone = () => pick(PHONE_PREFIXES) + rand(100000, 999999).toString();
const generateCustomerName = () => {
  const first = pick(CUSTOMER_FIRST_NAMES);
  const last = pick(CUSTOMER_LAST_NAMES);
  return last ? `${first} ${last}` : first;
};

// ==================== MAIN GENERATOR ====================
const statements = [];
const csvLines = [];
let rowId = 0;

statements.push('-- ============================================');
statements.push(`-- Shega Mobile Test Data - ${TARGET_COUNT.toLocaleString()} Records`);
statements.push('-- Generated: ' + new Date().toISOString());
statements.push('-- ============================================\n');

// 1. INSERT CATEGORIES (always 12)
statements.push('-- 1. Categories');
CATEGORIES.forEach((cat, i) => {
  statements.push(`INSERT INTO categories (id, name, icon, isCustom) VALUES (${i + 1}, '${cat.name}', '${cat.icon}', 0);`);
  csvLines.push(`category,${i + 1},${cat.name},${cat.icon},0`);
});
statements.push('');

// Calculate entity counts
const itemCount = Math.min(TARGET_COUNT, 20000);
const saleCount = Math.min(Math.round(TARGET_COUNT * 2.5), 50000);
const expenseCount = Math.min(Math.round(TARGET_COUNT * 0.75), 15000);
const adjustmentCount = Math.min(Math.round(TARGET_COUNT * 0.5), 10000);
const returnCount = Math.min(Math.round(TARGET_COUNT * 0.2), 3888);
const packCount = Math.min(Math.round(TARGET_COUNT * 0.5), 10000);

console.log(`   Items: ${itemCount.toLocaleString()}`);
console.log(`   Sales: ${saleCount.toLocaleString()}`);
console.log(`   Expenses: ${expenseCount.toLocaleString()}`);
console.log(`   Adjustments: ${adjustmentCount.toLocaleString()}`);
console.log(`   Returns: ${returnCount.toLocaleString()}`);
console.log(`   Packs: ${packCount.toLocaleString()}`);
console.log('');

// 2. INSERT ITEMS
statements.push('-- 2. Items');
const categoryIds = CATEGORIES.map((_, i) => i + 1);
const itemIds = [];
const itemMap = {}; // id -> { name, categoryId, baseUnit, baseSellingPrice, totalBaseQuantity }

for (let i = 0; i < itemCount; i++) {
  const template = PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length];
  const categoryId = template ? (template.categoryIdx + 1) : pick(categoryIds);
  const catIdx = categoryId - 1;
  const companyName = i % 7 === 0 ? pick(SUPPLIER_COMPANIES) : (i % 13 === 0 ? '' : randomString(rand(3, 12)));
  const qualityGrade = ['Grade 1', 'Grade 2', 'Grade 3'][rand(0, 2)];
  let basePrice = template ? template.price + rand(-20, 50) : rand(10, 5000);
  const costPrice = template ? template.cost + rand(-10, 30) : rand(5, 4000);
  const packMultiplier = rand(5, 100);
  let stockQuantity = rand(0, 500);
  const isPack = i % 5 === 0;
  const unitsPerPack = isPack ? packMultiplier : 1;
  const createdAt = randomDate(2023, 2026);
  
  let name = i < PRODUCT_TEMPLATES.length 
    ? PRODUCT_TEMPLATES[i].name 
    : `${pick(['Premium', 'Standard', 'Economy', 'Pro', 'Deluxe', 'Super'])} ${template.name} ${rand(1, 999)}`;
  
  const id = i + 1;
  itemIds.push(id);
  itemMap[id] = {
    name,
    categoryId,
    baseUnit: template ? template.baseUnit : 'pieces',
    baseSellingPrice: Math.abs(basePrice),
    totalBaseQuantity: Math.abs(stockQuantity),
  };

  // Add edge cases for specific indices
  let notes = '';
  let expiryDate = 'NULL';
  let supplierPhone = 'NULL';
  let supplierAccount = 'NULL';
  let isCredit = 0;

  if (i === 0) {
    // Edge case: zero stock
    notes = "'Out of stock test'";
  } else if (i === 1) {
    // Edge case: negative price (will be caught by validation)
    basePrice = -50;
    notes = "'Price should be positive'";
  } else if (i === 2) {
    // Edge case: very long name
    name = 'A'.repeat(255);
    notes = "'Very long name test'";
  } else if (i === 3) {
    // Edge case: SQL injection in name
    name = "test ' OR '1'='1";
    notes = "'SQL injection test'";
  } else if (i === 4) {
    // Edge case: special characters
    name = '🔥🚀🏆✨⭐ Special ★ Item ☆';
  } else if (i === 5) {
    // Edge case: huge quantity
    stockQuantity = 999999999;
    notes = "'Edge case: extremely large quantity'";
  } else if (i === 6) {
    // Edge case: expiry date in the past
    expiryDate = "'2020-01-01'";
    notes = "'Already expired item'";
  } else if (i === 7) {
    // Supplier credit item
    isCredit = 1;
    supplierPhone = `'${generatePhone()}'`;
    supplierAccount = `'ACC${rand(10000, 99999)}'`;
    notes = "'Supplier credit test'";
  } else if (i === 20) {
    // Emoji in notes
    notes = "'🔥🔥🔥 HOT SALE ITEM 🔥🔥🔥'";
  }

  const purchaseUnit = template ? template.unit : 'pieces';
  const baseUnit = template ? template.baseUnit : 'pieces';

  statements.push(
    `INSERT INTO items (id, name, categoryId, companyName, purchaseUnit, baseUnit, unitsPerPack, ` +
    `totalPackQuantity, totalBaseQuantity, packPurchasePrice, basePurchasePrice, ` +
    `baseSellingPrice, packSellingPrice, allowSellByBaseUnit, allowSellByPackUnit, ` +
    `expiryDate, qualityGrade, notes, isCredit, supplierPhone, supplierAccount, createdAt) ` +
    `VALUES (${id}, '${escapeSQL(name)}', ${categoryId}, '${escapeSQL(companyName)}', ` +
    `'${purchaseUnit}', '${baseUnit}', ${unitsPerPack}, ` +
    `${Math.floor(stockQuantity / unitsPerPack)}, ${stockQuantity}, ` +
    `${Math.abs(costPrice * packMultiplier)}, ${Math.abs(costPrice)}, ` +
    `${Math.abs(basePrice)}, ${Math.abs(basePrice * packMultiplier)}, ` +
    `${isPack ? 0 : 1}, ${isPack ? 1 : 0}, ` +
    `${expiryDate}, '${qualityGrade}', ${notes}, ${isCredit}, ${supplierPhone}, ${supplierAccount}, '${fmtDateTime(createdAt)}');`
  );

  csvLines.push(`item,${id},${escapeCSV(name)},${categoryId},${stockQuantity},${Math.abs(basePrice)},${fmtDateTime(createdAt)}`);
}
statements.push('');

// 3. INSERT SALES
statements.push('-- 3. Sales');
const saleIds = [];
const saleData = {}; // id -> { itemId, quantity, unitType, totalPrice, createdAt, customerName }

for (let i = 0; i < saleCount; i++) {
  const itemId = pick(itemIds);
  const item = itemMap[itemId];
  if (!item) continue;
  
  const id = i + 1;
  saleIds.push(id);
  
  const isPackSale = i % 10 === 0;
  const qty = isPackSale ? rand(1, 20) : rand(1, 100);
  const unitPrice = item.baseSellingPrice * (isPackSale ? rand(5, 50) : 1);
  const discount = i % 7 === 0 ? randFloat(10, 100) : (i % 15 === 0 ? 0 : randFloat(0, 50));
  const vat = i % 10 === 0 ? 0 : randFloat(0, 15);
  const totalPrice = Math.max(0, qty * unitPrice - discount);
  const paymentMethods = ['Cash', 'Bank', 'Debt'];
  const paymentMethod = i % 15 === 0 ? pick(['Cash', 'Bank']) : (i % 25 === 0 ? 'Bank' : 'Cash');
  const isDebt = i % 8 === 0;
  const paymentStatus = isDebt ? 'Debt' : 'Paid';
  const customerName = isDebt ? generateCustomerName() : (i % 20 === 0 ? generateCustomerName() : '');
  const customerPhone = customerName ? generatePhone() : '';
  const unitType = isPackSale ? 'pack' : 'base';
  const unit = isPackSale ? (item.purchaseUnit || 'pcs') : (item.baseUnit || 'pcs');
  const createdAt = randomDate(2023, 2026);
  const dueDate = isDebt ? randomDate(2025, 2026) : null;
  const paidAmount = isDebt ? randFloat(0, totalPrice * 0.5) : totalPrice;
  
  saleData[id] = { itemId, quantity: qty, unitType, totalPrice, createdAt, customerName };

  statements.push(
    `INSERT INTO sales (id, itemId, quantity, unit, unitType, discount, vat, totalPrice, ` +
    `paymentMethod, paymentStatus, customerName, customerPhone, dueDate, paidAmount, createdAt) ` +
    `VALUES (${id}, ${itemId}, ${qty}, '${unit}', '${unitType}', ${discount}, ${vat}, ` +
    `${totalPrice}, '${paymentMethod}', '${paymentStatus}', ` +
    `'${escapeSQL(customerName)}', '${customerPhone}', ` +
    `${dueDate ? "'" + fmtDate(dueDate) + "'" : 'NULL'}, ${paidAmount}, '${fmtDateTime(createdAt)}');`
  );

  csvLines.push(`sale,${id},${itemId},${qty},${totalPrice},${paymentMethod},${paymentStatus},${fmtDateTime(createdAt)}`);
}
statements.push('');

// 4. INSERT EXPENSES
statements.push('-- 4. Expenses');
const expenseIds = [];
for (let i = 0; i < expenseCount; i++) {
  const id = i + 1;
  expenseIds.push(id);
  const name = pick(EXPENSE_CATEGORIES) + ' - ' + rand(1000, 9999);
  const amount = randFloat(50, 50000);
  const category = pick(EXPENSE_CATEGORIES);
  const date = randomDate(2023, 2026);
  const isRecurring = i % 10 === 0 ? 1 : 0;
  const frequency = isRecurring ? pick(['daily', 'weekly', 'monthly', 'yearly']) : 'NULL';
  const nextBillingDate = isRecurring ? randomDate(2026, 2027) : null;
  const createdAt = date;

  statements.push(
    `INSERT INTO expenses (id, name, amount, category, date, isRecurring, frequency, nextBillingDate, createdAt) ` +
    `VALUES (${id}, '${escapeSQL(name)}', ${amount}, '${category}', '${fmtDate(date)}', ` +
    `${isRecurring}, ${frequency ? "'" + frequency + "'" : 'NULL'}, ` +
    `${nextBillingDate ? "'" + fmtDate(nextBillingDate) + "'" : 'NULL'}, '${fmtDateTime(createdAt)}');`
  );

  csvLines.push(`expense,${id},${escapeCSV(name)},${amount},${category},${fmtDate(date)},${isRecurring}`);
}
statements.push('');

// 5. INSERT ADJUSTMENTS
statements.push('-- 5. Adjustments');
const adjIds = [];
for (let i = 0; i < adjustmentCount; i++) {
  const id = i + 1;
  adjIds.push(id);
  const itemId = pick(itemIds);
  const item = itemMap[itemId];
  const types = ['price_up', 'price_down', 'damaged'];
  const type = pick(types);
  const oldValue = item ? item.baseSellingPrice : 100;
  let newValue = type === 'price_up' ? oldValue * randFloat(1.05, 1.5) : 
                 type === 'price_down' ? oldValue * randFloat(0.5, 0.95) : oldValue;
  const quantity = type === 'damaged' ? rand(1, 10) : null;
  const unitType = type === 'damaged' ? 'base' : null;
  const reasons = [
    'Market Shift', 'Supplier Update', 'Policy Change', 'Promo End',
    'Broken', 'Expired', 'Defective', 'Water Damage', 'Manual Correction',
  ];
  const reason = pick(reasons);
  const date = randomDate(2023, 2026);
  const createdAt = date;

  statements.push(
    `INSERT INTO adjustments (id, itemId, type, oldValue, newValue, quantity, unitType, reason, date, createdAt) ` +
    `VALUES (${id}, ${itemId}, '${type}', ${oldValue}, ${Math.round(newValue * 100) / 100}, ` +
    `${quantity !== null ? quantity : 'NULL'}, ${unitType ? "'" + unitType + "'" : 'NULL'}, ` +
    `'${reason}', '${fmtDate(date)}', '${fmtDateTime(createdAt)}');`
  );

  csvLines.push(`adjustment,${id},${itemId},${type},${oldValue},${newValue},${quantity !== null ? quantity : ''},${reason},${fmtDate(date)}`);
}
statements.push('');

// 6. INSERT RETURNS
statements.push('-- 6. Returns');
for (let i = 0; i < returnCount; i++) {
  const id = i + 1;
  const saleId = pick(saleIds);
  const sale = saleData[saleId];
  if (!sale) continue;
  const itemId = sale.itemId;
  const quantity = Math.min(rand(1, 5), sale.quantity);
  const totalRefund = quantity * (sale.totalPrice / sale.quantity);
  const reasons = ['Customer request', 'Damaged', 'Wrong item', 'Expired', 'Defective'];
  const reason = pick(reasons);
  const createdAt = new Date(new Date(sale.createdAt).getTime() + rand(1, 30) * 86400000);

  statements.push(
    `INSERT INTO returns (id, saleId, itemId, quantity, unit, unitType, totalRefund, reason, returnDate, createdAt) ` +
    `VALUES (${id}, ${saleId}, ${itemId}, ${quantity}, '${sale.unitType === 'pack' ? 'pack' : 'pcs'}', ` +
    `'${sale.unitType}', ${totalRefund}, '${reason}', '${fmtDate(createdAt)}', '${fmtDateTime(createdAt)}');`
  );

  csvLines.push(`return,${id},${saleId},${itemId},${quantity},${totalRefund},${reason},${fmtDate(createdAt)}`);
}
statements.push('');

// 7. INSERT ITEM_PACKS
statements.push('-- 7. Item Packs');
for (let i = 0; i < packCount; i++) {
  const itemId = pick(itemIds);
  const item = itemMap[itemId];
  if (!item) continue;
  const packNumber = rand(1, 50);
  const initialQty = rand(10, 200);
  const currentQty = rand(0, initialQty);
  const unit = item.baseUnit || 'pieces';
  const statuses = ['Not Opened', 'Opened', 'Depleted'];
  const status = currentQty === 0 ? 'Depleted' : (currentQty < initialQty * 0.5 ? 'Opened' : 'Not Opened');

  statements.push(
    `INSERT INTO item_packs (id, itemId, packNumber, initialQuantity, currentQuantity, unit, status) ` +
    `VALUES (${i + 1}, ${itemId}, ${packNumber}, ${initialQty}, ${currentQty}, '${unit}', '${status}');`
  );

  csvLines.push(`pack,${i + 1},${itemId},${packNumber},${initialQty},${currentQty},${status}`);
}
statements.push('');

// 8. Edge case tests - special records that test boundaries
statements.push('-- 8. Special Edge Case Records');
statements.push('-- Test: Zero quantity sale');
try {
  statements.push(
    `INSERT INTO sales (id, itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, createdAt) ` +
    `VALUES (${saleCount + 100}, ${pick(itemIds)}, 0, 'pcs', 'base', 0, 0, 0, 'Cash', 'Paid', '${fmtDateTime(new Date())}');`
  );
} catch(e) {}

statements.push('-- Test: Negative price sale');
try {
  statements.push(
    `INSERT INTO sales (id, itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, createdAt) ` +
    `VALUES (${saleCount + 101}, ${pick(itemIds)}, 1, 'pcs', 'base', 0, 0, -100, 'Cash', 'Paid', '${fmtDateTime(new Date())}');`
  );
} catch(e) {}

statements.push('-- Test: SQL injection in customer name');
try {
  statements.push(
    `INSERT INTO sales (id, itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, createdAt) ` +
    `VALUES (${saleCount + 102}, ${pick(itemIds)}, 1, 'pcs', 'base', 0, 0, 100, 'Cash', 'Debt', '${SPECIAL_CHARS_PAYLOADS[0]}', '${fmtDateTime(new Date())}');`
  );
} catch(e) {}

statements.push('-- Test: 100% discount (free item)');
try {
  statements.push(
    `INSERT INTO sales (id, itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, createdAt) ` +
    `VALUES (${saleCount + 103}, ${pick(itemIds)}, 5, 'pcs', 'base', ${pick(itemIds) * 1000}, 0, 0, 'Cash', 'Paid', '${fmtDateTime(new Date())}');`
  );
} catch(e) {}

// Add a few more edge case items
for (let i = 0; i < 5; i++) {
  const specialId = itemCount + 100 + i;
  statements.push(
    `INSERT INTO items (id, name, categoryId, totalBaseQuantity, baseSellingPrice, baseUnit, createdAt) ` +
    `VALUES (${specialId}, '${SPECIAL_CHARS_PAYLOADS[i % SPECIAL_CHARS_PAYLOADS.length]}', ${i + 1}, 0, 0, 'pcs', '${fmtDateTime(new Date())}');`
  );
}

statements.push('\n-- ============================================');
statements.push(`-- End of test data. Total INSERT statements: ${statements.length - 1}`);
statements.push('-- ============================================');

// Write files
fs.writeFileSync(OUTPUT_FILE, statements.join('\n'));
fs.writeFileSync(OUTPUT_CSV, csvLines.join('\n'));

console.log(`✅ SQL file written: ${OUTPUT_FILE}`);
console.log(`   File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
console.log(`   Total SQL statements: ${statements.length - 1}`);
console.log(`   CSV file written: ${OUTPUT_CSV}`);
console.log(`   CSV lines: ${csvLines.length}`);
console.log('\n📋 Data Summary:');
console.log(`   Categories: ${CATEGORIES.length}`);
console.log(`   Items: ${itemCount}`);
console.log(`   Sales: ${saleCount}`);
console.log(`   Expenses: ${expenseCount}`);
console.log(`   Adjustments: ${adjustmentCount}`);
console.log(`   Returns: ${returnCount}`);
console.log(`   Item Packs: ${packCount}`);
console.log('');

// ==================== ESCAPE HELPERS ====================
function escapeSQL(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

function escapeCSV(str) {
  if (typeof str !== 'string') return str;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

console.log('✅ Test data generation complete!\n');