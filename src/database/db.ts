import { fromEthiopianToDate, getEthiopianDaysInMonth, toEthiopianDate, toLocalDateString } from '@/utils/date-utils';
import { sha256Hex } from '@/utils/sha256';
import * as SQLite from 'expo-sqlite';

const GLOBAL_DB_KEY = '__shega_db';
const DB_NAME = 'shegabe.db';
const DEMO_DB_NAME = 'shegabe_demo.db';

let db: SQLite.SQLiteDatabase | null = null;
let demoDb: SQLite.SQLiteDatabase | null = null;
let currentDb: SQLite.SQLiteDatabase | null = null;
let dbReady = false;
let isDemoMode = false;

const openDB = (useNew = false, dbName = DB_NAME) => {
  const opened = SQLite.openDatabaseSync(dbName, useNew ? { useNewConnection: true } : undefined);
  try { opened.execSync('ROLLBACK'); } catch {}
  opened.execSync('PRAGMA journal_mode=WAL');
  opened.execSync('PRAGMA busy_timeout=5000');
  return opened;
};

const recoverDB = (dbName = DB_NAME) => {
  try { db?.closeSync(); } catch {}
  (globalThis as any)[GLOBAL_DB_KEY] = null;
  db = null;
  dbReady = false;

  try {
    SQLite.deleteDatabaseSync(dbName);
    db = openDB(false, dbName);
    (globalThis as any)[dbName === DEMO_DB_NAME ? '__shega_demo_db' : GLOBAL_DB_KEY] = db;
    dbReady = true;
    return db;
  } catch {}

  try {
    db = openDB(true, dbName);
    (globalThis as any)[dbName === DEMO_DB_NAME ? '__shega_demo_db' : GLOBAL_DB_KEY] = db;
    dbReady = true;
    return db;
  } catch {}

  throw new Error('Cannot recover database - still locked after delete + reopen');
};

const getDBCached = (dbName = DB_NAME): SQLite.SQLiteDatabase => {
  const key = dbName === DEMO_DB_NAME ? '__shega_demo_db' : GLOBAL_DB_KEY;
  const cached = (globalThis as any)[key];
  if (cached) {
    try {
      try { cached.execSync('ROLLBACK'); } catch {}
      cached.execSync('PRAGMA journal_mode=WAL');
      cached.execSync('PRAGMA busy_timeout=5000');
      return cached;
    } catch {
      try { cached.closeSync(); } catch {}
      (globalThis as any)[key] = null;
    }
  }
  try {
    db = openDB(false, dbName);
  } catch {
    return recoverDB(dbName);
  }
  (globalThis as any)[key] = db;
  return db;
};

export const getDemoMode = () => isDemoMode;

export const setDemoMode = (enabled: boolean) => {
  isDemoMode = enabled;
  if (enabled) {
    if (!demoDb) {
      demoDb = getDBCached(DEMO_DB_NAME);
    }
    currentDb = demoDb;
  } else {
    if (!db) {
      db = getDBCached(DB_NAME);
    }
    currentDb = db;
  }
  return isDemoMode;
};

export const getDB = () => {
  if (currentDb && dbReady) {
    return currentDb;
  }
  if (!currentDb) {
    currentDb = getDBCached(isDemoMode ? DEMO_DB_NAME : DB_NAME);
  }
  dbReady = true;
  return currentDb;
};

export const resetDemoDb = () => {
  if (demoDb) {
    try { demoDb.closeSync(); } catch {}
    demoDb = null;
  }
  SQLite.deleteDatabaseSync(DEMO_DB_NAME);
  demoDb = getDBCached(DEMO_DB_NAME);
  if (isDemoMode) {
    currentDb = demoDb;
  }
  return demoDb;
};

export const seedDemoData = () => {
  const ddb = getDB();
  const bizId = 1;
  
  // Add demo categories
  const categories = ['Beverages', 'Snacks', 'Dairy', 'Bakery', 'Produce', 'Household'];
  for (const cat of categories) {
    ddb.runSync('INSERT OR IGNORE INTO categories (businessId, name, isCustom) VALUES (?, ?, 1)', bizId, cat);
  }
  
  // Add demo items
  const items = [
    { name: 'Coca Cola 500ml', category: 'Beverages', price: 45, cost: 30, qty: 100 },
    { name: 'Pepsi 500ml', category: 'Beverages', price: 45, cost: 30, qty: 80 },
    { name: 'Water 1L', category: 'Beverages', price: 15, cost: 8, qty: 200 },
    { name: 'Potato Chips', category: 'Snacks', price: 35, cost: 22, qty: 150 },
    { name: 'Chocolate Bar', category: 'Snacks', price: 25, cost: 15, qty: 200 },
    { name: 'Milk 1L', category: 'Dairy', price: 55, cost: 40, qty: 50 },
    { name: 'Yogurt', category: 'Dairy', price: 18, cost: 12, qty: 100 },
    { name: 'Bread Loaf', category: 'Bakery', price: 30, cost: 18, qty: 80 },
    { name: 'Apples 1kg', category: 'Produce', price: 80, cost: 50, qty: 60 },
    { name: 'Bananas 1kg', category: 'Produce', price: 60, cost: 35, qty: 90 },
    { name: 'Dish Soap', category: 'Household', price: 120, cost: 80, qty: 40 },
    { name: 'Toilet Paper 4pk', category: 'Household', price: 95, cost: 65, qty: 30 },
  ];
  
  for (const item of items) {
    const catRow = ddb.getFirstSync('SELECT id FROM categories WHERE businessId = ? AND name = ?', bizId, item.category) as any;
    if (catRow) {
      ddb.runSync(`
        INSERT OR IGNORE INTO items (businessId, name, categoryId, baseSalePrice, basePurchasePrice, totalBaseQuantity, unitsPerPack, isCustom, allowSellByBaseUnit)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1)
      `, bizId, item.name, catRow.id, item.price, item.cost, item.qty);
    }
  }
  
  // Add demo customers
  const customers = [
    { name: 'Walk-in Customer', phone: '', email: '' },
    { name: 'Abebe Kebede', phone: '+251911223344', email: 'abebe@email.com' },
    { name: 'Meron Tesfaye', phone: '+251922334455', email: 'meron@email.com' },
    { name: 'Office Supply Co.', phone: '+251115556677', email: 'orders@office.com' },
  ];
  
  for (const cust of customers) {
    ddb.runSync(`
      INSERT OR IGNORE INTO customers (businessId, name, phone, email, isCustom)
      VALUES (?, ?, ?, ?, 1)
    `, bizId, cust.name, cust.phone, cust.email);
  }
  
  // Add demo sales
  const today = new Date().toISOString().split('T')[0];
  const itemsForSale = ddb.getAllSync('SELECT id, baseSalePrice FROM items WHERE businessId = ?', bizId) as any[];
  const demoCustomers = ddb.getAllSync('SELECT id FROM customers WHERE businessId = ?', bizId) as any[];
  
  for (let i = 0; i < 10; i++) {
    const item = itemsForSale[Math.floor(Math.random() * itemsForSale.length)];
    const customer = demoCustomers[Math.floor(Math.random() * demoCustomers.length)];
    const qty = Math.floor(Math.random() * 5) + 1;
    const total = item.baseSalePrice * qty;
    
    ddb.runSync(`
      INSERT INTO sales (businessId, customerId, customerName, totalPrice, paymentMethod, paymentStatus, status, createdAt)
      VALUES (?, ?, ?, ?, 'Cash', 'Completed', 'Active', ?)
    `, bizId, customer?.id || null, customer?.name || 'Walk-in Customer', total, today);
  }
  
  return { success: true, message: 'Demo data seeded successfully' };
};

const beginTransaction = (database: SQLite.SQLiteDatabase) => {
  database.execSync('BEGIN');
};

const commitTransaction = (database: SQLite.SQLiteDatabase) => {
  database.execSync('COMMIT');
};

const rollbackTransaction = (database: SQLite.SQLiteDatabase) => {
  try { database.execSync('ROLLBACK'); } catch {}
};

const migrateItemsTable = (database: SQLite.SQLiteDatabase) => {
  const columns = [
    { name: 'purchaseUnit', type: 'TEXT' },
    { name: 'unitsPerPack', type: 'REAL' },
    { name: 'totalPackQuantity', type: 'REAL' },
    { name: 'totalBaseQuantity', type: 'REAL' },
    { name: 'packPurchasePrice', type: 'REAL' },
    { name: 'basePurchasePrice', type: 'REAL' },
    { name: 'baseSellingPrice', type: 'REAL' },
    { name: 'packSellingPrice', type: 'REAL' },
    { name: 'allowSellByBaseUnit', type: 'INTEGER', default: '1' },
    { name: 'allowSellByPackUnit', type: 'INTEGER', default: '0' },
    { name: 'sku', type: 'TEXT' },
    { name: 'barcode', type: 'TEXT' },
    { name: 'wholesaleSellingPrice', type: 'REAL' },
    { name: 'minWholesaleQty', type: 'REAL' },
    { name: 'transportCost', type: 'REAL', default: '0' },
    { name: 'importCost', type: 'REAL', default: '0' },
    { name: 'packagingCost', type: 'REAL', default: '0' },
    { name: 'handlingCost', type: 'REAL', default: '0' },
    { name: 'otherCost', type: 'REAL', default: '0' },
    { name: 'targetMargin', type: 'REAL' },
    { name: 'taxTreatment', type: 'TEXT' }
  ];

  for (const col of columns) {
    try {
      database.execSync(`ALTER TABLE items ADD COLUMN ${col.name} ${col.type}${col.default ? ` DEFAULT ${col.default}` : ''};`);
      console.log(`Successfully migrated items column: ${col.name}`);
    } catch {
      // Column probably already exists, which is fine
    }
  }

  // Migration for sales table
  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN unitType TEXT DEFAULT 'base';`);
    console.log('Successfully migrated sales table: Added unitType');
  } catch {}

  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN dueDate TEXT;`);
    database.execSync(`ALTER TABLE sales ADD COLUMN paidAmount REAL DEFAULT 0;`);
    console.log('Successfully migrated sales table: Added dueDate and paidAmount');
  } catch {}

  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN taxType TEXT DEFAULT 'VAT';`);
    console.log('Successfully migrated sales table: Added taxType');
  } catch {}

  // Migration for users table — profile image for activity attribution
  try {
    database.execSync(`ALTER TABLE users ADD COLUMN avatar TEXT;`);
    console.log('Successfully migrated users table: Added avatar');
  } catch {}

  // Migration for items table
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN dueDate TEXT;`);
    console.log('Successfully migrated items table: Added dueDate');
  } catch {}

  // Migration: supplier call toggle + last price-change tracking for weekly supplier check
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN supplierCallEnabled INTEGER DEFAULT 0;`);
    console.log('Successfully migrated items table: Added supplierCallEnabled');
  } catch {}
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN lastPriceCheckAt TEXT;`);
    console.log('Successfully migrated items table: Added lastPriceCheckAt');
  } catch {}

  // Migration: Product active/inactive status
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN isActive INTEGER DEFAULT 1;`);
    console.log('Successfully migrated items table: Added isActive');
  } catch {}

  // Migration: product photo (compressed base64) + default tax classification
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN image TEXT;`);
    console.log('Successfully migrated items table: Added image');
  } catch {}
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN taxType TEXT;`);
    console.log('Successfully migrated items table: Added taxType');
  } catch {}

  // Migration for batchId on sales table
  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN batchId TEXT;`);
    console.log('Successfully migrated sales table: Added batchId');
  } catch {}

  // Migration for item_packs table: initialQuantity and currentQuantity
  try {
    database.execSync(`ALTER TABLE item_packs ADD COLUMN initialQuantity REAL;`);
    database.execSync(`ALTER TABLE item_packs ADD COLUMN currentQuantity REAL;`);
    database.execSync(`ALTER TABLE item_packs ADD COLUMN status TEXT DEFAULT 'Not Opened';`);
    console.log('Successfully migrated item_packs table: Added initialQuantity, currentQuantity, and status');
  } catch {}
  try {
    database.execSync(`UPDATE item_packs SET initialQuantity = quantity, currentQuantity = quantity WHERE initialQuantity IS NULL;`);
    console.log('Successfully migrated item_packs values from quantity to initialQuantity/currentQuantity');
  } catch {}
};

export const initDB = () => {
  try {
    const database = getDB();
    console.log('Database version:', database.getFirstSync('PRAGMA user_version'));
    
    database.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        isCustom INTEGER NOT NULL DEFAULT 0,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1
      );
    `);
    console.log('Table "categories" checked/created.');

    database.execSync(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        categoryId INTEGER,
        sku TEXT,
        barcode TEXT,
        companyName TEXT,
        purchaseUnit TEXT, 
        baseUnit TEXT,
        unitsPerPack REAL,
        totalPackQuantity REAL,
        totalBaseQuantity REAL,
        packPurchasePrice REAL,
        basePurchasePrice REAL,
        baseSellingPrice REAL,
        packSellingPrice REAL,
        allowSellByBaseUnit INTEGER DEFAULT 1,
        allowSellByPackUnit INTEGER DEFAULT 0,
        expiryDate TEXT,
        qualityGrade TEXT,
        notes TEXT,
        image TEXT,
        taxType TEXT,
        isCredit INTEGER,
        supplierPhone TEXT,
        supplierAccount TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (categoryId) REFERENCES categories(id)
      );
    `);
    
    database.execSync(`
      CREATE TABLE IF NOT EXISTS item_packs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER,
        packNumber INTEGER,
        initialQuantity REAL,
        currentQuantity REAL,
        unit TEXT,
        status TEXT DEFAULT 'Not Opened',
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (itemId) REFERENCES items(id)
      );
    `);
    console.log('Table "item_packs" checked/created.');

    // Alternative barcodes for products (multiple barcodes per product)
    database.execSync(`
      CREATE TABLE IF NOT EXISTS item_barcodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER NOT NULL,
        barcode TEXT NOT NULL,
        isPrimary INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (itemId) REFERENCES items(id),
        UNIQUE(itemId, barcode)
      );
    `);
    console.log('Table "item_barcodes" checked/created.');

    // Quick products / favorites for fast POS access
    database.execSync(`
      CREATE TABLE IF NOT EXISTS quick_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER NOT NULL,
        position INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (itemId) REFERENCES items(id),
        UNIQUE(itemId)
      );
    `);
    console.log('Table "quick_products" checked/created.');

    // Stock movement log â€” records each stock-add event so the activity
    // feed shows historical additions instead of live (shrinking) stock levels.
    database.execSync(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER,
        quantityAdded REAL NOT NULL,
        unit TEXT,
        note TEXT,
        user_id TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (itemId) REFERENCES items(id)
      );
    `);
    console.log('Table "stock_movements" checked/created.');

    // Price history â€” log purchase/selling/wholesale price changes so the
    // pricing intelligence can show previous vs current values and margin drift.
    database.execSync(`
      CREATE TABLE IF NOT EXISTS item_price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER NOT NULL,
        field TEXT NOT NULL,
        oldValue REAL,
        newValue REAL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (itemId) REFERENCES items(id)
      );
    `);
    console.log('Table "item_price_history" checked/created.');

    database.execSync(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        unitType TEXT NOT NULL,
        user_id TEXT,
        discount REAL DEFAULT 0,
        vat REAL DEFAULT 0,
        totalPrice REAL NOT NULL,
        paymentMethod TEXT,
        paymentStatus TEXT,
        customerName TEXT,
        customerPhone TEXT,
        packId INTEGER,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (itemId) REFERENCES items(id),
        FOREIGN KEY (packId) REFERENCES item_packs(id)
      );
    `);
    console.log('Table "sales" checked/created.');

    // Perform migration for existing users
    migrateItemsTable(database);
    
    console.log('Table migrations completed.');

    // Debt payment history (one row per payment event, supports full + partial + write-off).
    database.execSync(`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId INTEGER,
        customerName TEXT NOT NULL,
        customerPhone TEXT,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        note TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1
      );
    `);
    console.log('Table "debt_payments" checked/created.');

    database.execSync(`
      CREATE TABLE IF NOT EXISTS adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'price_up', 'price_down', 'damaged'
        oldValue REAL,
        newValue REAL,
        quantity REAL,
        unitType TEXT,
        reason TEXT,
        user_id TEXT,
        date TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        uuid TEXT,
        device_id TEXT,
        row_version INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (itemId) REFERENCES items(id)
      );
    `);
    console.log('Table "adjustments" checked/created.');

    database.execSync(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        category TEXT NOT NULL,
        subCategory TEXT,
        phone TEXT,
        alternatePhone TEXT,
        accountNumber TEXT,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "contacts" checked/created.');

    // Sync columns + businessId for contacts (shared entity with desktop hub)
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN name TEXT;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN businessId INTEGER;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN uuid TEXT;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN device_id TEXT;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN updated_at TEXT;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN deleted_at TEXT;`); } catch {}
    try { database.execSync(`ALTER TABLE contacts ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

    // Migration: Add supplierId to items table if not exists
    try {
      database.execSync(`ALTER TABLE items ADD COLUMN supplierId INTEGER REFERENCES contacts(id);`);
      console.log('Successfully migrated items table: Added supplierId');
    } catch {}

    // Migration: Supplier profile columns on the contacts table. Suppliers are
    // contacts with category = 'supplier' and carry a richer profile.
    try {
      database.execSync(`ALTER TABLE contacts ADD COLUMN companyName TEXT;`);
      console.log('Successfully migrated contacts table: Added companyName');
    } catch {}
    try {
      database.execSync(`ALTER TABLE contacts ADD COLUMN email TEXT;`);
      console.log('Successfully migrated contacts table: Added email');
    } catch {}
    try {
      database.execSync(`ALTER TABLE contacts ADD COLUMN address TEXT;`);
      console.log('Successfully migrated contacts table: Added address');
    } catch {}
    try {
      database.execSync(`ALTER TABLE contacts ADD COLUMN tin TEXT;`);
      console.log('Successfully migrated contacts table: Added tin');
    } catch {}
    try {
      database.execSync(`ALTER TABLE contacts ADD COLUMN supplierCategory TEXT;`);
      console.log('Successfully migrated contacts table: Added supplierCategory');
    } catch {}
    try {
      database.execSync(`ALTER TABLE contacts ADD COLUMN paymentType TEXT DEFAULT 'cash';`);
      console.log('Successfully migrated contacts table: Added paymentType');
    } catch {}
    try {
      database.execSync(`ALTER TABLE contacts ADD COLUMN isActive INTEGER DEFAULT 1;`);
      console.log('Successfully migrated contacts table: Added isActive');
    } catch {}

    // Phase 3: synced customers table mirroring the Desktop hub's `customers`
    // shared entity so phone can query debt/credit history offline. The unique
    // (customerName, phone) index mirrors the hub's business-scoped uniqueness.
    database.execSync(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerName TEXT NOT NULL,
        phone TEXT,
        secondaryPhone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        company TEXT,
        taxNumber TEXT,
        groupName TEXT DEFAULT 'general',
        creditLimit REAL DEFAULT 0,
        notes TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    try {
      database.execSync('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name_phone ON customers(customerName, COALESCE(phone, \'\'));');
    } catch {}

    // Migration: Purchase fields on the stock_movements log so restocks can be
    // attributed to a supplier and treated as purchases.
    try {
      database.execSync(`ALTER TABLE stock_movements ADD COLUMN supplierId INTEGER;`);
      console.log('Successfully migrated stock_movements table: Added supplierId');
    } catch {}
    try {
      database.execSync(`ALTER TABLE stock_movements ADD COLUMN unitPrice REAL DEFAULT 0;`);
      console.log('Successfully migrated stock_movements table: Added unitPrice');
    } catch {}
    try {
      database.execSync(`ALTER TABLE stock_movements ADD COLUMN paymentStatus TEXT;`);
      console.log('Successfully migrated stock_movements table: Added paymentStatus');
    } catch {}
    try {
      database.execSync(`ALTER TABLE stock_movements ADD COLUMN paidAmount REAL DEFAULT 0;`);
      console.log('Successfully migrated stock_movements table: Added paidAmount');
    } catch {}

    // Many-to-many link between products and suppliers (one product can be
    // supplied by several suppliers).
    database.execSync(`
      CREATE TABLE IF NOT EXISTS item_suppliers (
        itemId INTEGER NOT NULL,
        supplierId INTEGER NOT NULL,
        PRIMARY KEY (itemId, supplierId)
      );
    `);
    console.log('Table "item_suppliers" checked/created.');

    // Payment history against a supplier's outstanding balance.
    database.execSync(`
      CREATE TABLE IF NOT EXISTS supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplierId INTEGER NOT NULL,
        amount REAL NOT NULL,
        paidAt TEXT,
        method TEXT,
        note TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "supplier_payments" checked/created.');

    // Saved supplier product orders â€” reviewable purchase orders generated
    // from the supplier's linked products. Items are stored as JSON so the
    // editable line items (qty / price / unit) round-trip exactly.
    database.execSync(`
      CREATE TABLE IF NOT EXISTS supplier_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplierId INTEGER NOT NULL,
        orderNumber TEXT,
        items TEXT NOT NULL,
        totalAmount REAL DEFAULT 0,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "supplier_orders" checked/created.');

  // Migration: Add warehouseId to items table
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN warehouseId INTEGER REFERENCES warehouses(id);`);
    console.log('Successfully migrated items table: Added warehouseId');
  } catch {}

  // Migration: Add orderNumber to sales table (for orders feature)
  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN orderNumber TEXT;`);
    console.log('Successfully migrated sales table: Added orderNumber');
  } catch {}

  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN notes TEXT;`);
    console.log('Successfully migrated sales table: Added notes');
  } catch {}

  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN convertedAt TEXT;`);
    console.log('Successfully migrated sales table: Added convertedAt');
  } catch {}

  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN cancelledAt TEXT;`);
    console.log('Successfully migrated sales table: Added cancelledAt');
  } catch {}

  // Create warehouses table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      contactPerson TEXT,
      phone TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table "warehouses" checked/created.');

  // Insert default warehouse if empty
  const warehouseCount = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM warehouses');
  if (warehouseCount && warehouseCount.count === 0) {
    database.execSync("INSERT INTO warehouses (name, location) VALUES ('Main Warehouse', 'Default Location')");
    console.log('Default warehouse created.');
  }

  // Create returns table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saleId INTEGER,
      itemId INTEGER,
      quantity REAL NOT NULL,
      unit TEXT,
      unitType TEXT,
      totalRefund REAL NOT NULL,
      reason TEXT,
      itemCondition TEXT DEFAULT 'Resellable',
      refundType TEXT DEFAULT 'Full Refund',
      notes TEXT,
      returnDate TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (saleId) REFERENCES sales(id),
      FOREIGN KEY (itemId) REFERENCES items(id)
    );
  `);
  console.log('Table "returns" checked/created.');

  // Migration: add new columns to returns table for existing databases
  const addColumnIfMissing = (table: string, column: string, def: string) => {
    try {
      database.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    } catch (e: any) {
      if (e?.message?.includes('duplicate column') || e?.message?.includes('already exists')) {
        // Column already exists, ignore
      } else {
        console.warn(`Migration (${table}.${column}): unexpected error -`, e?.message);
      }
    }
  };
  addColumnIfMissing('returns', 'itemCondition', 'TEXT DEFAULT \'Resellable\'');
  addColumnIfMissing('returns', 'refundType', 'TEXT DEFAULT \'Full Refund\'');
  addColumnIfMissing('returns', 'notes', 'TEXT');
  addColumnIfMissing('returns', 'returnDate', 'TEXT');

  // 4.12: Gift cards / store credit.
  database.execSync(`
    CREATE TABLE IF NOT EXISTS gift_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      cardName TEXT,
      initialBalance REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      issuedTo TEXT,
      expiryDate TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS gift_card_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      giftCardId INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      refType TEXT,
      refId INTEGER,
      note TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (giftCardId) REFERENCES gift_cards(id)
    );
  `);

  // ========== PHASE 3 SYNC LAYER ==========
  // `stock_movements` must be part of the initial list so the sync-column loop
  // below adds uuid/device_id/row_version/etc. BEFORE the uuid backfill and
  // outbox-trigger loops run (Â§23 movement-ledger sync). Registering it later
  // leaves the table without sync columns and breaks its migration + triggers.
  const syncTables = ['categories', 'items', 'item_packs', 'item_barcodes', 'quick_products', 'sales', 'debt_payments', 'adjustments', 'returns', 'customers', 'contacts', 'stock_movements', 'subscriptions', 'scheduled_reminders', 'suppliers', 'orders', 'order_items', 'shipments', 'shipment_items', 'employees', 'employee_roles', 'employee_accounts', 'attendance', 'employee_performance'];
  const syncCols: [string, string][] = [
    ['uuid', 'TEXT'],
    ['device_id', 'TEXT'],
    ['row_version', 'INTEGER DEFAULT 1'],
    ['updated_at', 'TEXT'],
    ['is_deleted', 'INTEGER DEFAULT 0'],
    ['deleted_at', 'TEXT'],
    ['is_synced', 'INTEGER DEFAULT 1']
  ];
  for (const tbl of syncTables) {
    for (const [name, def] of syncCols) {
      addColumnIfMissing(tbl, name, def);
    }
  }
  // Â§23: align the movement ledger with the shared sync schema so restock
  // additions (canonical `restock_in`) converge with the desktop hub. Mobile's
  // legacy addition-only `quantityAdded` feed is preserved; `type`/`quantity`
  // are the sync-canonical fields. Stock itself is NOT touched by a relayed
  // movement â€” on-hand levels converge via the already-synced `items` rows.
  addColumnIfMissing('stock_movements', 'businessId', 'INTEGER');
  addColumnIfMissing('stock_movements', 'warehouseId', 'INTEGER');
  addColumnIfMissing('stock_movements', 'type', "TEXT DEFAULT 'restock_in'");
  addColumnIfMissing('stock_movements', 'quantity', 'REAL');
  addColumnIfMissing('stock_movements', 'referenceId', 'INTEGER');
  addColumnIfMissing('stock_movements', 'referenceType', 'TEXT');
  addColumnIfMissing('stock_movements', 'notes', 'TEXT');
  // 4.8: reorder automation columns on items.
  for (const [name, def] of [['reorderPoint', 'REAL DEFAULT 10'], ['reorderQty', 'REAL DEFAULT 0'], ['autoReorder', 'INTEGER DEFAULT 0']] as [string, string][]) {
    addColumnIfMissing('items', name, def);
  }
  const genUuid = "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))";
  for (const tbl of syncTables) {
    try {
      database.execSync(`UPDATE ${tbl} SET uuid = ${genUuid}, row_version = 1 WHERE uuid IS NULL;`);
      database.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tbl}_uuid ON ${tbl}(uuid);`);
    } catch (e: any) {
      console.warn(`Sync migration (${tbl}): `, e?.message);
    }
  }
  database.execSync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      op TEXT NOT NULL,
      row_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sync_cursor (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      hub_seq INTEGER NOT NULL DEFAULT 0,
      last_sync_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_refs (
      device_id TEXT,
      entity TEXT,
      local_id INTEGER,
      uuid TEXT,
      PRIMARY KEY (device_id, entity, local_id)
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      op TEXT NOT NULL,
      incoming_payload TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_uuid ON sync_conflicts(entity_uuid);
  `);

  // Â§24 Sync Center â€” sync_outbox enhancements & sync_history
  addColumnIfMissing('sync_outbox', 'transport', "TEXT DEFAULT 'lan'");
  addColumnIfMissing('sync_outbox', 'retry_count', 'INTEGER DEFAULT 0');
  addColumnIfMissing('sync_outbox', 'source_device', 'TEXT');
  database.execSync(`
    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transport TEXT NOT NULL,
      pushed INTEGER NOT NULL DEFAULT 0,
      pulled INTEGER NOT NULL DEFAULT 0,
      conflicts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Â§24 Sync Center tables checked/created.');

  // ========== BUSINESS MODEL (multi-device business, users, roles, devices, registers) ==========
  // These tables implement the shared business model from @shega/shared. Entity
  // ids are UUID text so they can synchronize across devices without colliding.
  database.execSync(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT,
      currency TEXT DEFAULT 'ETB',
      plan_label TEXT,
      max_mobile INTEGER DEFAULT 1,
      max_desktop INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      address TEXT,
      business_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      row_version INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      username TEXT,
      avatar TEXT,
      role TEXT NOT NULL,
      role_name TEXT,
      permissions TEXT,
      is_active INTEGER DEFAULT 1,
      is_owner INTEGER DEFAULT 0,
      pin_hash TEXT,
      pin_salt TEXT,
      assigned_register_id TEXT,
      assigned_location_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      row_version INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    CREATE TABLE IF NOT EXISTS business_roles (
      id TEXT PRIMARY KEY,
      business_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT,
      is_system INTEGER DEFAULT 0,
      builtin_key TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT,
      platform TEXT DEFAULT 'mobile',
      created_by TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      model TEXT,
      platform TEXT NOT NULL DEFAULT 'mobile',
      register_id TEXT,
      role TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      pairing_code TEXT,
      pairing_expires_at TEXT,
      last_seen_at TEXT,
      last_sync_at TEXT,
      app_version TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      row_version INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (business_id) REFERENCES businesses(id)
    );

    CREATE TABLE IF NOT EXISTS registers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      location_id TEXT,
      name TEXT NOT NULL,
      device_id TEXT,
      printer_name TEXT,
      has_drawer INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (business_id) REFERENCES businesses(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
    CREATE INDEX IF NOT EXISTS idx_devices_business ON devices(business_id);
    CREATE INDEX IF NOT EXISTS idx_registers_business ON registers(business_id);
  `);

  // Migration: pin employees to a register/location (existing installs).
  addColumnIfMissing('users', 'assigned_register_id', 'TEXT');
  addColumnIfMissing('users', 'assigned_location_id', 'TEXT');
  // Shared sign-in identity (username+PIN) and Teams profile photo.
  addColumnIfMissing('users', 'username', 'TEXT');
  addColumnIfMissing('users', 'avatar', 'TEXT');
  // Business profile image (owner-managed, syncs to desktop `businesses.logo`).
  addColumnIfMissing('businesses', 'logo', 'TEXT');
  addColumnIfMissing('businesses', 'phone', 'TEXT');
  // Per-business tax configuration JSON: { enabled, taxTypes: [{ id, name, rate, enabled, active }] }
  addColumnIfMissing('businesses', 'tax_config', 'TEXT');

  // ========== SHARED BUSINESS MODEL SYNC (locations / registers / business_roles) ==========
  // These tables use TEXT UUID primary keys and snake_case columns (the canonical
  // @shega/shared schema), distinct from the INTEGER-id legacy tables above. They
  // are wired into the same LAN/cloud outbox transport with their own dedicated
  // triggers (the generic syncTables loop runs earlier and must not touch them).
  const businessSyncTables = ['businesses', 'locations', 'registers', 'business_roles', 'users', 'devices'];
  const bizSyncCols: [string, string][] = [
    ['device_id', 'TEXT'],
    ['updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP'],
    ['deleted_at', 'TEXT']
  ];
  for (const tbl of businessSyncTables) {
    for (const [name, def] of bizSyncCols) {
      addColumnIfMissing(tbl, name, def);
    }
    try {
      database.execSync(`UPDATE ${tbl} SET uuid = ${genUuid}, row_version = 1 WHERE uuid IS NULL;`);
      database.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tbl}_uuid ON ${tbl}(uuid);`);
      database.execSync(`
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_ai AFTER INSERT ON ${tbl} BEGIN
          UPDATE ${tbl} SET uuid = ${genUuid} WHERE id = NEW.id AND uuid IS NULL;
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          SELECT '${tbl}', uuid, 'INSERT', id FROM ${tbl} WHERE id = NEW.id;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_au AFTER UPDATE ON ${tbl} WHEN OLD.uuid IS NOT NULL AND NEW.uuid IS NOT NULL BEGIN
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          SELECT '${tbl}', uuid, 'UPDATE', id FROM ${tbl} WHERE id = NEW.id;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_ad AFTER DELETE ON ${tbl} BEGIN
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          VALUES ('${tbl}', OLD.uuid, 'DELETE', OLD.id);
        END;
      `);
    } catch (e: any) {
      console.warn(`Business-model sync trigger (${tbl}): `, e?.message);
    }
  }

  // ========== PHASE 4.3 AUDIT TRAIL (tamper-evident, chained hashes) ==========
  database.execSync(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      device_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      prev_hash TEXT,
      hash TEXT
    );
  `);
  addColumnIfMissing('audit_logs', 'uuid', 'TEXT');
  addColumnIfMissing('audit_logs', 'business_id', 'TEXT');
  addColumnIfMissing('audit_logs', 'source_device', 'TEXT');
  addColumnIfMissing('audit_logs', 'row_version', 'INTEGER DEFAULT 1');
  addColumnIfMissing('audit_logs', 'user_id', 'TEXT');
  addColumnIfMissing('sales', 'user_id', 'TEXT');
  addColumnIfMissing('stock_movements', 'user_id', 'TEXT');
  addColumnIfMissing('adjustments', 'user_id', 'TEXT');
  addColumnIfMissing('audit_logs', 'updated_at', 'TEXT');
  addColumnIfMissing('audit_logs', 'is_synced', 'INTEGER DEFAULT 0');
  database.execSync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_uuid ON audit_logs(uuid);
  `);
  // Backfill chain for any pre-existing rows.
  try {
    const auditRows = database.getAllSync('SELECT * FROM audit_logs ORDER BY id ASC') as any[];
    if (auditRows.length) {
      let prev = 'GENESIS';
      for (const r of auditRows) {
        if (r.hash) {
          prev = r.hash;
          continue;
        }
        const hh = sha256Hex(`${prev}|${r.id}|${r.entity}|${r.entity_id ?? ''}|${r.action}|${r.old_value ?? ''}|${r.new_value ?? ''}|${r.description ?? ''}|${r.device_id ?? ''}|${r.created_at ?? ''}`);
        database.runSync('UPDATE audit_logs SET prev_hash = ?, hash = ? WHERE id = ?', [prev, hh, r.id]);
        prev = hh;
      }
    }
  } catch (e: any) {
    console.warn('Audit backfill: ', e?.message);
  }
  for (const tbl of syncTables) {
    try {
      database.execSync(`
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_ai AFTER INSERT ON ${tbl} BEGIN
          UPDATE ${tbl} SET uuid = ${genUuid} WHERE id = NEW.id AND uuid IS NULL;
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          SELECT '${tbl}', uuid, 'INSERT', id FROM ${tbl} WHERE id = NEW.id;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_au AFTER UPDATE ON ${tbl} WHEN OLD.uuid IS NOT NULL AND NEW.uuid IS NOT NULL BEGIN
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          SELECT '${tbl}', uuid, 'UPDATE', id FROM ${tbl} WHERE id = NEW.id;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_ad AFTER DELETE ON ${tbl} BEGIN
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          VALUES ('${tbl}', OLD.uuid, 'DELETE', OLD.id);
        END;
      `);
    } catch (e: any) {
      console.warn(`Sync trigger (${tbl}): `, e?.message);
    }
  }
  // Â§32: emit local audit_logs into the sync outbox (append-only INSERT). The
  // receiving device dedupes by uuid and never rewrites a hashed row.
  try {
    database.execSync(`
      CREATE TRIGGER IF NOT EXISTS trg_audit_logs_ai AFTER INSERT ON audit_logs WHEN NEW.uuid IS NOT NULL BEGIN
        INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
        VALUES ('audit_logs', NEW.uuid, 'INSERT', NEW.id);
      END;
    `);
  } catch (e: any) {
    console.warn('Sync trigger (audit_logs): ', e?.message);
  }

  // Sync triggers for shared entities (suppliers, orders, shipments, employees, subscriptions, reminders, contacts)
  const sharedSyncTables = ['suppliers', 'orders', 'order_items', 'order_history', 'shipments', 'shipment_items', 'shipment_history', 'employee_roles', 'employees', 'employee_accounts', 'attendance', 'employee_performance', 'subscriptions', 'scheduled_reminders', 'subscription_payments', 'subscription_renewals', 'notifications', 'contacts'];
  for (const tbl of sharedSyncTables) {
    try {
      database.execSync(`UPDATE ${tbl} SET uuid = ${genUuid}, row_version = 1 WHERE uuid IS NULL;`);
      database.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tbl}_uuid ON ${tbl}(uuid);`);
    } catch (e: any) {
      console.warn(`Shared sync index (${tbl}): `, e?.message);
    }
    try {
      database.execSync(`
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_ai AFTER INSERT ON ${tbl} BEGIN
          UPDATE ${tbl} SET uuid = ${genUuid} WHERE id = NEW.id AND uuid IS NULL;
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          SELECT '${tbl}', uuid, 'INSERT', id FROM ${tbl} WHERE id = NEW.id;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_au AFTER UPDATE ON ${tbl} WHEN OLD.uuid IS NOT NULL AND NEW.uuid IS NOT NULL BEGIN
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          SELECT '${tbl}', uuid, 'UPDATE', id FROM ${tbl} WHERE id = NEW.id;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_${tbl}_ad AFTER DELETE ON ${tbl} BEGIN
          INSERT INTO sync_outbox (entity, entity_uuid, op, row_id)
          VALUES ('${tbl}', OLD.uuid, 'DELETE', OLD.id);
        END;
      `);
    } catch (e: any) {
      console.warn(`Shared sync trigger (${tbl}): `, e?.message);
    }
  }

  console.log('Sync layer ready.');

  // ========== MULTI-BUSINESS SCOPING (core record tables) ==========
  // Smallest safe change: give every core record table a camelCase `businessId`
  // column holding the mobile business UUID (the canonical identity used by the
  // adapter entities, e.g. locations.business_id). Reads and writes are then
  // isolated per active business; the desktop hub maps its INTEGER businessId
  // to this UUID before relaying, so business-scoped rows are consistent across
  // platforms without touching FK identity machinery.
  const businessScopedTables = [
    'categories', 'items', 'item_packs', 'item_barcodes', 'quick_products',
    'sales', 'debt_payments', 'adjustments', 'customers',
    'warehouses', 'returns',
    'employee_roles', 'employees', 'employee_accounts', 'attendance', 'employee_performance'
  ];
  // Backfill target: configured active business, else default business, else the
  // oldest non-deleted business, else none (pre-onboarding, keep NULL).
  const scopingBusinessId = (() => {
    const active = database.getFirstSync(`SELECT value FROM app_settings WHERE key = 'active_business_id'`) as any;
    if (active?.value) {
      const ok = database.getFirstSync('SELECT id FROM businesses WHERE id = ? AND is_deleted = 0', [active.value]) as any;
      if (ok?.id) return String(active.value);
    }
    const fb = database.getFirstSync(`SELECT id FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, id LIMIT 1`) as any;
    return fb?.id ? String(fb.id) : null;
  })();
  for (const tbl of businessScopedTables) {
    try {
      addColumnIfMissing(tbl, 'businessId', 'TEXT');
      if (scopingBusinessId) {
        database.runSync(`UPDATE ${tbl} SET businessId = ? WHERE businessId IS NULL`, [scopingBusinessId]);
      }
      database.execSync(`CREATE INDEX IF NOT EXISTS idx_${tbl}_businessId ON ${tbl}(businessId);`);
    } catch (e: any) {
      console.warn(`Multi-business column (${tbl}): `, e?.message);
    }
  }

  // Create notifications table (in-app notification center)
  database.execSync(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT,
      priority TEXT DEFAULT 'normal',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      icon TEXT,
      deepLink TEXT,
      data TEXT,
      isRead INTEGER DEFAULT 0,
      isDismissed INTEGER DEFAULT 0,
      isResolved INTEGER DEFAULT 0,
      requiresAction INTEGER DEFAULT 0,
      groupKey TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      readAt TEXT,
      expiresAt TEXT
    );
  `);
  console.log('Table "notifications" checked/created.');

  // Sync columns for notifications (shared entity with desktop hub)
  try { database.execSync(`ALTER TABLE notifications ADD COLUMN uuid TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE notifications ADD COLUMN device_id TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE notifications ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE notifications ADD COLUMN updated_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE notifications ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE notifications ADD COLUMN deleted_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE notifications ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

  // Create scheduled_reminders table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS scheduled_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      refId INTEGER,
      title TEXT NOT NULL,
      body TEXT,
      triggerAt TEXT NOT NULL,
      repeatInterval TEXT,
      status TEXT DEFAULT 'pending',
      notificationId TEXT,
      snoozedUntil TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table "scheduled_reminders" checked/created.');

  // Sync columns + businessId for scheduled_reminders (shared entity with desktop hub's notification_reminders)
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN businessId INTEGER;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN title TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN message TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN category TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN triggerDate TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN repeatInterval TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN lastTriggeredAt TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN completedAt TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN relatedEntityType TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN relatedEntityId INTEGER;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN uuid TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN device_id TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN updated_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN deleted_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE scheduled_reminders ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

  // Create notification_preferences table (per-user overrides)
  database.execSync(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      key TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      quietStart TEXT,
      quietEnd TEXT,
      sound TEXT DEFAULT 'default',
      vibration INTEGER DEFAULT 1
    );
  `);
  console.log('Table "notification_preferences" checked/created.');

  // App settings key-value store
  database.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  console.log('Table "app_settings" checked/created.');

  // Indexes for fast querying
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_isread ON notifications(isRead);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_category ON notifications(category);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_groupkey ON notifications(groupKey);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(createdAt DESC);`);

  // â†’â†’ Subscription tables â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’
  database.execSync(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan TEXT NOT NULL DEFAULT 'basic',
      status TEXT NOT NULL DEFAULT 'trial',
      trialStartedAt TEXT,
      trialEndsAt TEXT,
      durationMonths INTEGER DEFAULT 1,
      price REAL,
      currency TEXT DEFAULT 'ETB',
      startedAt TEXT,
      expiresAt TEXT,
      cancelledAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table "subscriptions" checked/created.');

  // Sync columns + businessId for subscriptions (shared entity with desktop hub)
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN businessId INTEGER;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN planId TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN tier TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN trialStartedAt TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN trialEndsAt TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN isTrial INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN autoRenew INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN uuid TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN device_id TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN updated_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN deleted_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscriptions ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

  database.execSync(`
    CREATE TABLE IF NOT EXISTS subscription_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionId INTEGER,
      transactionId TEXT,
      businessName TEXT,
      phoneNumber TEXT,
      planName TEXT,
      amount REAL,
      currency TEXT DEFAULT 'ETB',
      paymentDate TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending_verification',
      verifiedAt TEXT,
      verifiedBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id)
    );
  `);
  console.log('Table "subscription_payments" checked/created.');

  database.execSync(`
    CREATE TABLE IF NOT EXISTS subscription_renewals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionId INTEGER,
      previousExpiry TEXT,
      newExpiry TEXT,
      plan TEXT,
      durationMonths INTEGER,
      amount REAL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id)
    );
  `);
  console.log('Table "subscription_renewals" checked/created.');

  // Sync columns for subscription_payments (shared entity with desktop hub)
  try { database.execSync(`ALTER TABLE subscription_payments ADD COLUMN uuid TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_payments ADD COLUMN device_id TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_payments ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_payments ADD COLUMN updated_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_payments ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_payments ADD COLUMN deleted_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_payments ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

  // Sync columns for subscription_renewals (shared entity with desktop hub)
  try { database.execSync(`ALTER TABLE subscription_renewals ADD COLUMN uuid TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_renewals ADD COLUMN device_id TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_renewals ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_renewals ADD COLUMN updated_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_renewals ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_renewals ADD COLUMN deleted_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE subscription_renewals ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

  database.execSync(`
    CREATE TABLE IF NOT EXISTS subscription_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriptionId INTEGER,
      action TEXT,
      oldValue TEXT,
      newValue TEXT,
      performedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscriptionId) REFERENCES subscriptions(id)
    );
  `);
  console.log('Table "subscription_audit" checked/created.');

  // ========== SHARED ENTITIES (sync with desktop hub) ==========
  // Suppliers (desktop hub's dedicated suppliers table)
  database.execSync(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      businessId INTEGER,
      supplierCode TEXT,
      supplierName TEXT NOT NULL,
      companyName TEXT,
      contactPerson TEXT,
      phone TEXT,
      secondaryPhone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      taxNumber TEXT,
      paymentTerms TEXT,
      creditLimit REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'active',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1
    );
  `);
  console.log('Table "suppliers" checked/created.');

  // Orders
  database.execSync(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      businessId INTEGER,
      orderNumber TEXT UNIQUE NOT NULL,
      customerName TEXT,
      customerPhone TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Order',
      totalAmount REAL NOT NULL DEFAULT 0,
      createdBy INTEGER,
      createdByName TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      convertedAt TEXT,
      convertedBy TEXT,
      cancelledAt TEXT,
      cancelledBy TEXT,
      cancelReason TEXT,
      uuid TEXT UNIQUE,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      updated_at TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (businessId) REFERENCES businesses(id)
    );
  `);
  console.log('Table "orders" checked/created.');

  // Order items
  database.execSync(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      itemId INTEGER,
      itemName TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      unitType TEXT DEFAULT 'base',
      unitPrice REAL NOT NULL DEFAULT 0,
      totalPrice REAL NOT NULL DEFAULT 0,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      updated_at TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (itemId) REFERENCES items(id)
    );
  `);
  console.log('Table "order_items" checked/created.');

  // Shipments
  database.execSync(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      businessId INTEGER,
      origin TEXT,
      destination TEXT NOT NULL,
      driverName TEXT,
      driverPhone TEXT,
      vehicleInfo TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      scheduledDate TEXT,
      deliveredAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (businessId) REFERENCES businesses(id)
    );
  `);
  console.log('Table "shipments" checked/created.');

  // Shipment items
  database.execSync(`
    CREATE TABLE IF NOT EXISTS shipment_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipmentId INTEGER NOT NULL,
      itemId INTEGER,
      itemName TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (shipmentId) REFERENCES shipments(id) ON DELETE CASCADE,
      FOREIGN KEY (itemId) REFERENCES items(id)
    );
  `);
  console.log('Table "shipment_items" checked/created.');

  // Employee roles
  database.execSync(`
    CREATE TABLE IF NOT EXISTS employee_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT DEFAULT '[]',
      isSystem INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1
    );
  `);
  console.log('Table "employee_roles" checked/created.');

  // Employees
  database.execSync(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeCode TEXT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      emergencyContact TEXT,
      gender TEXT,
      dateOfBirth TEXT,
      roleId INTEGER REFERENCES employee_roles(id),
      department TEXT,
      warehouseId INTEGER REFERENCES warehouses(id),
      isActive INTEGER DEFAULT 1,
      employmentStatus TEXT DEFAULT 'active',
      avatar TEXT,
      hireDate TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1
    );
  `);
  console.log('Table "employees" checked/created.');

  // Employee accounts
  database.execSync(`
    CREATE TABLE IF NOT EXISTS employee_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
      username TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      forcePasswordChange INTEGER DEFAULT 0,
      failedLoginAttempts INTEGER DEFAULT 0,
      lockedUntil TEXT,
      lastPasswordChange TEXT,
      lastLogin TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1
    );
  `);
  console.log('Table "employee_accounts" checked/created.');

  // Attendance
  database.execSync(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      clockIn TEXT,
      clockOut TEXT,
      status TEXT DEFAULT 'present',
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1,
      UNIQUE(employeeId, date)
    );
  `);
  console.log('Table "attendance" checked/created.');

  // Employee performance
  database.execSync(`
    CREATE TABLE IF NOT EXISTS employee_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      period TEXT NOT NULL,
      salesAmount REAL DEFAULT 0,
      ordersProcessed INTEGER DEFAULT 0,
      attendanceScore REAL DEFAULT 0,
      tasksCompleted INTEGER DEFAULT 0,
      rating REAL,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      device_id TEXT,
      row_version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_synced INTEGER DEFAULT 1,
      UNIQUE(employeeId, period)
    );
  `);
  console.log('Table "employee_performance" checked/created.');

  // Order history
  database.execSync(`
    CREATE TABLE IF NOT EXISTS order_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      status TEXT NOT NULL,
      changedBy TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);
  console.log('Table "order_history" checked/created.');

  // Sync columns for order_history
  try { database.execSync(`ALTER TABLE order_history ADD COLUMN uuid TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE order_history ADD COLUMN device_id TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE order_history ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE order_history ADD COLUMN updated_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE order_history ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE order_history ADD COLUMN deleted_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE order_history ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

  // Shipment history
  database.execSync(`
    CREATE TABLE IF NOT EXISTS shipment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipmentId INTEGER NOT NULL,
      status TEXT NOT NULL,
      changedBy TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shipmentId) REFERENCES shipments(id) ON DELETE CASCADE
    );
  `);
  console.log('Table "shipment_history" checked/created.');

  // Sync columns for shipment_history
  try { database.execSync(`ALTER TABLE shipment_history ADD COLUMN uuid TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE shipment_history ADD COLUMN device_id TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE shipment_history ADD COLUMN row_version INTEGER DEFAULT 1;`); } catch {}
  try { database.execSync(`ALTER TABLE shipment_history ADD COLUMN updated_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE shipment_history ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
  try { database.execSync(`ALTER TABLE shipment_history ADD COLUMN deleted_at TEXT;`); } catch {}
  try { database.execSync(`ALTER TABLE shipment_history ADD COLUMN is_synced INTEGER DEFAULT 1;`); } catch {}

  // Notification reminders (alias for scheduled_reminders for desktop compatibility)
  // Already created as scheduled_reminders above.

  // Initialize default trial subscription if none exists
  const subCount = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM subscriptions');
  if (subCount && subCount.count === 0) {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    database.execSync(`
      INSERT INTO subscriptions (plan, status, trialStartedAt, trialEndsAt, startedAt, expiresAt)
      VALUES ('premium', 'trial', datetime('now'), datetime('now', '+7 days'), datetime('now'), datetime('now', '+7 days'))
    `);
    console.log('Default trial subscription created.');
  }

  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

const randomUUIDCompat = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${hex()}-${hex().slice(0, 4)}-4${hex().slice(0, 3)}-8${hex().slice(0, 3)}-${hex()}`;
};

const auditCanonical = (prev: string, r: any): string =>
  `${prev}|${r.id}|${r.entity}|${r.entity_id ?? ''}|${r.action}|${r.old_value ?? ''}|${r.new_value ?? ''}|${r.description ?? ''}|${r.device_id ?? ''}|${r.created_at ?? ''}`;

/**
 * Id of the signed-in business user, read straight from app_settings.
 * Local to db.ts to avoid a circular import with businessService.
 */
export const getCurrentUserIdSafe = (): string | null => {
  try {
    const row = getDB().getFirstSync("SELECT value FROM app_settings WHERE key = 'current_user_id'") as { value?: string } | null;
    return row?.value || null;
  } catch {
    return null;
  }
};

/**
 * Resolved display name of whoever is signed in on this device (for activity
 * attribution). Falls back to 'Staff'.
 */
export const getCurrentUserName = (): string => {
  try {
    const database = getDB();
    const uid = getCurrentUserIdSafe();
    if (uid) {
      const u = database.getFirstSync('SELECT name FROM users WHERE id = ? AND is_deleted = 0', [uid]) as { name?: string } | null;
      if (u?.name) return u.name;
    }
  } catch {}
  return 'Staff';
};

/** Append an audit entry with a chained hash (Phase 4.3). */
export const auditLog = (entity: string, entityId: number | null, action: string, oldValue: string | null, newValue: string | null, description: string | null): void => {
  try {
    const database = getDB();
    const prev = (database.getFirstSync('SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1') as any)?.hash ?? 'GENESIS';
    const deviceId = (database.getFirstSync('SELECT device_id FROM sync_meta WHERE id = 1') as any)?.device_id ?? 'mobile';
    const uuid = randomUUIDCompat();
    const info = database.runSync(
      'INSERT INTO audit_logs (entity, entity_id, action, old_value, new_value, description, device_id, user_id, created_at, uuid, source_device) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [entity, entityId, action, oldValue, newValue, description, deviceId, getCurrentUserIdSafe(), new Date().toISOString(), uuid, deviceId]
    );
    const id = Number((info as any)?.lastInsertRowId ?? info);
    const row = database.getFirstSync('SELECT * FROM audit_logs WHERE id = ?', [id]) as any;
    const hash = sha256Hex(auditCanonical(prev, row));
    database.runSync('UPDATE audit_logs SET prev_hash = ?, hash = ?, is_synced = 0 WHERE id = ?', [prev, hash, id]);
  } catch (error) {
    console.warn('[audit] failed', error);
  }
};

/** Verify the audit chain. Returns { ok, count, brokenAt }. */
export const verifyAuditChain = (): { ok: boolean; count: number; brokenAt: number | null } => {
  const database = getDB();
  const rows = database.getAllSync('SELECT * FROM audit_logs ORDER BY id ASC') as any[];
  let prev = 'GENESIS';
  for (const r of rows) {
    const expected = sha256Hex(auditCanonical(prev, r));
    if (r.prev_hash !== prev || r.hash !== expected) {
      return { ok: false, count: rows.length, brokenAt: r.id };
    }
    prev = r.hash;
  }
  return { ok: true, count: rows.length, brokenAt: null };
};

export const getAuditLogs = (limit: number = 100): any[] => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit]);
  } catch (error) {
    console.error('Get audit logs error:', error);
    return [];
  }
};

export const insertCategory = (name: string, icon: string, isCustom: boolean) => {
  try {
    const database = getDB();
    const statement = database.prepareSync('INSERT INTO categories (name, icon, isCustom, businessId) VALUES (?, ?, ?, ?)');
    const result = statement.executeSync([name, icon, isCustom ? 1 : 0, getScopedBusinessId()]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert category error:', error);
    return null;
  }
};

export const getCategories = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync('SELECT * FROM categories WHERE businessId = ?', [bizId]);
  } catch (error) {
    console.error('Get categories error:', error);
    return [];
  }
};

export const getUserCategories = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync('SELECT * FROM categories WHERE isCustom = 1 AND businessId = ?', [bizId]);
  } catch (error) {
    console.error('Get user categories error:', error);
    return [];
  }
};

export const seedDefaultCategories = (categories: { name: string, icon: string }[]) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const existingCount = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories WHERE businessId = ?', [bizId]);

    if (existingCount && existingCount.count === 0) {
      const statement = database.prepareSync('INSERT INTO categories (name, icon, isCustom, businessId) VALUES (?, ?, 0, ?)');
      for (const cat of categories) {
        statement.executeSync([cat.name, cat.icon, bizId]);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('Seed categories error:', error);
    return false;
  }
};

export interface ItemData {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  companyName: string;
  sku: string | null;
  barcode: string | null;
  image: string | null;
  taxType: string | null;
  purchaseUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  totalPackQuantity: number;
  totalBaseQuantity: number;
  packPurchasePrice: number;
  basePurchasePrice: number;
  baseSellingPrice: number;
  packSellingPrice: number;
  allowSellByBaseUnit: boolean;
  allowSellByPackUnit: boolean;
  expiryDate: string | null;
  qualityGrade: string;
  notes: string;
  isCredit: boolean;
  isActive: boolean;
  supplierPhone: string | null;
  supplierAccount: string | null;
  supplierCallEnabled: boolean;
  reorderPoint: number;
  reorderQty: number;
  autoReorder: boolean;
  lastPriceCheckAt: string | null;
  createdAt: string;
  creditQuantity?: number;
  creditAmount?: number;
  wholesaleSellingPrice?: number | null;
  minWholesaleQty?: number | null;
  transportCost?: number | null;
  importCost?: number | null;
  packagingCost?: number | null;
  handlingCost?: number | null;
  otherCost?: number | null;
  targetMargin?: number | null;
  taxTreatment?: string | null;
}

export interface InsertItemData {
  name: string;
  categoryId: number;
  sku?: string | null;
  barcode?: string | null;
  image?: string | null;
  taxType?: string | null;
  companyName: string;
  purchaseUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  totalPackQuantity: number;
  totalBaseQuantity: number;
  packPurchasePrice: number;
  basePurchasePrice: number;
  baseSellingPrice: number;
  packSellingPrice: number;
  allowSellByBaseUnit: boolean;
  allowSellByPackUnit: boolean;
  expiryDate?: string;
  qualityGrade?: string;
  notes?: string;
  isCredit: boolean;
  supplierPhone?: string;
  supplierAccount?: string;
  supplierCallEnabled?: boolean;
  warehouseId?: number | null;
  supplierId?: number | null;
  supplierPaymentStatus?: string;
  supplierPaidAmount?: number;
  dueDate?: string;
  lastPriceCheckAt?: string;
  isActive?: boolean;
  wholesaleSellingPrice?: number | null;
  minWholesaleQty?: number | null;
  transportCost?: number | null;
  importCost?: number | null;
  packagingCost?: number | null;
  handlingCost?: number | null;
  otherCost?: number | null;
  targetMargin?: number | null;
  taxTreatment?: string | null;
}

export const getNextItemId = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return 1;
    const result = database.getFirstSync<{ maxId: number }>('SELECT MAX(id) as maxId FROM items WHERE businessId = ?', [bizId]);
    return (result?.maxId || 0) + 1;
  } catch (error) {
    console.error('Get next item ID error:', error);
    return 1;
  }
};

// Records a stock-add event so the activity feed can show historical
// additions instead of live (shrinking) stock levels. When a supplierId is
// provided the movement doubles as a purchase record for that supplier.
export const logStockMovement = (
  itemId: number,
  quantityAdded: number,
  unit?: string,
  note?: string,
  supplierId?: number | null,
  unitPrice?: number,
  paymentStatus?: string,
  paidAmount?: number
) => {
  try {
    if (!itemId || !quantityAdded || quantityAdded <= 0) return;
    const database = getDB();
    database.runSync(
      `INSERT INTO stock_movements (itemId, quantityAdded, unit, note, supplierId, unitPrice, paymentStatus, paidAmount, user_id, type, quantity, referenceType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'restock_in', ?, 'restock')`,
      itemId,
      quantityAdded,
      unit || null,
      note || null,
      getCurrentUserIdSafe(),
      supplierId || null,
      unitPrice || 0,
      paymentStatus || null,
      paidAmount || 0,
      quantityAdded
    );
  } catch (error) {
    console.error('Log stock movement error:', error);
  }
};

// Internal: insert a single price-history entry for an item/field.
const recordPriceHistory = (itemId: number, field: string, oldValue: number | null, newValue?: number | null) => {
  try {
    const database = getDB();
    const nv = newValue === undefined ? oldValue : newValue;
    database.runSync(
      `INSERT INTO item_price_history (itemId, field, oldValue, newValue) VALUES (?, ?, ?, ?)`,
      itemId, field, oldValue ?? null, nv ?? null
    );
  } catch (error) {
    console.error('Record price history error:', error);
  }
};

// Public: compare an item's stored pricing fields against supplied updates and
// log every changed value so price-history reporting stays current. Used by
// updateItem so edits from any screen (wizard, item-details, etc.) are tracked.
export const logItemPriceChanges = (id: number, updates: any) => {
  try {
    const database = getDB();
    const current = database.getFirstSync<any>(
      'SELECT basePurchasePrice, baseSellingPrice, packSellingPrice, wholesaleSellingPrice FROM items WHERE id = ?', [id]
    );
    if (!current) return;
    const tests: [string, any, number | null][] = [
      ['purchase', updates.basePurchasePrice, current.basePurchasePrice],
      ['selling', updates.baseSellingPrice, current.baseSellingPrice],
      ['pack_selling', updates.packSellingPrice, current.packSellingPrice],
      ['wholesale', updates.wholesaleSellingPrice, current.wholesaleSellingPrice],
    ];
    for (const [field, next, prev] of tests) {
      if (next === undefined) continue;
      const nextVal = next === null ? null : Number(next);
      if (nextVal === prev) continue;
      if (prev !== null && nextVal !== null && Math.abs(nextVal - prev) < 0.001) continue;
      recordPriceHistory(id, field, prev ?? null, nextVal ?? null);
    }
  } catch (error) {
    console.error('Log item price changes error:', error);
  }
};

// Public: latest price history for an item (most recent first).
export const getPriceHistory = (itemId: number, limit: number = 20) => {
  try {
    const database = getDB();
    return database.getAllSync<any>(
      'SELECT * FROM item_price_history WHERE itemId = ? AND is_deleted = 0 ORDER BY id DESC LIMIT ?',
      [itemId, limit]
    );
  } catch (error) {
    console.error('Get price history error:', error);
    return [];
  }
};

export const insertItem = (data: InsertItemData) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO items (name, categoryId, sku, barcode, image, taxType, companyName, purchaseUnit, baseUnit, unitsPerPack, totalPackQuantity, totalBaseQuantity, packPurchasePrice, basePurchasePrice, baseSellingPrice, packSellingPrice, allowSellByBaseUnit, allowSellByPackUnit, expiryDate, qualityGrade, notes, isCredit, supplierPhone, supplierAccount, supplierCallEnabled, warehouseId, dueDate, lastPriceCheckAt, isActive, wholesaleSellingPrice, minWholesaleQty, transportCost, importCost, packagingCost, handlingCost, otherCost, targetMargin, taxTreatment, businessId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      data.name, data.categoryId, data.sku || null, data.barcode || null, data.image || null, data.taxType || null, data.companyName || null, data.purchaseUnit || 'pcs', data.baseUnit || 'pcs', data.unitsPerPack || 0, data.totalPackQuantity || 0, data.totalBaseQuantity || 0, data.packPurchasePrice || 0, data.basePurchasePrice || 0, data.baseSellingPrice || 0, data.packSellingPrice || 0, data.allowSellByBaseUnit ? 1 : 0, data.allowSellByPackUnit ? 1 : 0, data.expiryDate || null, data.qualityGrade || null, data.notes || null, data.isCredit ? 1 : 0, data.supplierPhone || null, data.supplierAccount || null, data.supplierCallEnabled ? 1 : 0, data.warehouseId ?? null, data.dueDate || null, data.lastPriceCheckAt || null, data.isActive === false ? 0 : 1, data.wholesaleSellingPrice ?? null, data.minWholesaleQty ?? null, data.transportCost ?? 0, data.importCost ?? 0, data.packagingCost ?? 0, data.handlingCost ?? 0, data.otherCost ?? 0, data.targetMargin ?? null, data.taxTreatment || null, getScopedBusinessId(), null
    ]);
    const newId = result.lastInsertRowId;
    // Log the initial stock as a movement so it appears in the activity feed.
    if (newId && (data.totalBaseQuantity || 0) > 0) {
      logStockMovement(
        newId,
        data.totalBaseQuantity,
        data.baseUnit || data.purchaseUnit || 'pcs',
        'Initial stock',
        data.supplierId || null,
        data.basePurchasePrice || 0,
        data.supplierPaymentStatus,
        data.supplierPaidAmount
      );
    }
    // Record the item's initial pricing baseline for price-history reporting.
    recordPriceHistory(newId, 'purchase', data.basePurchasePrice || 0);
    recordPriceHistory(newId, 'selling', data.baseSellingPrice || 0);
    if (data.wholesaleSellingPrice) recordPriceHistory(newId, 'wholesale', data.wholesaleSellingPrice);
    // Link the item to its supplier so multi-supplier relationships work.
    if (newId && data.supplierId) {
      database.runSync(
        'INSERT OR IGNORE INTO item_suppliers (itemId, supplierId) VALUES (?, ?)',
        newId, data.supplierId
      );
    }
    return newId;
  } catch (error) {
    console.error('Insert item error:', error);
    return null;
  }
};

export const getItems = (activeOnly: boolean = true) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const whereClause = activeOnly ? 'WHERE items.is_deleted = 0 AND items.isActive = 1 AND items.businessId = ?' : 'WHERE items.is_deleted = 0 AND items.businessId = ?';
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId 
      ${whereClause}
      ORDER BY items.id DESC
    `, [bizId]);
  } catch (error) {
    console.error('Get items error:', error);
    return [];
  }
};

export const findItemsByNameInCategory = (name: string, categoryId: number | null): any[] => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const catId = categoryId == null ? 0 : Number(categoryId);
    return database.getAllSync(`
      SELECT * FROM items
      WHERE items.is_deleted = 0 AND items.businessId = ?
        AND LOWER(TRIM(items.name)) = LOWER(TRIM(?))
        AND COALESCE(items.categoryId, 0) = ?
      LIMIT 5
    `, [bizId, name, catId]);
  } catch (error) {
    console.error('Find items by name error:', error);
    return [];
  }
};

export const toggleItemActive = (itemId: number, isActive: boolean) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    database.runSync(`
      UPDATE items SET isActive = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND businessId = ?
    `, [isActive ? 1 : 0, itemId, bizId]);
    return true;
  } catch (error) {
    console.error('Toggle item active error:', error);
    return false;
  }
};

export const getItemById = (id: number, activeOnly: boolean = true) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const whereClause = activeOnly ? 'WHERE items.id = ? AND items.is_deleted = 0 AND items.isActive = 1 AND items.businessId = ?' : 'WHERE items.id = ? AND items.is_deleted = 0 AND items.businessId = ?';
    return database.getFirstSync(`
      SELECT items.*, categories.name as categoryName
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      ${whereClause}
    `, [id, bizId]);
  } catch (error) {
    console.error('Get item by ID error:', error);
    return null;
  }
};

export const getItemByBarcode = (code: string, activeOnly: boolean = true) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const activeClause = activeOnly ? 'AND items.is_deleted = 0 AND items.isActive = 1' : 'AND items.is_deleted = 0';
    return database.getFirstSync(`
      SELECT items.*, categories.name as categoryName
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE (items.barcode = ? COLLATE NOCASE 
         OR items.sku = ? COLLATE NOCASE
         OR EXISTS (
           SELECT 1 FROM item_barcodes ib 
           WHERE ib.itemId = items.id 
           AND ib.barcode = ? COLLATE NOCASE 
           AND ib.is_deleted = 0
           AND ib.businessId = items.businessId
         ))
      AND items.businessId = ?
      ${activeClause}
      LIMIT 1
    `, [code, code, code, bizId]);
  } catch (error) {
    console.error('Get item by barcode error:', error);
    return null;
  }
};

export const getItemBarcodes = (itemId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT * FROM item_barcodes 
      WHERE itemId = ? AND is_deleted = 0 AND businessId = ?
      ORDER BY isPrimary DESC, id ASC
    `, [itemId, bizId]);
  } catch (error) {
    console.error('Get item barcodes error:', error);
    return [];
  }
};

export const addItemBarcode = (itemId: number, barcode: string, isPrimary: boolean = false) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    
    // If setting as primary, unset other primary barcodes for this item
    if (isPrimary) {
      database.runSync(`
        UPDATE item_barcodes SET isPrimary = 0 WHERE itemId = ? AND is_deleted = 0 AND businessId = ?
      `, [itemId, bizId]);
    }
    
    const statement = database.prepareSync(`
      INSERT INTO item_barcodes (itemId, barcode, isPrimary, businessId)
      VALUES (?, ?, ?, ?)
    `);
    const result = statement.executeSync([itemId, barcode, isPrimary ? 1 : 0, bizId]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Add item barcode error:', error);
    return null;
  }
};

export const removeItemBarcode = (barcodeId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    database.runSync(`
      UPDATE item_barcodes SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND businessId = ?
    `, [barcodeId, bizId]);
    return true;
  } catch (error) {
    console.error('Remove item barcode error:', error);
    return false;
  }
};

export const setPrimaryBarcode = (barcodeId: number, itemId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    database.runSync(`
      UPDATE item_barcodes SET isPrimary = 0 WHERE itemId = ? AND is_deleted = 0 AND businessId = ?
    `, [itemId, bizId]);
    database.runSync(`
      UPDATE item_barcodes SET isPrimary = 1 WHERE id = ? AND businessId = ?
    `, [barcodeId, bizId]);
    return true;
  } catch (error) {
    console.error('Set primary barcode error:', error);
    return false;
  }
};

// Quick Products / Favorites
export const getQuickProducts = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName, qp.position
      FROM quick_products qp
      JOIN items ON qp.itemId = items.id AND items.businessId = qp.businessId
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE qp.is_deleted = 0 AND items.is_deleted = 0 AND qp.businessId = ?
      ORDER BY qp.position ASC
    `, [bizId]);
  } catch (error) {
    console.error('Get quick products error:', error);
    return [];
  }
};

export const addQuickProduct = (itemId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const existing = database.getFirstSync<{ id: number }>(
      'SELECT id FROM quick_products WHERE itemId = ? AND is_deleted = 0 AND businessId = ?',
      [itemId, bizId]
    );
    if (existing) return true;
    // Get the next position
    const maxPos = database.getFirstSync<{ maxPos: number }>(
      'SELECT MAX(position) as maxPos FROM quick_products WHERE is_deleted = 0 AND businessId = ?',
      [bizId]
    );
    const nextPosition = (maxPos?.maxPos ?? -1) + 1;
    
    const statement = database.prepareSync(`
      INSERT INTO quick_products (itemId, position, businessId)
      VALUES (?, ?, ?)
    `);
    statement.executeSync([itemId, nextPosition, bizId]);
    return true;
  } catch (error) {
    console.error('Add quick product error:', error);
    return false;
  }
};

export const removeQuickProduct = (itemId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    database.runSync(`
      UPDATE quick_products SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE itemId = ? AND businessId = ?
    `, [itemId, bizId]);
    return true;
  } catch (error) {
    console.error('Remove quick product error:', error);
    return false;
  }
};

export const reorderQuickProducts = (itemIds: number[]) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const statement = database.prepareSync(`
      UPDATE quick_products SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE itemId = ? AND businessId = ?
    `);
    itemIds.forEach((itemId, index) => {
      statement.executeSync([index, itemId, bizId]);
    });
    return true;
  } catch (error) {
    console.error('Reorder quick products error:', error);
    return false;
  }
};

export const isQuickProduct = (itemId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const result = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM quick_products WHERE itemId = ? AND is_deleted = 0 AND businessId = ?',
      [itemId, bizId]
    );
    return (result?.count ?? 0) > 0;
  } catch (error) {
    console.error('Check quick product error:', error);
    return false;
  }
};
// Returns items flagged with supplierCallEnabled that have had a price
// adjustment (price_up / price_down) within the last `days` days.
// Used by the weekly "should I call the supplier?" notification.
export const getItemsWithRecentPriceChanges = (days: number = 7) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT
        i.id              AS itemId,
        i.name            AS itemName,
        i.companyName     AS companyName,
        i.supplierPhone   AS supplierPhone,
        i.supplierAccount AS supplierAccount,
        i.baseSellingPrice AS currentPrice,
        i.basePurchasePrice AS currentCost,
        i.lastPriceCheckAt AS lastPriceCheckAt,
        a.type            AS changeType,
        a.oldValue        AS oldValue,
        a.newValue        AS newValue,
        a.date            AS changeDate,
        a.createdAt       AS changeCreatedAt
      FROM items i
      INNER JOIN adjustments a ON a.itemId = i.id AND a.businessId = i.businessId
      WHERE i.supplierCallEnabled = 1
        AND i.businessId = ?
        AND a.type IN ('price_up', 'price_down')
        AND date(a.createdAt) >= date('now', ?)
        AND a.id = (
          SELECT a2.id FROM adjustments a2
          WHERE a2.itemId = i.id
            AND a2.businessId = i.businessId
            AND a2.type IN ('price_up', 'price_down')
          ORDER BY a2.createdAt DESC
          LIMIT 1
        )
      ORDER BY a.createdAt DESC
    `, [bizId, `-${days} days`]);
  } catch (error) {
    console.error('getItemsWithRecentPriceChanges error:', error);
    return [];
  }
};

// Returns items that have supplierCallEnabled = 1 and either have
// no lastPriceCheckAt or it is older than `days` days â€” used to
// surface a weekly reminder even when no price change happened.
export const getItemsDueForSupplierCheck = (days: number = 7) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT id AS itemId, name AS itemName, companyName, supplierPhone, supplierAccount,
             baseSellingPrice AS currentPrice, lastPriceCheckAt
      FROM items
      WHERE supplierCallEnabled = 1
        AND businessId = ?
        AND (lastPriceCheckAt IS NULL OR date(lastPriceCheckAt) < date('now', ?))
      ORDER BY name ASC
    `, [bizId, `-${days} days`]);
  } catch (error) {
    console.error('getItemsDueForSupplierCheck error:', error);
    return [];
  }
};

export const getSaleById = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    return database.getFirstSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId 
      WHERE sales.id = ? AND sales.businessId = ?
    `, [id, bizId]);
  } catch (error) {
    console.error('Get sale by ID error:', error);
    return null;
  }
};

export const getSaleWithItemsById = (id: number | string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;

    // If id is a string, it could be a batchId or a numeric ID cast to string
    if (typeof id === 'string') {
      // Try batchId first
      const items = database.getAllSync(`
        SELECT s.*, i.name as itemName, i.baseUnit, i.image
        FROM sales s
        LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
        WHERE s.batchId = ? AND s.businessId = ?
        ORDER BY s.id ASC
      `, [id, bizId]);
      if (items.length > 0) {
        const first = items[0] as any;
        return {
          isBatch: true,
          batchId: id,
          id: first.id,
          totalPrice: items.reduce((sum: number, it: any) => sum + (it.totalPrice || 0), 0),
          quantity: items.length,
          itemName: items.length > 1
            ? (items[0] as any)?.itemName + ' +' + (items.length - 1) + ' more'
            : (items[0] as any)?.itemName,
          customerName: first.customerName,
          customerPhone: first.customerPhone,
          paymentMethod: first.paymentMethod,
          paymentStatus: first.paymentStatus,
          discount: first.discount,
          vat: first.vat,
          createdAt: first.createdAt,
          dueDate: first.dueDate,
          items,
        };
      }
      // Fallback: try as numeric ID
      const numId = parseInt(id, 10);
      if (!isNaN(numId)) {
        const single = database.getFirstSync(`
          SELECT sales.*, items.name as itemName, items.baseUnit, items.image
          FROM sales
          LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId
          WHERE sales.id = ? AND sales.businessId = ?
        `, [numId, bizId]);
        if (!single) return null;
        const bId = (single as any).batchId;
        if (!bId) return { ...single, isBatch: false };
        const batchItems = database.getAllSync(`
          SELECT s.*, i.name as itemName, i.baseUnit, i.image
          FROM sales s
          LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
          WHERE s.batchId = ? AND s.businessId = ?
          ORDER BY s.id ASC
        `, [bId, bizId]);
        return {
          isBatch: true,
          batchId: bId,
          id: (single as any).id,
          totalPrice: batchItems.reduce((sum: number, it: any) => sum + (it.totalPrice || 0), 0),
          quantity: batchItems.length,
          itemName: batchItems.length > 1
            ? (batchItems[0] as any)?.itemName + ' +' + (batchItems.length - 1) + ' more'
            : (batchItems[0] as any)?.itemName,
          customerName: (single as any).customerName,
          customerPhone: (single as any).customerPhone,
          paymentMethod: (single as any).paymentMethod,
          paymentStatus: (single as any).paymentStatus,
          discount: (single as any).discount,
          vat: (single as any).vat,
          createdAt: (single as any).createdAt,
          dueDate: (single as any).dueDate,
          items: batchItems,
        };
      }
      return null;
    }

    // Numeric ID path
    const first = database.getFirstSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit, items.image
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId 
      WHERE sales.id = ? AND sales.businessId = ?
    `, [id, bizId]);
    if (!first) return null;

    const bId = (first as any).batchId;
    if (!bId) {
      return { ...first, isBatch: false };
    }

    const items = database.getAllSync(`
      SELECT s.*, i.name as itemName, i.baseUnit, i.image
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      WHERE s.batchId = ? AND s.businessId = ?
      ORDER BY s.id ASC
    `, [bId, bizId]);

    return {
      isBatch: true,
      batchId: bId,
      id: (first as any).id,
      totalPrice: items.reduce((sum: number, it: any) => sum + (it.totalPrice || 0), 0),
      quantity: items.length,
      itemName: items.length > 1
        ? (items[0] as any)?.itemName + ' +' + (items.length - 1) + ' more'
        : (items[0] as any)?.itemName,
      customerName: (first as any).customerName,
      customerPhone: (first as any).customerPhone,
      paymentMethod: (first as any).paymentMethod,
      paymentStatus: (first as any).paymentStatus,
      discount: (first as any).discount,
      vat: (first as any).vat,
      createdAt: (first as any).createdAt,
      dueDate: (first as any).dueDate,
      items,
    };
  } catch (error) {
    console.error('Get sale with items by ID error:', error);
    return null;
  }
};

export interface FilterOptions {
  search?: string;
  category?: string;
  date?: string;
  sortBy?: string;
  limit?: number;
}

export const getFilteredItems = (options: FilterOptions) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    let query = `SELECT items.*, categories.name as categoryName FROM items LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId`;
    const params: any[] = [];
    const conditions: string[] = ['items.businessId = ?'];
    params.push(bizId);

    if (options.search) {
      conditions.push('(items.name LIKE ? OR items.companyName LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.category && options.category !== 'All') {
      conditions.push('categories.name = ?');
      params.push(options.category);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    let orderBy = 'items.id DESC';
    if (options.sortBy === 'name_asc' || options.sortBy === 'Name A-Z') orderBy = 'items.name ASC';
    else if (options.sortBy === 'name_desc' || options.sortBy === 'Name Z-A') orderBy = 'items.name DESC';
    else if (options.sortBy === 'price_asc' || options.sortBy === 'Price Low-High') orderBy = 'items.baseSellingPrice ASC';
    else if (options.sortBy === 'price_desc' || options.sortBy === 'Price High-Low') orderBy = 'items.baseSellingPrice DESC';
    else if (options.sortBy === 'qty_asc' || options.sortBy === 'Quantity Low-High') orderBy = 'items.totalBaseQuantity ASC';
    else if (options.sortBy === 'qty_desc' || options.sortBy === 'Quantity High-Low') orderBy = 'items.totalBaseQuantity DESC';

    query += ` ORDER BY ${orderBy}`;

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get filtered items error:', error);
    return [];
  }
};

export const insertSale = (saleData: {
  itemId: number;
  quantity: number;
  unit: string;
  unitType: string;
  totalPrice: number;
  discount?: number;
  vat?: number;
  taxType?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
  packId?: number;
  batchId?: string;
  dueDate?: string;
  notes?: string;
  paidAmount?: number;
  orderNumber?: string;
  convertedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  /** user id recorded for activity attribution (defaults to signed-in user) */
  userId?: string | null;
}) => {
  const database = getDB();
  beginTransaction(database);
  try {
    const bizId = getScopedBusinessId();
    const item = database.getFirstSync<{ unitsPerPack: number; totalBaseQuantity: number; totalPackQuantity: number }>(
      'SELECT unitsPerPack, totalBaseQuantity, totalPackQuantity FROM items WHERE id = ? AND businessId = ?',
      [saleData.itemId, bizId]
    );
    if (!item) {
      throw new Error(`Item ${saleData.itemId} not found`);
    }

    let baseQty = saleData.quantity;
    let packQty = 0;
    if (saleData.unitType === 'pack' && item.unitsPerPack) {
      baseQty = saleData.quantity * item.unitsPerPack;
      packQty = saleData.quantity;
    }

    if (item.totalBaseQuantity < baseQty || item.totalPackQuantity < packQty) {
      throw new Error(`Insufficient stock for item ${saleData.itemId}: need ${baseQty} base / ${packQty} pack, have ${item.totalBaseQuantity} base / ${item.totalPackQuantity} pack`);
    }

    // Insert the sale record (attributed to the signed-in user)
    const statement = database.prepareSync(`
      INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, taxType, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, packId, batchId, dueDate, notes, paidAmount, orderNumber, convertedAt, cancelledAt, user_id, businessId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      saleData.itemId, saleData.quantity, saleData.unit, saleData.unitType,
      saleData.discount || 0, saleData.vat || 0, saleData.taxType || 'VAT', saleData.totalPrice,
      saleData.paymentMethod || null, saleData.paymentStatus || 'Paid',
      saleData.customerName || null, saleData.customerPhone || null,
      saleData.packId || null, saleData.batchId || null,
      saleData.dueDate || null, saleData.notes || null,
      saleData.paidAmount ?? (saleData.paymentStatus === 'Paid' ? saleData.totalPrice : null),
      saleData.orderNumber || null, saleData.convertedAt || null,
      saleData.cancelledAt || null,
      saleData.userId || getCurrentUserIdSafe(),
      bizId || null,
      saleData.createdAt || null
    ]);

    // Update inventory quantities
    database.runSync(
      'UPDATE items SET totalBaseQuantity = totalBaseQuantity - ?, totalPackQuantity = totalPackQuantity - ? WHERE id = ? AND businessId = ?',
      [baseQty, packQty, saleData.itemId, bizId]
    );

    commitTransaction(database);
    const saleId = result.lastInsertRowId;
    auditLog('sale', Number(saleId), 'sale.create', null, JSON.stringify({ itemId: saleData.itemId, quantity: saleData.quantity, unit: saleData.unitType, total: saleData.totalPrice, method: saleData.paymentMethod }), `Sale #${saleId} recorded`);
    return saleId;
  } catch (error) {
    rollbackTransaction(database);
    console.error('Insert sale error:', error);
    return null;
  }
};

export const getSales = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId 
      WHERE paymentStatus != 'Order' AND sales.businessId = ?
      ORDER BY sales.id DESC
    `, [bizId]);
  } catch (error) {
    console.error('Get sales error:', error);
    return [];
  }
};

export const getSalesByDateRange = (startDate: string, endDate: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId 
      WHERE date(sales.createdAt) >= ? AND date(sales.createdAt) <= ? AND paymentStatus != 'Order' AND sales.businessId = ?
      ORDER BY sales.createdAt DESC
    `, [startDate, endDate, bizId]);
  } catch (error) {
    console.error('Get sales by date range error:', error);
    return [];
  }
};

export const getFilteredSales = (options: FilterOptions) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    let query = `SELECT sales.*, items.name as itemName, items.baseUnit FROM sales LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId`;
    const params: any[] = [];
    const conditions: string[] = ['sales.businessId = ?'];
    params.push(bizId);

    if (options.search) {
      conditions.push('(items.name LIKE ? OR sales.customerName LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.category && options.category !== 'All') {
      conditions.push('categories.name = ?');
      params.push(options.category);
    }

    if (options.date) {
      conditions.push('date(sales.createdAt) = ?');
      params.push(options.date);
    }

    conditions.push("paymentStatus != 'Order'");

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    let orderBy = 'sales.createdAt DESC';
    if (options.sortBy === 'amount_desc' || options.sortBy === 'Highest Amount') orderBy = 'sales.totalPrice DESC';
    else if (options.sortBy === 'amount_asc' || options.sortBy === 'Lowest Amount') orderBy = 'sales.totalPrice ASC';

    query += ` ORDER BY ${orderBy}`;

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get filtered sales error:', error);
    return [];
  }
};

export const insertAdjustment = (adj: any) => {
  const database = getDB();
  beginTransaction(database);
  try {
    const bizId = getScopedBusinessId();
    // 1. Log the adjustment
    const statement = database.prepareSync(`
      INSERT INTO adjustments (itemId, type, oldValue, newValue, quantity, unitType, reason, user_id, date, businessId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      adj.itemId, adj.type, adj.oldValue, adj.newValue, adj.quantity, adj.unitType, adj.reason, adj.userId || getCurrentUserIdSafe(), adj.date, bizId || null, adj.createdAt || null
    ]);

    // 2. Update the item based on adjustment type
    if (adj.type === 'price_up' || adj.type === 'price_down') {
      database.runSync('UPDATE items SET baseSellingPrice = ? WHERE id = ? AND businessId = ?', [adj.newValue, adj.itemId, bizId]);
      
      // Also update pack price proportionally if unitsPerPack exists
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ? AND businessId = ?', [adj.itemId, bizId]) as any;
      if (item && item.unitsPerPack) {
        const newPackPrice = adj.newValue * item.unitsPerPack;
        database.runSync('UPDATE items SET packSellingPrice = ? WHERE id = ? AND businessId = ?', [newPackPrice, adj.itemId, bizId]);
      }
    } else if (adj.type === 'damaged') {
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ? AND businessId = ?', [adj.itemId, bizId]) as any;
      if (item) {
        let baseDeduction = adj.quantity;
        let packDeduction = 0;

        if (adj.unitType === 'pack') {
          baseDeduction = adj.quantity * (item.unitsPerPack || 1);
          packDeduction = adj.quantity;
        } else {
          packDeduction = adj.quantity / (item.unitsPerPack || 1);
        }

        database.runSync(
          'UPDATE items SET totalBaseQuantity = totalBaseQuantity - ?, totalPackQuantity = totalPackQuantity - ? WHERE id = ? AND businessId = ?',
          [baseDeduction, packDeduction, adj.itemId, bizId]
        );
      }
    }

    commitTransaction(database);
    return result.lastInsertRowId;
  } catch (error) {
    rollbackTransaction(database);
    console.error('Insert adjustment error:', error);
    return null;
  }
};

export const getRecentAdjustments = (type?: string, limit: number = 20) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    let query = `
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.baseSellingPrice, items.packPurchasePrice
      FROM adjustments 
      LEFT JOIN items ON adjustments.itemId = items.id AND items.businessId = adjustments.businessId
    `;
    const params: any[] = [bizId];
    
    if (type) {
      query += ' WHERE adjustments.businessId = ? AND type = ?';
      params.push(type);
    } else {
      query += ' WHERE adjustments.businessId = ?';
    }
    
    query += ' ORDER BY createdAt DESC LIMIT ?';
    params.push(limit);
    
    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get adjustments error:', error);
    return [];
  }
};

export const getFilteredAdjustments = (filters: { type?: string; period?: string; search?: string } = {}) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.type) {
      conditions.push('adjustments.type = ?');
      params.push(filters.type);
    }

    if (filters.period) {
      const now = new Date();
      if (filters.period === 'today') {
        const dateStr = now.toISOString().split('T')[0];
        conditions.push("date(adjustments.createdAt) = date(?)");
        params.push(dateStr);
      } else if (filters.period === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        conditions.push("date(adjustments.createdAt) >= date(?)");
        params.push(weekStart.toISOString().split('T')[0]);
      } else if (filters.period === 'month') {
        conditions.push("strftime('%Y-%m', adjustments.createdAt) = strftime('%Y-%m', 'now')");
      } else if (filters.period === 'year') {
        conditions.push("strftime('%Y', adjustments.createdAt) = strftime('%Y', 'now')");
      }
    }

    if (filters.search) {
      conditions.push("(items.name LIKE ? OR adjustments.reason LIKE ?)");
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    conditions.push('adjustments.businessId = ?');
    params.push(bizId);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.baseSellingPrice, items.packPurchasePrice
      FROM adjustments
      LEFT JOIN items ON adjustments.itemId = items.id AND items.businessId = adjustments.businessId
      ${where}
      ORDER BY adjustments.createdAt DESC
    `;

    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get filtered adjustments error:', error);
    return [];
  }
};

export const deleteAdjustment = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const adj = database.getFirstSync('SELECT * FROM adjustments WHERE id = ? AND businessId = ?', [id, bizId]) as any;
    if (!adj) return false;

    // Only restore items quantity if it was damaged
    if (adj.type === 'damaged') {
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ? AND businessId = ?', [adj.itemId, bizId]) as any;
      if (item) {
        let baseRefund = adj.quantity;
        let packRefund = 0;
        if (adj.unitType === 'pack') {
          baseRefund = adj.quantity * (item.unitsPerPack || 1);
          packRefund = adj.quantity;
        } else {
          packRefund = adj.quantity / (item.unitsPerPack || 1);
        }
        database.runSync(
          'UPDATE items SET totalBaseQuantity = totalBaseQuantity + ?, totalPackQuantity = totalPackQuantity + ? WHERE id = ? AND businessId = ?',
          [baseRefund, packRefund, adj.itemId, bizId]
        );
      }
    }
    
    // For price_up/price_down, reverting price is risky if new adjustments exist, so we only delete the log.
    database.runSync('DELETE FROM adjustments WHERE id = ? AND businessId = ?', [id, bizId]);
    return true;
  } catch (error) {
    console.error('Delete adjustment error:', error);
    return false;
  }
};

export const updateAdjustment = (adjId: number, data: { quantity?: number, newValue?: number, reason?: string }) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const existing = database.getFirstSync('SELECT * FROM adjustments WHERE id = ? AND businessId = ?', [adjId, bizId]) as any;
    if (!existing) return false;

    // Update the record
    const updates = [];
    const params = [];
    if (data.quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(data.quantity);
      // Diff logic for damaged
      if (existing.type === 'damaged') {
        const diff = data.quantity - existing.quantity;
        if (diff !== 0) {
          const item = database.getFirstSync('SELECT * FROM items WHERE id = ? AND businessId = ?', [existing.itemId, bizId]) as any;
          if (item) {
            let baseDiff = diff;
            let packDiff = 0;
            if (existing.unitType === 'pack') {
              baseDiff = diff * (item.unitsPerPack || 1);
              packDiff = diff;
            } else {
              packDiff = diff / (item.unitsPerPack || 1);
            }
            database.runSync(
              'UPDATE items SET totalBaseQuantity = totalBaseQuantity - ?, totalPackQuantity = totalPackQuantity - ? WHERE id = ? AND businessId = ?',
              [baseDiff, packDiff, existing.itemId, bizId]
            );
          }
        }
      }
    }
    
    if (data.newValue !== undefined) {
      updates.push('newValue = ?');
      params.push(data.newValue);
      
      // Affect the current price
      if (existing.type === 'price_up' || existing.type === 'price_down') {
         database.runSync('UPDATE items SET baseSellingPrice = ? WHERE id = ? AND businessId = ?', [data.newValue, existing.itemId, bizId]);
         const item = database.getFirstSync('SELECT * FROM items WHERE id = ? AND businessId = ?', [existing.itemId, bizId]) as any;
         if (item && item.unitsPerPack) {
           const newPackPrice = data.newValue * item.unitsPerPack;
           database.runSync('UPDATE items SET packSellingPrice = ? WHERE id = ? AND businessId = ?', [newPackPrice, existing.itemId, bizId]);
         }
      }
    }

    if (data.reason !== undefined) {
      updates.push('reason = ?');
      params.push(data.reason);
    }

    if (updates.length > 0) {
      params.push(adjId);
      params.push(bizId);
      database.runSync(`UPDATE adjustments SET ${updates.join(', ')} WHERE id = ? AND businessId = ?`, ...params);
    }
    return true;
  } catch (error) {
    console.error('Update adjustment error:', error);
    return false;
  }
};

export const getActivityFeed = (options: { search?: string, date?: string, limit?: number } = {}) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const limit = options.limit || 50;

    // Build date condition
    const saleDateWhere = options.date ? "WHERE date(s.createdAt) = '" + options.date + "' AND s.businessId = '" + bizId + "'" : "WHERE s.businessId = '" + bizId + "'";
    const adjDateWhere = options.date ? "WHERE date(a.createdAt) = '" + options.date + "' AND a.businessId = '" + bizId + "'" : "WHERE a.businessId = '" + bizId + "'";
    

    // Sales (grouped by batchId)
    const sales = database.getAllSync(`
      SELECT 
        CASE 
          WHEN s.batchId IS NOT NULL THEN 'batch_sale' 
          ELSE 'sale' 
        END as type,
        'sale' as category,
        COALESCE(s.batchId, CAST(s.id AS TEXT)) as id,
        CASE 
          WHEN s.batchId IS NOT NULL THEN (
            SELECT SUM(sub.totalPrice) FROM sales sub WHERE sub.batchId = s.batchId AND sub.businessId = s.businessId
          )
          ELSE s.totalPrice 
        END as value,
        CASE 
          WHEN s.batchId IS NOT NULL THEN (
            SELECT COUNT(*) FROM sales sub WHERE sub.batchId = s.batchId AND sub.businessId = s.businessId
          )
          ELSE s.quantity 
        END as quantity,
        s.paymentMethod,
        s.customerName,
        s.paymentStatus,
        CASE 
          WHEN s.batchId IS NOT NULL THEN (
            SELECT GROUP_CONCAT(i2.name, ', ')
            FROM sales sub2
            JOIN items i2 ON sub2.itemId = i2.id AND i2.businessId = sub2.businessId
            WHERE sub2.batchId = s.batchId AND sub2.businessId = s.businessId
          )
          ELSE i.name 
        END as label,
        CASE 
          WHEN s.batchId IS NOT NULL THEN (
            SELECT MIN(sub3.createdAt) FROM sales sub3 WHERE sub3.batchId = s.batchId AND sub3.businessId = s.businessId
          )
          ELSE s.createdAt 
        END as createdAt,
        s.discount,
        s.vat,
        s.batchId,
        su.name as userName,
        su.avatar as userAvatar
      FROM sales s
      JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      LEFT JOIN users su ON s.user_id = su.id AND su.is_deleted = 0
      ${saleDateWhere}
      GROUP BY COALESCE(s.batchId, CAST(s.id AS TEXT))
      ORDER BY createdAt DESC
      LIMIT ${limit}
    `);

    // Adjustments with type info
    const adjustments = database.getAllSync(`
      SELECT 'adjustment' as type, 'adjustment' as category, a.id, a.newValue as value, a.quantity, a.type as adjType, a.oldValue, COALESCE(i.name, 'Item') as label, a.createdAt, i.basePurchasePrice, au.name as userName, au.avatar as userAvatar
      FROM adjustments a
      LEFT JOIN items i ON a.itemId = i.id AND i.businessId = a.businessId
      LEFT JOIN users au ON a.user_id = au.id AND au.is_deleted = 0
      ${adjDateWhere}
      ORDER BY a.createdAt DESC
      LIMIT ${limit}
    `);

    // Inventory additions â€” from the stock_movements log so each entry
    // reflects the actual quantity added at that time (not the live,
    // shrinking stock level).
    const inventory = database.getAllSync(`
      SELECT 'inventory' as type, 'inventory' as category, sm.id, (sm.quantityAdded * i.basePurchasePrice) as value, sm.quantityAdded as quantity, i.name as label, sm.createdAt, i.companyName, mu.name as userName, mu.avatar as userAvatar
      FROM stock_movements sm
      JOIN items i ON sm.itemId = i.id
      LEFT JOIN users mu ON sm.user_id = mu.id AND mu.is_deleted = 0
      ${options.date ? "WHERE date(sm.createdAt) = '" + options.date + "'" : ''}
      ORDER BY sm.createdAt DESC
      LIMIT ${limit}
    `);

    // Deletions — item deletes are audited with the acting user, so the feed
    // can show "who deleted what" alongside sales/adjustments/restocks.
    const deletions = (() => {
      try {
        return database.getAllSync(`
          SELECT 'deletion' as type, 'deletion' as category, al.id, NULL as value, NULL as quantity, COALESCE(al.old_value, 'Item') as label, al.created_at as createdAt, u.name as userName, u.avatar as userAvatar
          FROM audit_logs al
          LEFT JOIN users u ON al.user_id = u.id AND u.is_deleted = 0
          WHERE al.action = 'item.delete'
          ${options.date ? "AND date(al.created_at) = '" + options.date + "'" : ''}
          ORDER BY al.created_at DESC
          LIMIT ${limit}
        `);
      } catch {
        return [];
      }
    })();

    // Merge and sort by date
    const combined = [...sales, ...adjustments, ...inventory, ...deletions]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    if (options.search) {
      const q = options.search.toLowerCase();
      return combined.filter((item: any) => 
        item.label?.toLowerCase().includes(q) || item.type?.toLowerCase().includes(q)
      );
    }

    return combined;
  } catch (error) {
    console.error('Get activity feed error:', error);
    return [];
  }
};

export const getSalesSummary = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const today = new Date().toISOString().split('T')[0];
    
    // Total sales revenue and count today
    const salesToday = database.getFirstSync<{ total: number, count: number }>(`
      SELECT SUM(totalPrice) as total, COUNT(*) as count FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order' AND businessId = ?
    `, [today, bizId]);

    // Total returns refund today
    const returnsToday = database.getFirstSync<{ total: number }>(`
      SELECT SUM(totalRefund) as total FROM returns WHERE date(createdAt) = ? AND businessId = ?
    `, [today, bizId]);

    // Total volume (units) today
    const totalUnits = database.getFirstSync<{ volume: number }>(`
      SELECT SUM(quantity) as volume FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order' AND businessId = ?
    `, [today, bizId]);

    // Total returned quantity today
    const returnedQty = database.getFirstSync<{ qty: number }>(`
      SELECT SUM(CASE WHEN itemCondition = 'Resellable' THEN quantity ELSE 0 END) as qty FROM returns WHERE date(createdAt) = ? AND businessId = ?
    `, [today, bizId]);

    // Best hour of the day
    const bestHour = database.getFirstSync<{ hour: string }>(`
      SELECT strftime('%H', datetime(createdAt, 'localtime')) as hour, COUNT(*) as count 
      FROM sales 
      WHERE paymentStatus != 'Order' AND businessId = ?
      GROUP BY hour 
      ORDER BY count DESC 
      LIMIT 1
    `, [bizId]);

    // Payment method distribution
    const paymentDist = database.getAllSync<{ method: string, count: number }>(`
      SELECT paymentMethod as method, COUNT(*) as count 
      FROM sales 
      WHERE paymentStatus != 'Order' AND businessId = ?
      GROUP BY method
    `, [bizId]);

    const totalRev = salesToday?.total || 0;
    const totalRef = returnsToday?.total || 0;
    const salesCount = salesToday?.count || 0;

    return {
      avgSaleValue: salesCount > 0 ? (totalRev - totalRef) / salesCount : 0,
      totalVolume: (totalUnits?.volume || 0) - (returnedQty?.qty || 0),
      peakHour: bestHour?.hour || '--',
      payments: paymentDist
    };
  } catch (error) {
    console.error('Get sales summary error:', error);
    return null;
  }
};

export const getTopSellingItems = (limit: number = 5) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const today = new Date().toISOString().split('T')[0];
    const results = database.getAllSync(`
      SELECT items.*,
        SUM(sales.quantity) - COALESCE(r.returnedQty, 0) as totalQty,
        SUM(sales.totalPrice) - COALESCE(r.returnedRefund, 0) as totalRevenue,
        categories.name as categoryName
      FROM sales
      JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId
      LEFT JOIN (
        SELECT itemId, SUM(quantity) as returnedQty, SUM(totalRefund) as returnedRefund
        FROM returns
        WHERE date(createdAt) = ? AND businessId = ?
        GROUP BY itemId
      ) r ON items.id = r.itemId
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE date(sales.createdAt) = ? AND paymentStatus != 'Order' AND sales.businessId = ?
      GROUP BY items.id
      ORDER BY totalQty DESC
      LIMIT ?
    `, [today, bizId, today, bizId, limit]);
    return results;
  } catch (error) {
    console.error('Get top selling items error:', error);
    return [];
  }
};

export const getSlowMovingItems = (limit: number = 5) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const results = database.getAllSync(`
      SELECT items.*, COALESCE(SUM(sales.quantity), 0) as totalQty, categories.name as categoryName
      FROM items
      LEFT JOIN sales ON items.id = sales.itemId AND sales.createdAt >= date('now', '-30 days') AND sales.businessId = items.businessId
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE items.businessId = ?
      GROUP BY items.id
      ORDER BY totalQty ASC
      LIMIT ?
    `, [bizId, limit]);
    return results;
  } catch (error) {
    console.error('Get slow moving items error:', error);
    return [];
  }
};

export const getExpiringItems = (days: number = 30) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const expiryLimit = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    const results = database.getAllSync(`
      SELECT items.*, categories.name as categoryName
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE expiryDate IS NOT NULL AND expiryDate <= ? AND expiryDate >= date('now') AND items.businessId = ?
      ORDER BY expiryDate ASC
    `, [expiryLimit, bizId]);
    return results;
  } catch (error) {
    console.error('Get expiring items error:', error);
    return [];
  }
};

// --- Analytics & Metrics ---

export const getDashboardStats = (targetDate?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const today = targetDate || new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(new Date(today + 'T00:00:00').getTime() - 86400000);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    // Today's Stats
    const todaySales = database.getFirstSync<{ revenue: number, count: number }>(`
      SELECT SUM(totalPrice) as revenue, COUNT(*) as count FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order' AND totalPrice >= 0 AND businessId = ?
    `, [today, bizId]);

    const todayDebt = database.getFirstSync<{ total: number }>(`
      SELECT SUM(totalPrice) as total FROM sales WHERE date(createdAt) = ? AND paymentStatus = 'Debt' AND paymentStatus != 'Order' AND businessId = ?
    `, [today, bizId]);

    const todayReturns = database.getFirstSync<{ totalRefund: number }>(`
      SELECT COALESCE(SUM(totalRefund), 0) as totalRefund FROM returns WHERE date(createdAt) = ? AND businessId = ?
    `, [today, bizId]);

    // Yesterday's Stats for comparison
    const yesterdaySales = database.getFirstSync<{ revenue: number, count: number }>(`
      SELECT SUM(totalPrice) as revenue, COUNT(*) as count FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order' AND totalPrice >= 0 AND businessId = ?
    `, [yesterday, bizId]);

    const yesterdayProfitData = database.getFirstSync<{ gross: number }>(`
      SELECT SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))) as gross
      FROM sales s
      JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      WHERE date(s.createdAt) = ? AND paymentStatus != 'Order' AND s.totalPrice >= 0 AND s.businessId = ?
    `, [yesterday, bizId]);

    const yesterdayReturns = database.getFirstSync<{ totalRefund: number }>(`
      SELECT COALESCE(SUM(totalRefund), 0) as totalRefund FROM returns WHERE date(createdAt) = ? AND businessId = ?
    `, [yesterday, bizId]);

    // Profit Calculation (Today) - EXCLUDING debt (not realized until paid)
    const profitData = database.getFirstSync<{ gross: number }>(`
      SELECT SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))) as gross
      FROM sales s
      JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      WHERE date(s.createdAt) = ? AND s.paymentStatus != 'Debt' AND s.paymentStatus != 'Order' AND s.totalPrice >= 0 AND s.businessId = ?
    `, [today, bizId]);

    const todayNetSales = (todaySales?.revenue || 0) - (todayReturns?.totalRefund || 0);
    const yesterdayNetSales = (yesterdaySales?.revenue || 0) - (yesterdayReturns?.totalRefund || 0);

    return {
      today: {
        revenue: todayNetSales,
        salesCount: todaySales?.count || 0,
        debt: todayDebt?.total || 0,
        grossProfit: (profitData?.gross || 0) - (todayReturns?.totalRefund || 0),
        returns: todayReturns?.totalRefund || 0,
      },
      yesterday: {
        revenue: yesterdayNetSales,
        salesCount: yesterdaySales?.count || 0,
        grossProfit: (yesterdayProfitData?.gross || 0) - (yesterdayReturns?.totalRefund || 0),
        returns: yesterdayReturns?.totalRefund || 0,
      }
    };
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return null;
  }
};

export const getInventorySummary = (warehouseId?: number | null) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    
    // Build queries dynamically based on warehouseId
    let totalsQuery = `SELECT SUM(totalBaseQuantity * basePurchasePrice) as value, COUNT(*) as count FROM items WHERE businessId = ?`;
    let lowStockQuery = `SELECT COUNT(*) as count FROM items WHERE totalBaseQuantity < 10 AND businessId = ?`;
    let highValueQuery = `SELECT name, (totalBaseQuantity * basePurchasePrice) as value FROM items WHERE businessId = ?`;
    let categoriesQuery = `
      SELECT c.name, COUNT(i.id) as count, SUM(i.totalBaseQuantity * i.basePurchasePrice) as value
      FROM categories c
      JOIN items i ON i.categoryId = c.id AND i.businessId = c.businessId
      WHERE c.businessId = ?
    `;
    
    const params: any[] = [bizId];
    if (warehouseId) {
      totalsQuery += ` AND warehouseId = ?`;
      lowStockQuery += ` AND warehouseId = ?`;
      highValueQuery += ` AND warehouseId = ?`;
      categoriesQuery += ` AND i.warehouseId = ?`;
      params.push(warehouseId);
    }
    
    highValueQuery += ` ORDER BY value DESC LIMIT 1`;
    categoriesQuery += ` GROUP BY c.id`;

    // Total Inventory Value and Item Count
    const totals = database.getFirstSync<{ value: number, count: number }>(totalsQuery, params);

    // Low Stock Count
    const lowStock = database.getFirstSync<{ count: number }>(lowStockQuery, params);

    // Highest Value Item
    const highValue = database.getFirstSync<{ name: string, value: number }>(highValueQuery, params);

    // Category Distribution
    const categories = database.getAllSync<{ name: string, count: number, value: number }>(categoriesQuery, params);

    const totalCount = totals?.count || 0;
    const lowCount = lowStock?.count || 0;
    const health = totalCount > 0 ? Math.round(((totalCount - lowCount) / totalCount) * 100) : 100;

    return {
      totalValue: totals?.value || 0,
      totalItems: totalCount,
      lowStockCount: lowCount,
      stockHealth: health,
      highestValueItem: highValue,
      categories
    };
  } catch (error) {
    console.error('Get inventory summary error:', error);
    return null;
  }
};

export const getInventoryStats = (warehouseId?: number | null) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    
    let totalValueQuery = `SELECT SUM(totalBaseQuantity * basePurchasePrice) as value FROM items WHERE businessId = ?`;
    let lowStockQuery = `SELECT COUNT(*) as count FROM items WHERE totalBaseQuantity < 10 AND businessId = ?`;
    let categoriesQuery = `
      SELECT c.name, COUNT(i.id) as count 
      FROM categories c
      JOIN items i ON i.categoryId = c.id AND i.businessId = c.businessId
      WHERE c.businessId = ?
    `;
    
    const params: any[] = [bizId];
    if (warehouseId) {
      totalValueQuery += ` AND warehouseId = ?`;
      lowStockQuery += ` AND warehouseId = ?`;
      categoriesQuery += ` AND i.warehouseId = ?`;
      params.push(warehouseId);
    }
    
    categoriesQuery += ` GROUP BY c.id`;

    // Total Inventory Value
    const totalValue = database.getFirstSync<{ value: number }>(totalValueQuery, params);

    // Low Stock Count
    const lowStock = database.getFirstSync<{ count: number }>(lowStockQuery, params);

    // Category Distribution
    const categories = database.getAllSync<{ name: string, count: number }>(categoriesQuery, params);

    // Moving Items Count (Sold > 0 in last 30 days)
    let movingQuery = `
       SELECT 
          COUNT(DISTINCT CASE WHEN total_qty > 5 THEN itemId END) as fast,
          COUNT(DISTINCT CASE WHEN total_qty <= 5 THEN itemId END) as slow
       FROM (
         SELECT sales.itemId, SUM(sales.quantity) as total_qty 
         FROM sales 
    `;
    const movingParams: any[] = [];
    if (warehouseId) {
      movingQuery += ` JOIN items ON sales.itemId = items.id WHERE items.warehouseId = ? AND items.businessId = ? AND sales.createdAt >= date('now', '-30 days')`;
      movingParams.push(warehouseId, bizId);
    } else {
      movingQuery += ` WHERE sales.createdAt >= date('now', '-30 days') AND sales.businessId = ?`;
      movingParams.push(bizId);
    }
    movingQuery += ` GROUP BY sales.itemId )`;

    const movingData = database.getFirstSync<{ fast: number, slow: number }>(movingQuery, movingParams);

    return {
      totalValue: totalValue?.value || 0,
      lowStockCount: lowStock?.count || 0,
      categories,
      fastMoving: movingData?.fast || 0,
      slowMoving: movingData?.slow || 0,
    };
  } catch (error) {
    console.error('Get inventory stats error:', error);
    return null;
  }
};

export const getLowStockItems = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE totalBaseQuantity < COALESCE(reorderPoint, 10) AND items.businessId = ?
      ORDER BY totalBaseQuantity ASC
    `, [bizId]);
  } catch (error) {
    console.error('Get low stock items error:', error);
    return [];
  }
};

export const getReorderSuggestions = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName,
             COALESCE(reorderPoint, 10) as reorderPoint,
             MAX(COALESCE(reorderQty, 0), COALESCE(reorderPoint, 10) - totalBaseQuantity) as suggestedQty
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE totalBaseQuantity < COALESCE(reorderPoint, 10) AND items.businessId = ?
      ORDER BY (totalBaseQuantity - COALESCE(reorderPoint, 10)) ASC
    `, [bizId]);
  } catch (error) {
    console.error('Get reorder suggestions error:', error);
    return [];
  }
};

export const getDebtCustomers = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT 
        TRIM(customerName) as customerName, 
        customerPhone, 
        IFNULL(SUM(totalPrice - COALESCE(paidAmount, 0)), 0) as oweAmount,
        MAX(createdAt) as lastBorrowed,
        MIN(dueDate) as earliestDue,
        COUNT(*) as totalDebts
      FROM sales 
      WHERE paymentStatus = 'Debt' AND customerName IS NOT NULL AND TRIM(customerName) != '' AND businessId = ?
      GROUP BY TRIM(customerName), customerPhone
      ORDER BY oweAmount DESC
    `, [bizId]);
  } catch (error) {
    console.error('Get debt customers error:', error);
    return [];
  }
};

export const getDebtSales = (customerName?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    let query = `
      SELECT sales.*, items.name as itemName, items.baseUnit
      FROM sales
      LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId
      WHERE (paymentStatus IN ('Debt', 'Loss') OR (paymentStatus = 'Paid' AND COALESCE(paidAmount, 0) > 0)) AND sales.businessId = ?
    `;
    const params: any[] = [bizId];
    if (customerName && customerName.trim()) {
      query += ' AND LOWER(TRIM(customerName)) = LOWER(TRIM(?))';
      params.push(customerName.trim());
    }
    query += ' ORDER BY createdAt DESC';
    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get debt sales error:', error);
    return [];
  }
};

export const processDebtPayment = (
  customerName: string,
  amount: number,
  type: 'full' | 'partial',
  options?: { customerPhone?: string; saleId?: number; note?: string; paymentMethod?: string },
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const method = options?.paymentMethod || null;
    if (type === 'full') {
      if (method) {
        database.runSync(
          "UPDATE sales SET paymentStatus = 'Paid', paidAmount = totalPrice, paymentMethod = ? WHERE customerName = ? AND paymentStatus = 'Debt' AND businessId = ?",
          [method, customerName, bizId]
        );
      } else {
        database.runSync(
          "UPDATE sales SET paymentStatus = 'Paid', paidAmount = totalPrice WHERE customerName = ? AND paymentStatus = 'Debt' AND businessId = ?",
          [customerName, bizId]
        );
      }
    } else {
      // Partial payment logic: distribute across sales
      const sales = database.getAllSync<{id: number, totalPrice: number, paidAmount: number}>(
        "SELECT id, totalPrice, paidAmount FROM sales WHERE customerName = ? AND paymentStatus = 'Debt' AND businessId = ? ORDER BY createdAt ASC",
        [customerName, bizId]
      );

      let remaining = amount;
      for (const sale of sales) {
        if (remaining <= 0) break;
        const outstanding = sale.totalPrice - (sale.paidAmount || 0);
        const apply = Math.min(remaining, outstanding);
        const newPaid = (sale.paidAmount || 0) + apply;
        const newStatus = newPaid >= sale.totalPrice ? 'Paid' : 'Debt';

        database.runSync(
          "UPDATE sales SET paidAmount = ?, paymentStatus = ? WHERE id = ? AND businessId = ?",
          [newPaid, newStatus, sale.id, bizId]
        );
        remaining -= apply;
      }
    }
    // Record this payment in the history table
    try {
      database.runSync(
        'INSERT INTO debt_payments (saleId, customerName, customerPhone, amount, type, note, businessId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          options?.saleId ?? null,
          customerName,
          options?.customerPhone ?? null,
          amount,
          type,
          options?.note ?? null,
          bizId,
        ],
      );
    } catch (e) {
      console.error('Record debt payment history error:', e);
    }

    // Create a payment record in sales so it appears in activity feed
    try {
      const batchId = 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const firstDebt = database.getFirstSync<any>(
        "SELECT itemId, unit, unitType FROM sales WHERE customerName = ? AND paymentStatus = 'Paid' AND businessId = ? ORDER BY id DESC LIMIT 1",
        [customerName, bizId]
      );
      database.runSync(
        `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, businessId, createdAt)
         VALUES (?, 1, ?, ?, 0, 0, ?, ?, 'Paid', ?, ?, ?, ?, ?)`,
        [
          firstDebt?.itemId ?? 1,
          firstDebt?.unit || 'pcs',
          firstDebt?.unitType || 'base',
          -Math.abs(amount),
          method || 'Cash',
          customerName,
          options?.customerPhone ?? null,
          batchId,
          bizId,
          new Date().toISOString(),
        ]
      );
    } catch (e) {
      console.error('Create payment record error:', e);
    }
    return true;
  } catch (error) {
    console.error('Process debt payment error:', error);
    return false;
  }
};

export const markDebtAsLoss = (customerName: string, options?: { customerPhone?: string; note?: string }) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const sales = database.getAllSync<{ id: number; totalPrice: number; paidAmount: number }>(
      "SELECT id, totalPrice, paidAmount FROM sales WHERE customerName = ? AND paymentStatus = 'Debt' AND businessId = ?",
      [customerName, bizId],
    );
    const outstanding = sales.reduce(
      (sum, s) => sum + Math.max(0, (s.totalPrice || 0) - (s.paidAmount || 0)),
      0,
    );
    database.runSync(
      "UPDATE sales SET paymentStatus = 'Loss' WHERE customerName = ? AND paymentStatus = 'Debt' AND businessId = ?",
      [customerName, bizId]
    );
    // Record write-off as a history entry (negative direction, type='loss')
    try {
      if (outstanding > 0) {
        database.runSync(
          'INSERT INTO debt_payments (customerName, customerPhone, amount, type, note, businessId) VALUES (?, ?, ?, ?, ?, ?)',
          [
            customerName,
            options?.customerPhone ?? null,
            outstanding,
            'loss',
            options?.note ?? null,
            bizId,
          ],
        );
      }
    } catch (e) {
      console.error('Record debt loss history error:', e);
    }
    return true;
  } catch (error) {
    console.error('Mark debt as loss error:', error);
    return false;
  }
};

// Aggregate summary used by the Debt Management screen header.
export const getDebtSummary = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return { totalOwed: 0, debtorCount: 0, overdueCount: 0, overdueAmount: 0 };
    const rows = database.getFirstSync<{
      totalOwed: number | null;
      debtorCount: number | null;
      overdueCount: number | null;
      overdueAmount: number | null;
    }>(`
      SELECT
        COALESCE(SUM(totalPrice - COALESCE(paidAmount, 0)), 0) as totalOwed,
        COUNT(DISTINCT customerName) as debtorCount,
        SUM(CASE WHEN dueDate IS NOT NULL AND dueDate < date('now') THEN 1 ELSE 0 END) as overdueCount,
        COALESCE(SUM(CASE WHEN dueDate IS NOT NULL AND dueDate < date('now') THEN (totalPrice - COALESCE(paidAmount, 0)) ELSE 0 END), 0) as overdueAmount
      FROM sales
      WHERE paymentStatus = 'Debt' AND businessId = ?
    `, [bizId]);
    return {
      totalOwed: Number(rows?.totalOwed || 0),
      debtorCount: Number(rows?.debtorCount || 0),
      overdueCount: Number(rows?.overdueCount || 0),
      overdueAmount: Number(rows?.overdueAmount || 0),
    };
  } catch (error) {
    console.error('Get debt summary error:', error);
    return { totalOwed: 0, debtorCount: 0, overdueCount: 0, overdueAmount: 0 };
  }
};

// Returns the payment history for a customer, most recent first.
// `type` values: 'full', 'partial', 'loss'.
export const getCustomerPaymentHistory = (customerName: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(
      `SELECT id, saleId, customerName, customerPhone, amount, type, note, createdAt
       FROM debt_payments
       WHERE customerName = ? AND businessId = ?
       ORDER BY datetime(createdAt) DESC
       LIMIT 100`,
      [customerName, bizId],
    );
  } catch (error) {
    console.error('Get customer payment history error:', error);
    return [];
  }
};

// Sums the lifetime total paid (excluding write-offs) for a customer.
export const getCustomerTotalPaid = (customerName: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return 0;
    const row = database.getFirstSync<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM debt_payments
       WHERE customerName = ? AND type IN ('full', 'partial') AND businessId = ?`,
      [customerName, bizId],
    );
    return Number(row?.total || 0);
  } catch (error) {
    console.error('Get customer total paid error:', error);
    return 0;
  }
};

export const settleItemCredit = (itemId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    database.runSync("UPDATE items SET isCredit = 0 WHERE id = ? AND businessId = ?", [itemId, bizId]);
    return true;
  } catch (error) {
    console.error('Settle item credit error:', error);
    return false;
  }
};

export const getOnCreditItems = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const rows = database.getAllSync<any>(`
      SELECT
        items.*,
        categories.name as categoryName,
        COALESCE(SUM(CASE WHEN sm.paymentStatus IN ('Unpaid', 'Partial') THEN sm.quantityAdded ELSE 0 END), 0) as creditQuantity,
        COALESCE(SUM(CASE WHEN sm.paymentStatus IN ('Unpaid', 'Partial') THEN sm.quantityAdded * COALESCE(sm.unitPrice, 0) - COALESCE(sm.paidAmount, 0) ELSE 0 END), 0) as creditAmount
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      LEFT JOIN stock_movements sm ON sm.itemId = items.id
      WHERE isCredit = 1 AND items.businessId = ?
      GROUP BY items.id
      ORDER BY items.createdAt DESC
    `, [bizId]);
    return rows.map((r: any) => {
      let creditQuantity = Number(r.creditQuantity || 0);
      let creditAmount = Number(r.creditAmount || 0);
      // Fallback for items flagged on-credit that predate movement-level
      // payment tracking: derive the snapshot from the stored purchase fields
      // so the held quantity/amount stay fixed regardless of live stock.
      if (creditQuantity <= 0) creditQuantity = Number(r.totalBaseQuantity || 0);
      if (creditAmount <= 0) {
        creditAmount = Number(r.packPurchasePrice || 0) * creditQuantity
          || Number(r.basePurchasePrice || 0) * creditQuantity;
      }
      return { ...r, creditQuantity, creditAmount };
    });
  } catch (error) {
    console.error('Get on credit items error:', error);
    return [];
  }
};

export const getSalesChartData = (period: 'W' | 'M' | 'Y', offset: number = 0, calendarType?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const now = new Date();
    let results: { label: string, value: number }[] = [];

    if (period === 'W') {
      const dayOffset = offset * 7;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + dayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      results = database.getAllSync<{ label: string, value: number }>(`
        SELECT 
          strftime('%w', createdAt) as label,
          SUM(totalPrice) as value
        FROM sales 
        WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND paymentStatus != 'Order' AND businessId = ?
        GROUP BY label
        ORDER BY label
      `, [startStr, endStr, bizId]);

      const returnRefunds = database.getAllSync<{ label: string, value: number }>(`
        SELECT 
          strftime('%w', createdAt) as label,
          SUM(totalRefund) as value
        FROM returns 
        WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND businessId = ?
        GROUP BY label
        ORDER BY label
      `, [startStr, endStr, bizId]);

      // Fill in missing days with 0, subtracting returns
      const fullWeek: { label: string, value: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const dayLabel = String(i);
        const saleVal = results.find(r => r.label === dayLabel)?.value || 0;
        const returnVal = returnRefunds.find(r => r.label === dayLabel)?.value || 0;
        fullWeek.push({ label: dayLabel, value: Math.max(0, saleVal - returnVal) });
      }
      return fullWeek;
    } else if (period === 'M') {
      if (calendarType === 'ethiopian') {
        const current = toEthiopianDate(now);
        let ethYear = current.year;
        let ethMonth = current.month + offset;
        if (ethMonth < 1) { ethMonth += 13; ethYear--; }
        if (ethMonth > 13) { ethMonth -= 13; ethYear++; }

        const daysInMonth = ethMonth === 13 ? getEthiopianDaysInMonth(ethYear, ethMonth) : 30;
        const startDate = fromEthiopianToDate(ethYear, ethMonth, 1);
        const endDate = fromEthiopianToDate(ethYear, ethMonth, daysInMonth);
        endDate.setDate(endDate.getDate() + 1);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const allSales = database.getAllSync<{ createdAt: string, totalPrice: number }>(`
          SELECT createdAt, totalPrice FROM sales
          WHERE date(createdAt) >= ? AND date(createdAt) < ? AND paymentStatus != 'Order' AND businessId = ?
        `, [startStr, endStr, bizId]);

        const allReturns = database.getAllSync<{ createdAt: string, totalRefund: number }>(`
          SELECT createdAt, totalRefund FROM returns
          WHERE date(createdAt) >= ? AND date(createdAt) < ? AND businessId = ?
        `, [startStr, endStr, bizId]);

        const weekMap: Record<number, number> = {};
        allSales.forEach(sale => {
          const d = new Date(sale.createdAt);
          if (!isNaN(d.getTime())) {
            const ethDate = toEthiopianDate(d);
            let weekNum = Math.floor((ethDate.day - 1) / 7) + 1;
            if (ethMonth === 13) weekNum = 1;
            else if (weekNum > 5) weekNum = 5;
            weekMap[weekNum] = (weekMap[weekNum] || 0) + sale.totalPrice;
          }
        });
        allReturns.forEach(ret => {
          const d = new Date(ret.createdAt);
          if (!isNaN(d.getTime())) {
            const ethDate = toEthiopianDate(d);
            let weekNum = Math.floor((ethDate.day - 1) / 7) + 1;
            if (ethMonth === 13) weekNum = 1;
            else if (weekNum > 5) weekNum = 5;
            weekMap[weekNum] = (weekMap[weekNum] || 0) - ret.totalRefund;
          }
        });

        const numWeeks = ethMonth === 13 ? 1 : 5;
        const fullMonth: { label: string, value: number }[] = [];
        for (let i = 1; i <= numWeeks; i++) {
          fullMonth.push({ label: String(i), value: Math.max(0, weekMap[i] || 0) });
        }
        return fullMonth;
      }

      const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = monthDate.getFullYear();
      const m = String(monthDate.getMonth() + 1).padStart(2, '0');

      results = database.getAllSync<{ label: string, value: number }>(`
        SELECT ((CAST(strftime('%d', createdAt) AS INTEGER) - 1) / 7 + 1) as label, SUM(totalPrice) as value
        FROM sales
        WHERE strftime('%Y-%m', createdAt) = ? AND paymentStatus != 'Order' AND businessId = ?
        GROUP BY label
        ORDER BY label
      `, [`${y}-${m}`, bizId]);

      const returnRefunds = database.getAllSync<{ label: string, value: number }>(`
        SELECT ((CAST(strftime('%d', createdAt) AS INTEGER) - 1) / 7 + 1) as label, SUM(totalRefund) as value
        FROM returns
        WHERE strftime('%Y-%m', createdAt) = ? AND businessId = ?
        GROUP BY label
        ORDER BY label
      `, [`${y}-${m}`, bizId]);

      const fullMonth: { label: string, value: number }[] = [];
      const lastDay = new Date(y, monthDate.getMonth() + 1, 0).getDate();
      const numWeeks = Math.ceil(lastDay / 7);
      for (let i = 1; i <= numWeeks; i++) {
        const saleVal = results.find(r => Number(r.label) === i)?.value || 0;
        const returnVal = returnRefunds.find(r => Number(r.label) === i)?.value || 0;
        fullMonth.push({ label: String(i), value: Math.max(0, saleVal - returnVal) });
      }
      return fullMonth;
    } else {
      const yr = now.getFullYear() + offset;
      const isEthiopian = calendarType === 'ethiopian';

      if (isEthiopian) {
        const allSales = database.getAllSync<{ createdAt: string, totalPrice: number }>(`
          SELECT createdAt, totalPrice FROM sales
          WHERE strftime('%Y', createdAt) = ? AND paymentStatus != 'Order' AND businessId = ?
        `, [String(yr), bizId]);

        const allReturns = database.getAllSync<{ createdAt: string, totalRefund: number }>(`
          SELECT createdAt, totalRefund FROM returns
          WHERE strftime('%Y', createdAt) = ? AND businessId = ?
        `, [String(yr), bizId]);

        const ethMonthMap: Record<number, number> = {};
        allSales.forEach(sale => {
          const d = new Date(sale.createdAt);
          if (!isNaN(d.getTime())) {
            const a = Math.floor((14 - (d.getMonth() + 1)) / 12);
            const y = d.getFullYear() + 4800 - a;
            const m = (d.getMonth() + 1) + 12 * a - 3;
            const jdn = d.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            const r = (jdn - 1723856) % 1461;
            const n = (r % 365) + 365 * Math.floor(r / 1460);
            const ethMonth = Math.floor(n / 30) + 1;
            ethMonthMap[ethMonth] = (ethMonthMap[ethMonth] || 0) + sale.totalPrice;
          }
        });
        allReturns.forEach(ret => {
          const d = new Date(ret.createdAt);
          if (!isNaN(d.getTime())) {
            const a = Math.floor((14 - (d.getMonth() + 1)) / 12);
            const y = d.getFullYear() + 4800 - a;
            const m = (d.getMonth() + 1) + 12 * a - 3;
            const jdn = d.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            const r = (jdn - 1723856) % 1461;
            const n = (r % 365) + 365 * Math.floor(r / 1460);
            const ethMonth = Math.floor(n / 30) + 1;
            ethMonthMap[ethMonth] = (ethMonthMap[ethMonth] || 0) - ret.totalRefund;
          }
        });

        const fullYear: { label: string, value: number }[] = [];
        for (let i = 1; i <= 13; i++) {
          fullYear.push({ label: String(i), value: Math.max(0, ethMonthMap[i] || 0) });
        }
        return fullYear;
      }

      results = database.getAllSync<{ label: string, value: number }>(`
        SELECT CAST(strftime('%m', createdAt) AS INTEGER) as label, SUM(totalPrice) as value
        FROM sales
        WHERE strftime('%Y', createdAt) = ? AND paymentStatus != 'Order' AND businessId = ?
        GROUP BY label
        ORDER BY label
      `, [String(yr), bizId]);

      const returnRefunds = database.getAllSync<{ label: string, value: number }>(`
        SELECT CAST(strftime('%m', createdAt) AS INTEGER) as label, SUM(totalRefund) as value
        FROM returns
        WHERE strftime('%Y', createdAt) = ? AND businessId = ?
        GROUP BY label
        ORDER BY label
      `, [String(yr), bizId]);

      // Fill in missing months with 0
      const fullYear: { label: string, value: number }[] = [];
      for (let i = 1; i <= 12; i++) {
        const monthLabel = String(i);
        const saleVal = results.find(r => Number(r.label) === i)?.value || 0;
        const returnVal = returnRefunds.find(r => Number(r.label) === i)?.value || 0;
        fullYear.push({ label: monthLabel, value: Math.max(0, saleVal - returnVal) });
      }
      return fullYear;
    }
  } catch (error) {
    console.error('Get sales chart data error:', error);
    return [];
  }
};

const CHART_LABELS: Record<string, string[]> = {
  en_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  am_days: ['áŠ¥áˆ‘á‹µ', 'áˆ°áŠž', 'áˆ›áŠ­áˆ°áŠž', 'áˆ¨á‰¡á‹•', 'áˆáˆ™áˆµ', 'á‹“áˆ­á‰¥', 'á‰…á‹³áˆœ'],
  om_days: ['Dil', 'Wii', 'Qib', 'Roob', 'Kam', 'Jum', 'San'],
  ti_days: ['áˆ°áŠ•á‰ á‰µ', 'áˆ°áŠ‘áŠ•', 'áˆ áˆ‰áˆµ', 'áˆ¨á‰¡á‹•', 'áˆáˆ™áˆµ', 'á‹“áˆ­á‰¢', 'á‰€á‹³áˆ'],
  en_months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  am_months: ['áŒƒáŠ•á‹©', 'áŒá‰¥áˆ©', 'áˆ›áˆ­á‰½', 'áŠ¤á•áˆªáˆ', 'áˆœá‹­', 'áŒáŠ•', 'áŒáˆ‹á‹­', 'áŠ¦áŒˆáˆµ', 'áˆ´á•á‰´áˆá‰ áˆ­', 'áŠ¦áŠ­á‰¶á‰ áˆ­', 'áŠ–á‰¬áˆá‰ áˆ­', 'á‹²áˆ´áˆá‰ áˆ­'],
  om_months: ['Ama', 'Gur', 'Bit', 'Ebl', 'Caa', 'Wax', 'Ado', 'Hag', 'Ful', 'Onk', 'Sad', 'Mud'],
  ti_months: ['áŒƒáŠ•á‹©', 'áŒá‰¥áˆ©', 'áˆ›áˆ­á‰½', 'áŠ¤á•áˆªáˆ', 'áˆœá‹­', 'áŒáŠ•', 'áŒáˆ‹á‹­', 'áŠ¦áŒˆáˆµ', 'áˆ´á•á‰´áˆá‰ áˆ­', 'áŠ¦áŠ­á‰¶á‰ áˆ­', 'áŠ–á‰¬áˆá‰ áˆ­', 'á‹²áˆ´áˆá‰ áˆ­'],
  en_hours: ['3 AM', '6 AM', '9 AM', '12 PM', '3 PM'],
  am_hours: ['3:00 áŒ½', '6:00 áŒ½', '9:00 áŒ½', '12:00 áˆ¨á‹á‹µ', '3:00 áˆ¨á‹á‹µ'],
  om_hours: ['3 AA', '6 AA', '9 AA', '12 WB', '3 WB'],
  ti_hours: ['3:00 áŒ½', '6:00 áŒ½', '9:00 áŒ½', '12:00 áˆ¨á‹á‹µ', '3:00 áˆ¨á‹á‹µ'],
};

export const deleteItem = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const item = database.getFirstSync('SELECT name FROM items WHERE id = ? AND businessId = ?', [id, bizId]) as { name?: string } | null;
    database.runSync('DELETE FROM items WHERE id = ? AND businessId = ?', [id, bizId]);
    auditLog('item', Number(id), 'item.delete', item?.name ?? null, null, `Deleted "${item?.name ?? 'item'}" from inventory`);
    return true;
  } catch (error) {
    console.error('Delete item error:', error);
    return false;
  }
};

export const deleteSale = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const sale = database.getFirstSync<{ itemId: number, quantity: number, unitType: string }>('SELECT * FROM sales WHERE id = ? AND businessId = ?', [id, bizId]);
    
    if (sale) {
      const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ? AND businessId = ?', [sale.itemId, bizId]);
      
      let baseRefund = sale.quantity;
      let packRefund = 0;
      
      if (sale.unitType === 'pack' && item?.unitsPerPack) {
        baseRefund = sale.quantity * item.unitsPerPack;
        packRefund = sale.quantity;
      } else if (item?.unitsPerPack) {
        packRefund = sale.quantity / item.unitsPerPack;
      }

      database.runSync(
        'UPDATE items SET totalBaseQuantity = totalBaseQuantity + ?, totalPackQuantity = totalPackQuantity + ? WHERE id = ? AND businessId = ?',
        [baseRefund, packRefund, sale.itemId, bizId]
      );
    }

    database.runSync('DELETE FROM sales WHERE id = ? AND businessId = ?', [id, bizId]);
    auditLog('sale', id, 'sale.delete', JSON.stringify(sale), null, `Sale #${id} deleted/voided`);
    return true;
  } catch (error) {
    console.error('Delete sale error:', error);
    return false;
  }
};

export const deleteSalesByBatchId = (batchId: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const batchSales = database.getAllSync<{ id: number, itemId: number, quantity: number, unitType: string }>(
      'SELECT * FROM sales WHERE batchId = ? AND businessId = ?', [batchId, bizId]
    );
    for (const sale of batchSales) {
      const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ? AND businessId = ?', [sale.itemId, bizId]);
      let baseRefund = sale.quantity;
      let packRefund = 0;
      if (sale.unitType === 'pack' && item?.unitsPerPack) {
        baseRefund = sale.quantity * item.unitsPerPack;
        packRefund = sale.quantity;
      } else if (item?.unitsPerPack) {
        packRefund = sale.quantity / item.unitsPerPack;
      }
      database.runSync(
        'UPDATE items SET totalBaseQuantity = totalBaseQuantity + ?, totalPackQuantity = totalPackQuantity + ? WHERE id = ? AND businessId = ?',
        [baseRefund, packRefund, sale.itemId, bizId]
      );
    }
    database.runSync('DELETE FROM sales WHERE batchId = ? AND businessId = ?', [batchId, bizId]);
    return true;
  } catch (error) {
    console.error('Delete sales by batchId error:', error);
    return false;
  }
};

export const getInventoryComparisonStats = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const d = new Date();
    const currentMonthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const previousMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const lastMonthPrefix = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;
    
    const currentStats = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM items WHERE createdAt LIKE ? AND businessId = ?
    `, [`${currentMonthPrefix}%`, bizId]);
    
    const previousStats = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM items WHERE createdAt LIKE ? AND businessId = ?
    `, [`${lastMonthPrefix}%`, bizId]);
    
    const currentTotal = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE businessId = ?', [bizId]);

    return {
      totalItems: currentTotal?.count || 0,
      thisMonthAdded: currentStats?.count || 0,
      lastMonthAdded: previousStats?.count || 0,
      diff: (currentStats?.count || 0) - (previousStats?.count || 0)
    };
  } catch (error) {
    console.error('getInventoryComparisonStats error:', error);
    return null;
  }
};

export const getCapitalSummary = (period: string = 'this_month', targetDate?: string) => {
  try {
    return {
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('getCapitalSummary error:', error);
    return null;
  }
};

export const updateItem = (id: number, updates: any) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const validColumns = [
      'name', 'categoryId', 'companyName', 'purchaseUnit', 'baseUnit',
      'unitsPerPack', 'totalPackQuantity', 'totalBaseQuantity',
      'packPurchasePrice', 'basePurchasePrice', 'baseSellingPrice',
      'packSellingPrice', 'allowSellByBaseUnit', 'allowSellByPackUnit',
      'expiryDate', 'qualityGrade', 'notes', 'isCredit',
      'supplierPhone', 'supplierAccount', 'supplierCallEnabled', 'lastPriceCheckAt', 'createdAt',
      'reorderPoint', 'reorderQty', 'autoReorder', 'sku', 'barcode', 'isActive',
      'image', 'taxType', 'wholesaleSellingPrice', 'minWholesaleQty',
      'transportCost', 'importCost', 'packagingCost', 'handlingCost', 'otherCost',
      'targetMargin', 'taxTreatment'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => validColumns.includes(key) && updates[key] !== undefined)
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) return true;

    // If stock is being increased, log the movement so the activity feed
    // shows the actual added quantity (not the live, shrinking stock level).
    // When a supplier is attached the movement doubles as a purchase record.
    if (filteredUpdates.totalBaseQuantity !== undefined) {
      const current = database.getFirstSync<{ totalBaseQuantity: number, baseUnit: string }>(
        'SELECT totalBaseQuantity, baseUnit FROM items WHERE id = ? AND businessId = ?', [id, bizId]
      );
      if (current) {
        const added = filteredUpdates.totalBaseQuantity - (current.totalBaseQuantity || 0);
        if (added > 0) {
          logStockMovement(
            id,
            added,
            current.baseUnit || 'pcs',
            'Restock',
            (updates as any).supplierId || null,
            (updates as any).purchaseUnitPrice || 0,
            (updates as any).purchasePaymentStatus,
            (updates as any).purchasePaidAmount
          );
        }
      }
    }

    // Keep the item->supplier link table in sync when a supplier is attached.
    if ((updates as any).supplierId) {
      database.runSync(
        'INSERT OR IGNORE INTO item_suppliers (itemId, supplierId) VALUES (?, ?)',
        id, (updates as any).supplierId
      );
    }

    // Log price changes to price history before they are overwritten.
    logItemPriceChanges(id, filteredUpdates);

    const setQuery = Object.keys(filteredUpdates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredUpdates);
    
    const itemsSql = `UPDATE items SET ${setQuery} WHERE id = ? AND businessId = ?`;
    const itemsParams = [...values, id, bizId] as any[];
    database.runSync(itemsSql, ...itemsParams);
    const auditFields = Object.keys(filteredUpdates).filter(k => ['name', 'baseSellingPrice', 'packSellingPrice', 'basePurchasePrice', 'totalBaseQuantity', 'totalPackQuantity'].includes(k));
    if (auditFields.length) {
      auditLog('item', id, 'item.update', null, JSON.stringify(auditFields.reduce((o: any, k) => { o[k] = filteredUpdates[k]; return o; }, {})), `Item #${id} updated (${auditFields.join(', ')})`);
    }
    return true;
  } catch (error) {
    console.error('Update item error:', error);
    return false;
  }
};

export const updateSale = (id: number, updates: any) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const validColumns = [
      'itemId', 'quantity', 'unit', 'unitType', 'discount', 'vat', 'taxType',
      'totalPrice', 'paymentMethod', 'paymentStatus', 
      'customerName', 'customerPhone', 'packId', 'createdAt',
      'batchId', 'orderNumber', 'notes', 'convertedAt', 'cancelledAt', 'dueDate'
    ];
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => validColumns.includes(key) && updates[key] !== undefined)
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) return true;

    const setQuery = Object.keys(filteredUpdates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredUpdates);
    
    const salesSql = `UPDATE sales SET ${setQuery} WHERE id = ? AND businessId = ?`;
    const salesParams = [...values, id, bizId] as any[];
    database.runSync(salesSql, ...salesParams);
    auditLog('sale', id, 'sale.update', null, JSON.stringify(filteredUpdates), `Sale #${id} updated`);
    return true;
  } catch (error) {
    console.error('Update sale error:', error);
    return false;
  }
};

export const updateSaleItem = (id: number, updates: any) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const old = database.getFirstSync<{ itemId: number, quantity: number, unitType: string }>('SELECT * FROM sales WHERE id = ? AND businessId = ?', [id, bizId]);
    if (!old) return false;

    const validColumns = [
      'itemId', 'quantity', 'unit', 'unitType', 'discount', 'vat', 'taxType',
      'totalPrice', 'paymentMethod', 'paymentStatus', 
      'customerName', 'customerPhone', 'packId', 'createdAt',
      'batchId', 'orderNumber', 'notes', 'convertedAt', 'cancelledAt', 'dueDate'
    ];

    const filteredUpdates = Object.keys(updates)
      .filter(key => validColumns.includes(key) && updates[key] !== undefined)
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) return true;

    // Adjust stock when quantity changes
    const newQty = filteredUpdates.quantity !== undefined ? filteredUpdates.quantity : old.quantity;
    if (newQty !== old.quantity) {
      const diff = old.quantity - newQty; // positive = refund (return to stock), negative = more sold
      const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ? AND businessId = ?', [old.itemId, bizId]);
      let baseQty = diff;
      let packQty = 0;
      if (old.unitType === 'pack' && item?.unitsPerPack) {
        baseQty = diff * item.unitsPerPack;
        packQty = diff;
      } else if (item?.unitsPerPack) {
        packQty = diff / item.unitsPerPack;
      }
      database.runSync(
        'UPDATE items SET totalBaseQuantity = totalBaseQuantity + ?, totalPackQuantity = totalPackQuantity + ? WHERE id = ? AND businessId = ?',
        [baseQty, packQty, old.itemId, bizId]
      );
    }

    const setQuery = Object.keys(filteredUpdates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredUpdates);
    const sql = `UPDATE sales SET ${setQuery} WHERE id = ? AND businessId = ?`;
    database.runSync(sql, ...([...values, id, bizId] as any[]));
    return true;
  } catch (error) {
    console.error('Update sale item error:', error);
    return false;
  }
};

export const clearDatabase = () => {
  try {
    const database = getDB();
    database.execSync('PRAGMA foreign_keys = OFF;');
    database.execSync('DELETE FROM scheduled_reminders;');
    database.execSync('DELETE FROM notifications;');
    database.execSync('DELETE FROM notification_preferences;');
    database.execSync('DELETE FROM returns;');
    database.execSync('DELETE FROM debt_payments;');
    database.execSync('DELETE FROM adjustments;');
    database.execSync('DELETE FROM sales;');
    database.execSync('DELETE FROM item_packs;');
    database.execSync('DELETE FROM stock_movements;');
    database.execSync('DELETE FROM items;');
    database.execSync('DELETE FROM categories;');
    database.execSync('DELETE FROM contacts;');
    database.execSync('DELETE FROM warehouses;');
    database.execSync("DELETE FROM sqlite_sequence;");
    database.execSync('PRAGMA foreign_keys = ON;');
    console.log('Database cleared successfully.');
    return true;
  } catch (error) {
    console.error('Clear database error:', error);
    return false;
  }
};

export const getAdjustmentSummary = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const d = new Date();
    const currentMonthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const totalRecords = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM adjustments WHERE createdAt LIKE ? AND businessId = ?',
      [`${currentMonthPrefix}%`, bizId]
    );

    const priceDecreaseLeakage = database.getFirstSync<{ total: number }>(`
      SELECT SUM((oldValue - newValue) * i.totalBaseQuantity) as total 
      FROM adjustments a
      JOIN items i ON a.itemId = i.id AND i.businessId = a.businessId
      WHERE a.type = 'price_down' AND a.createdAt LIKE ? AND a.businessId = ?
    `, [`${currentMonthPrefix}%`, bizId]);

    const damagedLeakage = database.getFirstSync<{ total: number }>(`
      SELECT SUM(a.quantity * i.basePurchasePrice) as total 
      FROM adjustments a
      JOIN items i ON a.itemId = i.id AND i.businessId = a.businessId
      WHERE a.type = 'damaged' AND a.createdAt LIKE ? AND a.businessId = ?
    `, [`${currentMonthPrefix}%`, bizId]);

    const topAdjusted = database.getFirstSync<{ name: string, count: number }>(`
      SELECT i.name, COUNT(a.id) as count 
      FROM adjustments a
      JOIN items i ON a.itemId = i.id AND i.businessId = a.businessId
      WHERE a.createdAt LIKE ? AND a.businessId = ?
      GROUP BY a.itemId 
      ORDER BY count DESC 
      LIMIT 1
    `, [`${currentMonthPrefix}%`, bizId]);

    const types = database.getAllSync<{ type: string, count: number }>(`
      SELECT type, COUNT(*) as count 
      FROM adjustments 
      WHERE createdAt LIKE ? AND businessId = ?
      GROUP BY type
    `, [`${currentMonthPrefix}%`, bizId]);

    return {
      totalRecords: totalRecords?.count || 0,
      capitalLeakage: (priceDecreaseLeakage?.total || 0) + (damagedLeakage?.total || 0),
      topItem: topAdjusted || { name: 'None', count: 0 },
      typeDistribution: types,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('getAdjustmentSummary error:', error);
    return null;
  }
};

export const getSummaryAnalytics = (targetDate?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const today = targetDate || new Date().toISOString().split('T')[0];
    
    const topItem = database.getFirstSync<{ name: string, quantity: number }>(`
      SELECT i.name, SUM(s.quantity) as quantity
      FROM sales s
      JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      WHERE date(s.createdAt) = ? AND s.businessId = ?
      GROUP BY s.itemId
      ORDER BY quantity DESC
      LIMIT 1
    `, [today, bizId]);

    const stats = getDashboardStats(targetDate);
    let healthScore = 100;
    if (stats) {
      const revenue = stats.today.revenue;
      const profit = stats.today.grossProfit;
      
      if (revenue > 0) {
        const profitMargin = (profit / revenue) * 100;
        healthScore = Math.min(Math.max(profitMargin * 2, 0), 100);
      } else if (profit < 0) {
        healthScore = 0;
      }
    }
    
    return {
      topItem: topItem || { name: 'None', quantity: 0 },
      healthScore: Math.round(healthScore),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('getSummaryAnalytics error:', error);
    return null;
  }
};

export const getTopHighestValueItems = (limit: number = 10) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const results = database.getAllSync(`
      SELECT items.*, categories.name as categoryName,
             (items.totalBaseQuantity * items.baseSellingPrice) as totalValue
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE items.businessId = ?
      ORDER BY totalValue DESC
      LIMIT ?
    `, [bizId, limit]);
    return results;
  } catch (error) {
    console.error('Get top highest value items error:', error);
    return [];
  }
};

export const getInventoryItemsByPeriod = (period: 'today' | 'yesterday' | 'date' | 'week' | 'month' | 'year', targetDate?: string, offset?: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const now = new Date();
    let params: any[] = [];
    let query = '';

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      query = `
        SELECT items.*, categories.name as categoryName,
               strftime('%H:%M', items.createdAt) as timeStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
        WHERE date(items.createdAt) = ?
        ORDER BY items.createdAt DESC
      `;
      params = [todayStr, bizId];
    } else if (period === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      query = `
        SELECT items.*, categories.name as categoryName,
               strftime('%H:%M', items.createdAt) as timeStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
        WHERE date(items.createdAt) = ?
        ORDER BY items.createdAt DESC
      `;
      params = [yesterdayStr, bizId];
    } else if (period === 'date') {
      const dateStr = targetDate || now.toISOString().split('T')[0];
      query = `
        SELECT items.*, categories.name as categoryName,
               strftime('%H:%M', items.createdAt) as timeStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
        WHERE date(items.createdAt) = ?
        ORDER BY items.createdAt DESC
      `;
      params = [dateStr, bizId];
    } else if (period === 'week') {
      const safeOffset = offset || 0;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (safeOffset * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      query = `
        SELECT items.*, categories.name as categoryName,
               strftime('%w', items.createdAt) as dayOfWeek,
               strftime('%Y-%m-%d', items.createdAt) as dateStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
        WHERE date(items.createdAt) >= ? AND date(items.createdAt) <= ?
        ORDER BY items.createdAt DESC
      `;
      params = [startStr, endStr, bizId];
    } else if (period === 'month') {
      const monthOffset = offset || 0;
      const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const yearStr = monthDate.getFullYear().toString();
      const monthStr = String(monthDate.getMonth() + 1).padStart(2, '0');

      query = `
        SELECT items.*, categories.name as categoryName,
               ((CAST(strftime('%d', items.createdAt) AS INTEGER) - 1) / 7 + 1) as weekNum,
               strftime('%Y-%m-%d', items.createdAt) as dateStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
        WHERE strftime('%m', items.createdAt) = ? AND strftime('%Y', items.createdAt) = ? AND items.businessId = ?
        ORDER BY items.createdAt
      `;
      params = [monthStr, yearStr, bizId];
    } else if (period === 'year') {
      const yearOffset = offset || 0;
      const yearDate = new Date(now.getFullYear() + yearOffset, 0, 1);
      const yearStr = yearDate.getFullYear().toString();

      query = `
        SELECT items.*, categories.name as categoryName,
               CAST(strftime('%m', items.createdAt) AS INTEGER) as monthNum,
               strftime('%Y-%m-%d', items.createdAt) as dateStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
        WHERE strftime('%Y', items.createdAt) = ? AND items.businessId = ?
        ORDER BY items.createdAt
      `;
      params = [yearStr, bizId];
    }

    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get inventory items by period error:', error);
    return [];
  }
};

export const getMovingItemsWithFilters = (
  type: 'fast' | 'slow',
  filter: 'qty_desc' | 'qty_asc' | 'category' | 'today' | 'week' | 'month' | 'year'
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const now = new Date();
    let dateCondition = '';

    if (filter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      dateCondition = ` AND date(sales.createdAt) = '${todayStr}'`;
    } else if (filter === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      dateCondition = ` AND date(sales.createdAt) >= '${weekStart.toISOString().split('T')[0]}' AND date(sales.createdAt) <= '${weekEnd.toISOString().split('T')[0]}'`;
    } else if (filter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateCondition = ` AND date(sales.createdAt) >= '${monthStart.toISOString().split('T')[0]}' AND date(sales.createdAt) <= '${monthEnd.toISOString().split('T')[0]}'`;
    } else if (filter === 'year') {
      const yearStr = now.getFullYear().toString();
      dateCondition = ` AND strftime('%Y', sales.createdAt) = '${yearStr}'`;
    }

    if (filter === 'category') {
      const results = database.getAllSync(`
        SELECT categories.name as categoryName,
               COALESCE(SUM(sales.quantity), 0) as totalQty,
               COUNT(sales.id) as totalSales
        FROM sales
        JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId
        LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
        WHERE 1=1 AND paymentStatus != 'Order' ${dateCondition} AND sales.businessId = '${bizId}'
        GROUP BY categories.name
        ORDER BY totalQty DESC
      `);
      return results;
    }

    let orderClause = 'ORDER BY totalQty DESC';
    if (filter === 'qty_asc' || (type === 'slow' && filter !== 'qty_desc')) {
      orderClause = 'ORDER BY totalQty ASC';
    }

    const minQty = type === 'fast' ? 5 : 0;
    const maxQty = type === 'slow' ? 5 : 999999;

    const results = database.getAllSync(`
      SELECT items.*, categories.name as categoryName,
             COALESCE(SUM(sales.quantity), 0) as totalQty,
             COUNT(sales.id) as totalSales
      FROM items
      LEFT JOIN sales ON items.id = sales.itemId AND sales.businessId = items.businessId
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE 1=1 AND paymentStatus != 'Order' ${dateCondition} AND items.businessId = '${bizId}'
      GROUP BY items.id
      HAVING totalQty >= ? AND totalQty <= ?
      ${orderClause}
      LIMIT 50
    `, [minQty, maxQty]);

    return results;
  } catch (error) {
    console.error('Get moving items with filters error:', error);
    return null;
  }
};

export const getInStockItems = (): ItemData[] => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync<ItemData>(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE totalBaseQuantity > 0 AND items.businessId = ?
      ORDER BY totalBaseQuantity DESC
    `, [bizId]);
  } catch (error) {
    console.error('Get in stock items error:', error);
    return [];
  }
};

export const getItemsFilteredByStockStatus = (status: 'in_stock' | 'low_stock'): ItemData[] => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    let condition = status === 'in_stock' 
      ? 'totalBaseQuantity > 0'
      : 'totalBaseQuantity < 10';
    
    return database.getAllSync<ItemData>(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE ${condition} AND items.businessId = ?
      ORDER BY totalBaseQuantity ${status === 'in_stock' ? 'DESC' : 'ASC'}
    `, [bizId]);
  } catch (error) {
    console.error('Get items filtered by stock status error:', error);
    return [];
  }
};

// ===================== NEW FUNCTIONS FOR REDESIGN =====================

/**
 * Get adjustment dashboard metrics for a specific date range
 */
export const getAdjustmentDashboardMetrics = (startDate?: string, endDate?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    
    // Default to current month if no dates provided
    const d = new Date();
    const defaultStart = startDate || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultEnd = endDate || new Date().toISOString().split('T')[0];

    // Items Increased in Price
    const increasedCount = database.getFirstSync<{ count: number, total: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(newValue - oldValue), 0) as total
      FROM adjustments 
      WHERE type = 'price_up' AND date(createdAt) >= ? AND date(createdAt) <= ? AND businessId = ?
    `, [defaultStart, defaultEnd, bizId]);

    // Items Decreased in Price
    const decreasedCount = database.getFirstSync<{ count: number, total: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(oldValue - newValue), 0) as total
      FROM adjustments 
      WHERE type = 'price_down' AND date(createdAt) >= ? AND date(createdAt) <= ? AND businessId = ?
    `, [defaultStart, defaultEnd, bizId]);

    // Damaged Items
    const damagedData = database.getFirstSync<{ count: number, total: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(a.quantity * i.basePurchasePrice), 0) as total
      FROM adjustments a
      JOIN items i ON a.itemId = i.id AND i.businessId = a.businessId
      WHERE a.type = 'damaged' AND date(a.createdAt) >= ? AND date(a.createdAt) <= ? AND a.businessId = ?
    `, [defaultStart, defaultEnd, bizId]);

    const itemsIncreased = increasedCount?.count || 0;
    const itemsDecreased = decreasedCount?.count || 0;
    const damagedItems = damagedData?.count || 0;
    const estimatedValueLost = damagedData?.total || 0;
    const totalPriceIncreases = increasedCount?.total || 0;
    const totalPriceDecreases = decreasedCount?.total || 0;
    const netValueChange = totalPriceIncreases - totalPriceDecreases - estimatedValueLost;

    return {
      itemsIncreased,
      itemsDecreased,
      damagedItems,
      estimatedValueLost,
      netValueChange,
      totalPriceIncreases,
      totalPriceDecreases
    };
  } catch (error) {
    console.error('getAdjustmentDashboardMetrics error:', error);
    return null;
  }
};

/**
 * Get summary metrics by date range with period grouping
 */
export const getSummaryMetricsByDateRange = (
  startDate: string, 
  endDate: string,
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;

    // Sales (Cash)
    const salesCash = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(totalPrice), 0) as total FROM sales 
      WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND paymentStatus != 'Order' AND businessId = ?
    `, [startDate, endDate, bizId]);

    // Sales (Items count)
    const salesItems = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM sales 
      WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND paymentStatus != 'Order' AND businessId = ?
    `, [startDate, endDate, bizId]);

    // Profit (Gross Profit = Revenue - COGS)
    const profitData = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))), 0) as total
      FROM sales s
      JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ? AND paymentStatus != 'Order' AND s.businessId = ?
    `, [startDate, endDate, bizId]);

    // Debt
    const debt = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(totalPrice - COALESCE(paidAmount, 0)), 0) as total FROM sales 
      WHERE paymentStatus = 'Debt' AND date(createdAt) >= ? AND date(createdAt) <= ? AND businessId = ?
    `, [startDate, endDate, bizId]);

    // Returns (total refunds in the period)
    const returnData = database.getFirstSync<{ totalRefund: number, returnCount: number }>(`
      SELECT COALESCE(SUM(totalRefund), 0) as totalRefund, COUNT(*) as returnCount FROM returns 
      WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND businessId = ?
    `, [startDate, endDate, bizId]);

    // Damage Loss
    const damageLoss = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(a.quantity * i.basePurchasePrice), 0) as total
      FROM adjustments a
      JOIN items i ON a.itemId = i.id AND i.businessId = a.businessId
      WHERE a.type = 'damaged' AND date(a.createdAt) >= ? AND date(a.createdAt) <= ? AND a.businessId = ?
    `, [startDate, endDate, bizId]);

    // Price Changes (net gain from price increases - decreases)
    const priceChanges = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN type = 'price_up' THEN (newValue - oldValue)
          WHEN type = 'price_down' THEN (newValue - oldValue)
          ELSE 0
        END
      ), 0) as total
      FROM adjustments
      WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND businessId = ?
    `, [startDate, endDate, bizId]);

    // Other Losses (debt marked as loss)
    const otherLosses = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(totalPrice - COALESCE(paidAmount, 0)), 0) as total FROM sales 
      WHERE paymentStatus = 'Loss' AND date(createdAt) >= ? AND date(createdAt) <= ? AND businessId = ?
    `, [startDate, endDate, bizId]);

    const salesCashVal = salesCash?.total || 0;
    const salesItemsVal = salesItems?.total || 0;
    const profitVal = profitData?.total || 0;
    const debtVal = debt?.total || 0;
    const returnVal = returnData?.totalRefund || 0;
    const returnCount = returnData?.returnCount || 0;
    const damageLossVal = damageLoss?.total || 0;
    const priceChangesVal = priceChanges?.total || 0;
    const otherLossesVal = otherLosses?.total || 0;

    // Net Sales = Sales Cash - Returns
    const netSalesCash = salesCashVal - returnVal;

    // Net Profit = Sales Profit + Price Change Gains - Returns - Damage Losses - Other Losses
    const netProfit = profitVal + (priceChangesVal > 0 ? priceChangesVal : 0) - returnVal - damageLossVal - otherLossesVal;

    // Performance Rating
    let performanceRating: 'Excellent' | 'Good' | 'Average' | 'Poor' = 'Poor';
    if (netSalesCash > 0) {
      const profitRatio = netProfit / netSalesCash;
      if (profitRatio > 0.7) performanceRating = 'Excellent';
      else if (profitRatio > 0.5) performanceRating = 'Good';
      else if (profitRatio > 0.2) performanceRating = 'Average';
      else performanceRating = 'Poor';
    } else if (netProfit > 0) {
      performanceRating = 'Average';
    }

    return {
      salesCash: salesCashVal,
      netSalesCash,
      salesItems: salesItemsVal,
      profit: profitVal,
      debt: debtVal,
      returns: returnVal,
      returnCount,
      damageLoss: damageLossVal,
      priceChanges: priceChangesVal,
      otherLosses: otherLossesVal,
      netProfit,
      performanceRating,
      priceChangeGains: priceChangesVal > 0 ? priceChangesVal : 0
    };
  } catch (error) {
    console.error('getSummaryMetricsByDateRange error:', error);
    return null;
  }
};

// Phase 4.5: VAT / TOT summary for ERCA filing.
export const getVatSummaryByDateRange = (
  startDate: string,
  endDate: string,
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const rows = database.getAllSync<{ vat: number; totalPrice: number; discount: number }>(`
      SELECT vat, totalPrice, discount FROM sales
      WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND (is_deleted = 0 OR is_deleted IS NULL) AND businessId = ?
    `, [startDate, endDate, bizId]);

    const rateTotals: Record<string, { count: number; taxable: number; vat: number; sales: number }> = {};
    let totalTaxable = 0, totalVAT = 0, totalSales = 0, totalCount = 0, totalDiscount = 0;
    for (const r of rows) {
      const taxable = Math.max(0, (r.totalPrice || 0) - (r.discount || 0) - (r.vat || 0));
      const vatAmt = r.vat || 0;
      let rate = '0';
      if (vatAmt > 0 && taxable > 0) {
        rate = String(Math.round((vatAmt / taxable) * 100));
      } else if (vatAmt > 0) {
        rate = '15';
      }
      const bucket = rateTotals[rate] || { count: 0, taxable: 0, vat: 0, sales: 0 };
      bucket.count += 1;
      bucket.taxable += taxable;
      bucket.vat += vatAmt;
      bucket.sales += r.totalPrice || 0;
      rateTotals[rate] = bucket;
      totalTaxable += taxable;
      totalVAT += vatAmt;
      totalSales += r.totalPrice || 0;
      totalCount += 1;
      totalDiscount += r.discount || 0;
    }

    const buckets = Object.entries(rateTotals)
      .map(([rate, v]) => ({ rate: rate === '0' ? '0%' : `${rate}%`, ...v }))
      .sort((a: any, b: any) => (a.rate === '0%' ? 1 : b.rate === '0%' ? -1 : Number(b.rate) - Number(a.rate)));

    return {
      startDate, endDate,
      buckets,
      summary: { totalCount, totalTaxable, totalVAT, totalSales, totalDiscount }
    };
  } catch (error) {
    console.error('getVatSummaryByDateRange error:', error);
    return null;
  }
};

export const getDrilldownSummaryByDateRange = (
  startDate: string,
  endDate: string,
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const salesWhere = `date(s.createdAt) >= ? AND date(s.createdAt) <= ? AND (s.is_deleted = 0 OR s.is_deleted IS NULL) AND s.businessId = ?`;
    const salesParams = [startDate, endDate, bizId];

    const byHour = database.getAllSync(`
      SELECT CAST(strftime('%H', s.createdAt) AS INTEGER) AS hour, COUNT(*) AS saleCount,
             COALESCE(SUM(s.totalPrice), 0) AS revenue
      FROM sales s
      WHERE ${salesWhere}
      GROUP BY CAST(strftime('%H', s.createdAt) AS INTEGER)
      ORDER BY hour ASC
    `, salesParams);

    const marginByItem = database.getAllSync(`
      SELECT i.id, i.name, COALESCE(c.name, 'Uncategorized') AS categoryName,
             SUM(s.quantity) AS units,
             COALESCE(SUM(s.totalPrice), 0) AS revenue,
             COALESCE(SUM((CASE WHEN s.unitType = 'pack' THEN s.quantity * COALESCE(i.unitsPerPack, 1) ELSE s.quantity END) * COALESCE(i.basePurchasePrice, 0)), 0) AS cogs,
             COALESCE(SUM(s.totalPrice - (CASE WHEN s.unitType = 'pack' THEN s.quantity * COALESCE(i.unitsPerPack, 1) ELSE s.quantity END) * COALESCE(i.basePurchasePrice, 0)), 0) AS profit
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      LEFT JOIN categories c ON i.categoryId = c.id AND c.businessId = i.businessId
      WHERE ${salesWhere}
      GROUP BY i.id
      ORDER BY profit DESC
    `, salesParams);

    const today = new Date().toISOString().split('T')[0];
    const debtAging = database.getAllSync(`
      SELECT s.customerName, s.customerPhone,
             COALESCE(SUM(s.totalPrice), 0) - COALESCE((SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.saleId = s.id AND dp.businessId = s.businessId), 0) AS outstanding,
             CAST(julianday(?) - julianday(MAX(s.createdAt)) AS INTEGER) AS daysOverdue
      FROM sales s
      WHERE s.paymentStatus = 'Debt' AND (s.is_deleted = 0 OR s.is_deleted IS NULL) AND s.businessId = ?
      GROUP BY s.customerName, s.customerPhone
      HAVING outstanding > 0
      ORDER BY daysOverdue DESC
    `, [today, bizId]);

    const movers = database.getAllSync(`
      SELECT i.id, i.name,
             COALESCE(SUM(s.quantity), 0) AS unitsSold,
             COALESCE(SUM(s.totalPrice), 0) AS revenue,
             COUNT(s.id) AS saleCount,
             CAST(julianday(?) - julianday(MAX(s.createdAt)) AS INTEGER) AS daysSinceLastSale
      FROM items i
      LEFT JOIN sales s ON s.itemId = i.id AND ${salesWhere}
      WHERE i.is_deleted = 0 AND i.businessId = ?
      GROUP BY i.id
      ORDER BY unitsSold DESC
      LIMIT 50
    `, [today, ...salesParams, bizId]);

    return {
      startDate, endDate,
      byHour,
      marginByItem,
      debtAging,
      movers,
    };
  } catch (error) {
    console.error('getDrilldownSummaryByDateRange error:', error);
    return null;
  }
};

/**
 * Get records grouped by period for display
 */
export const getRecordsByPeriod = (
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  targetDate?: string,
  offset?: number
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const now = new Date();
    let startDate = '';
    let endDate = '';

    if (period === 'daily') {
      const dateStr = targetDate || now.toISOString().split('T')[0];
      startDate = dateStr;
      endDate = dateStr;
    } else if (period === 'weekly') {
      const safeOffset = offset || 0;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + (safeOffset * 7)); // Monday
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      startDate = weekStart.toISOString().split('T')[0];
      endDate = weekEnd.toISOString().split('T')[0];
    } else if (period === 'monthly') {
      const monthOffset = offset || 0;
      const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      startDate = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      endDate = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (period === 'yearly') {
      const yearOffset = offset || 0;
      const yearDate = new Date(now.getFullYear() + yearOffset, 0, 1);
      startDate = `${yearDate.getFullYear()}-01-01`;
      endDate = `${yearDate.getFullYear()}-12-31`;
    }

    // Combine sales and adjustments for the period
    const sales = database.getAllSync(`
      SELECT s.*, i.name as itemName, 'sale' as sourceType
      FROM sales s
      JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ? AND s.businessId = ?
      ORDER BY s.createdAt DESC
    `, [startDate, endDate, bizId]);

    const adjustments = database.getAllSync(`
      SELECT a.*, i.name as itemName, 'adjustment' as sourceType
      FROM adjustments a
      JOIN items i ON a.itemId = i.id AND i.businessId = a.businessId
      WHERE date(a.createdAt) >= ? AND date(a.createdAt) <= ? AND a.businessId = ?
      ORDER BY a.createdAt DESC
    `, [startDate, endDate, bizId]);

    return {
      startDate,
      endDate,
      sales,
      adjustments
    };
  } catch (error) {
    console.error('getRecordsByPeriod error:', error);
    return null;
  }
};

export const getEarliestRecordDate = (): string | undefined => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return undefined;
    const dates = database.getFirstSync<{ minDate: string }>(`
      SELECT MIN(minDate) as minDate FROM (
        SELECT MIN(date(createdAt)) as minDate FROM sales WHERE businessId = ?
        UNION ALL
        SELECT MIN(date(createdAt)) as minDate FROM adjustments WHERE businessId = ?
      )
    `, [bizId, bizId]);
    return dates?.minDate || undefined;
  } catch (error) {
    console.error('getEarliestRecordDate error:', error);
    return undefined;
  }
};


// ===================== MISSING EXPORTS (re-added for compatibility) =====================

export const getRecentSales = (limit: number = 20) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit, items.image, u.name as userName
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId
      LEFT JOIN users u ON sales.user_id = u.id AND u.is_deleted = 0
      WHERE sales.businessId = ?
      ORDER BY sales.createdAt DESC 
      LIMIT ?
    `, [bizId, limit]);
  } catch (error) {
    console.error('Get recent sales error:', error);
    return [];
  }
};

export const getRecentSalesGrouped = (limit: number = 20) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const sales = database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit, items.image
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id AND items.businessId = sales.businessId
      WHERE sales.businessId = ?
      ORDER BY sales.createdAt DESC 
      LIMIT ?
    `, [bizId, limit]);
    
    const groups = new Map<string, any[]>();
    const standalone: any[] = [];
    
    for (const sale of sales as any[]) {
      if (sale.batchId) {
        if (!groups.has(sale.batchId)) groups.set(sale.batchId, []);
        groups.get(sale.batchId)!.push(sale);
      } else {
        standalone.push(sale);
      }
    }
    
    const result: any[] = [];
    for (const [batchId, items] of groups) {
      result.push({
        isBatch: true,
        batchId,
        items,
        totalPrice: items.reduce((sum: number, s: any) => sum + (s.totalPrice || 0), 0),
        itemCount: items.length,
        image: items[0]?.image,
        paymentMethod: items[0]?.paymentMethod,
        paymentStatus: items[0]?.paymentStatus,
        customerName: items[0]?.customerName,
        createdAt: items[0]?.createdAt,
        firstItemName: items[0]?.itemName,
      });
    }
    
    return [...result, ...standalone]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('Get recent sales grouped error:', error);
    return [];
  }
};

export const getRecentItems = (limit: number = 10) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId 
      WHERE items.businessId = ?
      ORDER BY items.id DESC 
      LIMIT ?
    `, [bizId, limit]);
  } catch (error) {
    console.error('Get recent items error:', error);
    return [];
  }
};

export type DatePeriod = 'D' | 'W' | 'M' | 'Y';

export const getDateRangeForPeriod = (period: DatePeriod, targetDate?: string) => {
  const d = targetDate ? new Date(targetDate.replace(/-/g, '/')) : new Date();
  let start: Date;
  let end: Date = new Date(d);

  switch (period) {
    case 'D':
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      break;
    case 'W':
      start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      break;
    case 'M':
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      break;
    case 'Y':
      start = new Date(d.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

export const getCustomerActivity = (customerName?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];

    if (customerName) {
      // Return debt-related transaction timeline for this customer.
      // A row is debt-related if it was ever a Debt, is currently Debt,
      // has been partially paid, or was fully settled from Debt.
      return database.getAllSync(`
        SELECT
          s.id,
          s.createdAt,
          i.name                                          AS itemName,
          s.quantity,
          s.unit,
          s.totalPrice,
          COALESCE(s.paidAmount, 0)                       AS paidAmount,
          s.paymentStatus,
          s.paymentMethod,
          COALESCE(s.paidAmount, 0)                       AS paidSoFar,
          (s.totalPrice - COALESCE(s.paidAmount, 0))      AS remainingBalance,
          CASE
            WHEN s.paymentStatus = 'Paid'
              AND COALESCE(s.paidAmount, 0) >= s.totalPrice
              AND s.totalPrice > 0
              THEN 'full_payment'
            WHEN COALESCE(s.paidAmount, 0) > 0
              AND COALESCE(s.paidAmount, 0) < s.totalPrice
              THEN 'partial_payment'
            ELSE 'purchase'
          END AS activityType
        FROM sales s
        LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
        WHERE s.customerName = ? AND s.businessId = ?
          AND (
            s.paymentStatus = 'Debt'
            OR s.paymentStatus = 'Loss'
            OR (s.paymentStatus = 'Paid' AND COALESCE(s.paidAmount, 0) > 0)
          )
        ORDER BY s.createdAt DESC
      `, [customerName, bizId]);
    }

    // No customer â€” aggregated summary
    return database.getAllSync(`
      SELECT
        customerName,
        COUNT(*)        AS visitCount,
        SUM(totalPrice) AS totalSpent,
        MAX(createdAt)  AS lastVisit
      FROM sales
      WHERE customerName IS NOT NULL AND customerName != '' AND paymentStatus != 'Order' AND businessId = ?
      GROUP BY customerName
      ORDER BY lastVisit DESC
    `, [bizId]);
  } catch (error) {
    console.error('Get customer activity error:', error);
    return [];
  }
};

export const getPaymentMethodBreakdown = (startDate?: string, endDate?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    let query = `SELECT s.paymentMethod, COUNT(*) as count, SUM(s.totalPrice) - COALESCE(r.refunded, 0) as total FROM sales s`;
    const params: any[] = [];
    const conditions: string[] = [];

    conditions.push('s.businessId = ?');
    params.push(bizId);

    if (startDate) {
      conditions.push('date(s.createdAt) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date(s.createdAt) <= ?');
      params.push(endDate);
    }

    conditions.push("s.paymentStatus != 'Order'");
    conditions.push("s.paymentMethod IS NOT NULL AND TRIM(s.paymentMethod) != ''");

    let where = '';
    if (conditions.length > 0) {
      where = ' WHERE ' + conditions.join(' AND ');
    }

    // Subquery to get total refund per payment method via saleId
    const refundSubquery = `LEFT JOIN (
      SELECT sa.paymentMethod, SUM(r.totalRefund) as refunded
      FROM returns r
      JOIN sales sa ON r.saleId = sa.id
      ${where.replace(/s\./g, 'sa.')}
      GROUP BY sa.paymentMethod
    ) r ON s.paymentMethod = r.paymentMethod`;

    query += ' ' + refundSubquery + ' GROUP BY s.paymentMethod';
    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get payment method breakdown error:', error);
    return [];
  }
};

export const getPeakSalesHoursByItem = (itemId?: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const today = new Date().toISOString().split('T')[0];
    let query = `SELECT strftime('%H', datetime(createdAt, 'localtime')) as hour, COUNT(*) as count, SUM(quantity) as totalQty FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order' AND businessId = ?`;
    const params: any[] = [today, bizId];
    
    if (itemId) {
      query += ' AND itemId = ?';
      params.push(itemId);
    }
    
    query += ' GROUP BY hour ORDER BY count DESC LIMIT 5';
    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get peak sales hours error:', error);
    return [];
  }
};

// ===================== WAREHOUSE FUNCTIONS =====================

export const insertWarehouse = (data: { name: string; location?: string; contactPerson?: string; phone?: string; notes?: string }) => {
  try {
    const database = getDB();
    const result = database.prepareSync(`
      INSERT INTO warehouses (name, location, contactPerson, phone, notes, businessId)
      VALUES (?, ?, ?, ?, ?, ?)
    `).executeSync([data.name, data.location || null, data.contactPerson || null, data.phone || null, data.notes || null, getScopedBusinessId()]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert warehouse error:', error);
    return null;
  }
};

export const getWarehouses = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync('SELECT * FROM warehouses WHERE businessId = ? ORDER BY name ASC', [bizId]);
  } catch (error) {
    console.error('Get warehouses error:', error);
    return [];
  }
};

export const getWarehouseById = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    return database.getFirstSync('SELECT * FROM warehouses WHERE id = ? AND businessId = ?', [id, bizId]);
  } catch (error) {
    console.error('Get warehouse by ID error:', error);
    return null;
  }
};

export const updateWarehouse = (id: number, data: { name?: string; location?: string; contactPerson?: string; phone?: string; notes?: string }) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const validColumns = ['name', 'location', 'contactPerson', 'phone', 'notes'];
    const updates: string[] = [];
    const params: any[] = [];

    for (const key of validColumns) {
      if ((data as any)[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push((data as any)[key]);
      }
    }

    if (updates.length === 0) return true;
    params.push(id, bizId);
    database.runSync(`UPDATE warehouses SET ${updates.join(', ')} WHERE id = ? AND businessId = ?`, ...params);
    return true;
  } catch (error) {
    console.error('Update warehouse error:', error);
    return false;
  }
};

export const deleteWarehouse = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    // Check if any items reference this warehouse
    const itemsUsing = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE warehouseId = ? AND businessId = ?', [id, bizId]);
    if (itemsUsing && itemsUsing.count > 0) {
      // Set warehouseId to NULL for those items first
      database.runSync('UPDATE items SET warehouseId = NULL WHERE warehouseId = ? AND businessId = ?', [id, bizId]);
    }
    database.runSync('DELETE FROM warehouses WHERE id = ? AND businessId = ?', [id, bizId]);
    return true;
  } catch (error) {
    console.error('Delete warehouse error:', error);
    return false;
  }
};

export const getWarehouseStats = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    return database.getFirstSync(`
      SELECT 
        COUNT(*) as itemCount,
        COALESCE(SUM(totalBaseQuantity * basePurchasePrice), 0) as totalValue,
        COALESCE(SUM(totalBaseQuantity), 0) as totalStock
      FROM items WHERE warehouseId = ? AND businessId = ?
    `, [id, bizId]);
  } catch (error) {
    console.error('Get warehouse stats error:', error);
    return null;
  }
};

export const processIndividualPayment = (saleId: number, amount: number, paymentMethod?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return false;
    const sale = database.getFirstSync<{ totalPrice: number, paidAmount: number, itemId: number, unit: string, unitType: string, customerName: string, customerPhone: string }>(
      'SELECT totalPrice, paidAmount, itemId, unit, unitType, customerName, customerPhone FROM sales WHERE id = ? AND businessId = ?', [saleId, bizId]
    );
    if (!sale) return false;

    const newPaid = (sale.paidAmount || 0) + amount;
    const newStatus = newPaid >= sale.totalPrice ? 'Paid' : 'Debt';

    if (paymentMethod) {
      database.runSync(
        'UPDATE sales SET paidAmount = ?, paymentStatus = ?, paymentMethod = ? WHERE id = ? AND businessId = ?',
        [newPaid, newStatus, paymentMethod, saleId, bizId]
      );
    } else {
      database.runSync(
        'UPDATE sales SET paidAmount = ?, paymentStatus = ? WHERE id = ? AND businessId = ?',
        [newPaid, newStatus, saleId, bizId]
      );
    }

    // Create a payment record in sales so it appears in activity feed
    try {
      const batchId = 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      database.runSync(
        `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, businessId, createdAt)
         VALUES (?, 1, ?, ?, 0, 0, ?, ?, 'Paid', ?, ?, ?, ?, ?)`,
        [
          sale.itemId ?? 1,
          sale.unit || 'pcs',
          sale.unitType || 'base',
          -Math.abs(amount),
          paymentMethod || 'Cash',
          sale.customerName,
          sale.customerPhone ?? null,
          batchId,
          bizId,
          new Date().toISOString(),
        ]
      );
    } catch (e) {
      console.error('Create individual payment record error:', e);
    }

    return true;
  } catch (error) {
    console.error('Process individual payment error:', error);
    return false;
  }
};

// Settle a customer's debt by distributing `amount` across their outstanding
// sales (oldest first). Returns the number of sales that were affected.
export const settleDebt = (customerName: string, amount: number): number => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return 0;
    let remaining = Math.max(0, amount);
    if (remaining <= 0) return 0;

    const sales = database.getAllSync<{ id: number, totalPrice: number, paidAmount: number }>(`
      SELECT id, totalPrice, paidAmount FROM sales
      WHERE customerName = ? AND businessId = ?
        AND (paymentStatus = 'Debt' OR (paymentStatus = 'Paid' AND totalPrice > paidAmount))
      ORDER BY createdAt ASC
    `, [customerName, bizId]);

    let affected = 0;
    for (const s of sales) {
      if (remaining <= 0) break;
      const outstanding = s.totalPrice - (s.paidAmount || 0);
      if (outstanding <= 0) continue;
      const pay = Math.min(remaining, outstanding);
      const newPaid = (s.paidAmount || 0) + pay;
      const newStatus = newPaid >= s.totalPrice ? 'Paid' : 'Debt';
      database.runSync(
        'UPDATE sales SET paidAmount = ?, paymentStatus = ? WHERE id = ? AND businessId = ?',
        [newPaid, newStatus, s.id, bizId],
      );
      remaining -= pay;
      affected += 1;
    }
    return affected;
  } catch (error) {
    console.error('settleDebt error:', error);
    return 0;
  }
};

// ===================== CONTACTS (Supplier Management) =====================

export interface ContactData {
  id: number;
  fullName: string;
  category: string;
  subCategory: string | null;
  phone: string | null;
  alternatePhone: string | null;
  accountNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InsertContactData {
  fullName: string;
  category: string;
  subCategory?: string;
  phone?: string;
  alternatePhone?: string;
  accountNumber?: string;
  notes?: string;
  companyName?: string;
  email?: string;
  address?: string;
  tin?: string;
  supplierCategory?: string;
  paymentType?: string;
  isActive?: boolean;
}

export const insertContact = (data: InsertContactData) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO contacts (fullName, category, subCategory, phone, alternatePhone, accountNumber, notes,
        companyName, email, address, tin, supplierCategory, paymentType, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.executeSync([
      data.fullName,
      data.category,
      data.subCategory || null,
      data.phone || null,
      data.alternatePhone || null,
      data.accountNumber || null,
      data.notes || null,
      data.companyName || null,
      data.email || null,
      data.address || null,
      data.tin || null,
      data.supplierCategory || null,
      data.paymentType || 'cash',
      data.isActive === false ? 0 : 1
    ]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert contact error:', error);
    return null;
  }
};

export const getContacts = () => {
  try {
    const database = getDB();
    return database.getAllSync<ContactData>('SELECT * FROM contacts ORDER BY createdAt DESC');
  } catch (error) {
    console.error('Get contacts error:', error);
    return [];
  }
};

export const getContactsByCategory = (category: string) => {
  try {
    const database = getDB();
    return database.getAllSync<ContactData>('SELECT * FROM contacts WHERE category = ? ORDER BY fullName ASC', [category]);
  } catch (error) {
    console.error('Get contacts by category error:', error);
    return [];
  }
};

export const searchContacts = (query: string) => {
  try {
    const database = getDB();
    return database.getAllSync<ContactData>(
      'SELECT * FROM contacts WHERE fullName LIKE ? OR phone LIKE ? ORDER BY fullName ASC',
      [`%${query}%`, `%${query}%`]
    );
  } catch (error) {
    console.error('Search contacts error:', error);
    return [];
  }
};

export const getContactById = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync<ContactData>('SELECT * FROM contacts WHERE id = ?', [id]);
  } catch (error) {
    console.error('Get contact by ID error:', error);
    return null;
  }
};

export const updateContact = (id: number, data: Partial<InsertContactData>) => {
  try {
    const database = getDB();
    const validColumns = ['fullName', 'category', 'subCategory', 'phone', 'alternatePhone', 'accountNumber', 'notes', 'companyName', 'email', 'address', 'tin', 'supplierCategory', 'paymentType'];
    const updates: string[] = [];
    const params: any[] = [];

    for (const key of validColumns) {
      if ((data as any)[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push((data as any)[key]);
      }
    }

    if (updates.length === 0) return true;

    params.push(id);
    database.runSync(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, ...params);
    return true;
  } catch (error) {
    console.error('Update contact error:', error);
    return false;
  }
};

export const deleteContact = (id: number) => {
  try {
    const database = getDB();
    database.runSync('DELETE FROM contacts WHERE id = ?', id);
    return true;
  } catch (error) {
    console.error('Delete contact error:', error);
    return false;
  }
};

export const getSuppliers = () => {
  try {
    const database = getDB();
    return database.getAllSync<ContactData>(
      "SELECT * FROM contacts WHERE category = 'supplier' ORDER BY fullName ASC"
    );
  } catch (error) {
    console.error('Get suppliers error:', error);
    return [];
  }
};

export interface SupplierRow {
  id: number;
  fullName: string;
  companyName: string | null;
  phone: string | null;
  alternatePhone: string | null;
  accountNumber: string | null;
  email: string | null;
  address: string | null;
  tin: string | null;
  supplierCategory: string | null;
  paymentType: string | null;
  isActive: number;
  notes: string | null;
  createdAt: string;
  totalPurchases: number;
  purchasePaid: number;
  paymentsSum: number;
  lastPurchaseDate: string | null;
  productCount: number;
}

export interface InsertSupplierData {
  fullName: string;
  phone: string;
  companyName?: string;
  alternatePhone?: string;
  accountNumber?: string;
  email?: string;
  address?: string;
  tin?: string;
  supplierCategory?: string;
  paymentType?: 'cash' | 'credit' | 'partial';
  isActive?: boolean;
  notes?: string;
}

const SUPPLIER_STATS_SQL = `
  SELECT
    c.id,
    c.fullName,
    c.companyName,
    c.phone,
    c.alternatePhone,
    c.accountNumber,
    c.email,
    c.address,
    c.tin,
    c.supplierCategory,
    c.paymentType,
    c.isActive,
    c.notes,
    c.createdAt,
    COALESCE(SUM(sm.quantityAdded * COALESCE(sm.unitPrice, 0)), 0) AS totalPurchases,
    COALESCE(SUM(COALESCE(sm.paidAmount, 0)), 0) AS purchasePaid,
    (SELECT COALESCE(SUM(amount), 0) FROM supplier_payments p WHERE p.supplierId = c.id) AS paymentsSum,
    MAX(sm.createdAt) AS lastPurchaseDate,
    (SELECT COUNT(*) FROM (
      SELECT itemId FROM item_suppliers WHERE supplierId = c.id
      UNION
      SELECT i.id FROM items i WHERE i.supplierId = c.id
    )) AS productCount
  FROM contacts c
  LEFT JOIN stock_movements sm ON sm.supplierId = c.id
  WHERE c.category = 'supplier'
`;

const mapSupplierRow = (r: any): SupplierRow & { outstanding: number; hasDebt: boolean } => {
  const outstanding = (r.totalPurchases || 0) - (r.purchasePaid || 0) - (r.paymentsSum || 0);
  return {
    ...r,
    totalPurchases: r.totalPurchases || 0,
    purchasePaid: r.purchasePaid || 0,
    paymentsSum: r.paymentsSum || 0,
    productCount: r.productCount || 0,
    outstanding,
    hasDebt: outstanding > 0.001,
  };
};

export const getSupplierList = (status?: 'all' | 'active' | 'inactive' | 'debt') => {
  try {
    const database = getDB();
    let sql = SUPPLIER_STATS_SQL;
    if (status === 'active') sql += ` AND c.isActive = 1`;
    if (status === 'inactive') sql += ` AND c.isActive = 0`;
    sql += ` GROUP BY c.id`;
    if (status === 'debt') {
      sql += ` HAVING (SUM(sm.quantityAdded * COALESCE(sm.unitPrice, 0)) - COALESCE(SUM(COALESCE(sm.paidAmount, 0)), 0) - (SELECT COALESCE(SUM(amount), 0) FROM supplier_payments p WHERE p.supplierId = c.id)) > 0.001`;
    }
    sql += ` ORDER BY c.fullName ASC`;
    const rows = database.getAllSync(sql);
    return rows.map(mapSupplierRow);
  } catch (error) {
    console.error('Get supplier list error:', error);
    return [];
  }
};

export const getSupplierById = (id: number): (SupplierRow & { outstanding: number; hasDebt: boolean }) | null => {
  try {
    const database = getDB();
    const row = database.getFirstSync(`${SUPPLIER_STATS_SQL} AND c.id = ? GROUP BY c.id`, [id]);
    if (!row) return null;
    return mapSupplierRow(row);
  } catch (error) {
    console.error('Get supplier by id error:', error);
    return null;
  }
};

export const searchSuppliers = (query: string) => {
  try {
    const database = getDB();
    const q = `%${query}%`;
    const sql = `${SUPPLIER_STATS_SQL} AND (c.fullName LIKE ? OR c.companyName LIKE ? OR c.phone LIKE ?) GROUP BY c.id ORDER BY c.fullName ASC`;
    const rows = database.getAllSync(sql, [q, q, q]);
    return rows.map(mapSupplierRow);
  } catch (error) {
    console.error('Search suppliers error:', error);
    return [];
  }
};

export const insertSupplier = (data: InsertSupplierData) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO contacts (fullName, category, subCategory, phone, alternatePhone, accountNumber, notes,
        companyName, email, address, tin, supplierCategory, paymentType, isActive)
      VALUES (?, 'supplier', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.executeSync([
      data.fullName,
      data.supplierCategory || null,
      data.phone || null,
      data.alternatePhone || null,
      data.accountNumber || null,
      data.notes || null,
      data.companyName || null,
      data.email || null,
      data.address || null,
      data.tin || null,
      data.supplierCategory || null,
      data.paymentType || 'cash',
      data.isActive === false ? 0 : 1,
    ]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert supplier error:', error);
    return null;
  }
};

const SUPPLIER_UPDATE_COLUMNS = [
  'fullName', 'companyName', 'phone', 'alternatePhone', 'accountNumber',
  'email', 'address', 'tin', 'supplierCategory', 'paymentType', 'notes',
];

export const updateSupplier = (id: number, data: Partial<InsertSupplierData> & { isActive?: boolean }) => {
  try {
    const database = getDB();
    const updates: string[] = [];
    const params: any[] = [];
    for (const col of SUPPLIER_UPDATE_COLUMNS) {
      if ((data as any)[col] !== undefined) {
        updates.push(`${col} = ?`);
        params.push((data as any)[col]);
      }
    }
    if (data.isActive !== undefined) {
      updates.push('isActive = ?');
      params.push(data.isActive ? 1 : 0);
    }
    if (updates.length === 0) return true;
    params.push(id);
    database.runSync(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, ...params);
    return true;
  } catch (error) {
    console.error('Update supplier error:', error);
    return false;
  }
};

export const deleteSupplier = (id: number) => {
  try {
    const database = getDB();
    database.runSync('DELETE FROM item_suppliers WHERE supplierId = ?', id);
    database.runSync('DELETE FROM supplier_payments WHERE supplierId = ?', id);
    database.runSync('DELETE FROM stock_movements WHERE supplierId = ?', id);
    database.runSync('DELETE FROM contacts WHERE id = ? AND category = \'supplier\'', id);
    database.runSync('UPDATE items SET supplierId = NULL WHERE supplierId = ?', id);
    return true;
  } catch (error) {
    console.error('Delete supplier error:', error);
    return false;
  }
};

export interface SupplierPurchase {
  id: number;
  orderNumber: string;
  itemId: number;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  paymentStatus: string | null;
  paidAmount: number;
  outstandingAmount: number;
  createdAt: string;
}

export const getSupplierPurchases = (supplierId: number): SupplierPurchase[] => {
  try {
    const database = getDB();
    const rows = database.getAllSync(`
      SELECT
        sm.id,
        sm.itemId,
        COALESCE(i.name, 'Unknown item') AS itemName,
        sm.quantityAdded AS quantity,
        COALESCE(sm.unit, 'pcs') AS unit,
        COALESCE(sm.unitPrice, 0) AS unitPrice,
        (sm.quantityAdded * COALESCE(sm.unitPrice, 0)) AS totalAmount,
        COALESCE(sm.paymentStatus, 'Paid') AS paymentStatus,
        COALESCE(sm.paidAmount, 0) AS paidAmount,
        ((sm.quantityAdded * COALESCE(sm.unitPrice, 0)) - COALESCE(sm.paidAmount, 0)) AS outstandingAmount,
        sm.createdAt
      FROM stock_movements sm
      LEFT JOIN items i ON sm.itemId = i.id
      WHERE sm.supplierId = ?
      ORDER BY sm.createdAt DESC
    `, [supplierId]);
    return (rows as any[]).map((r: any) => ({
      ...r,
      orderNumber: `PO-${String(r.id).padStart(5, '0')}`,
      quantity: r.quantity || 0,
      unitPrice: r.unitPrice || 0,
      totalAmount: r.totalAmount || 0,
      paidAmount: r.paidAmount || 0,
      outstandingAmount: r.outstandingAmount || 0,
    }));
  } catch (error) {
    console.error('Get supplier purchases error:', error);
    return [];
  }
};

export const getSupplierProducts = (supplierId: number) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT DISTINCT
        i.id,
        i.name,
        i.categoryId,
        COALESCE(i.totalBaseQuantity, 0) AS currentStock,
        i.baseUnit,
        COALESCE(i.basePurchasePrice, 0) AS lastPurchasePrice,
        (
          SELECT MAX(sm.createdAt)
          FROM stock_movements sm
          WHERE sm.itemId = i.id AND sm.supplierId = ?
        ) AS lastPurchaseDate
      FROM items i
      WHERE i.id IN (
        SELECT itemId FROM item_suppliers WHERE supplierId = ?
        UNION
        SELECT i2.id FROM items i2 WHERE i2.supplierId = ?
      )
      ORDER BY i.name ASC
    `, [supplierId, supplierId, supplierId]);
  } catch (error) {
    console.error('Get supplier products error:', error);
    return [];
  }
};

export interface SupplierPayment {
  id: number;
  supplierId: number;
  amount: number;
  paidAt: string | null;
  method: string | null;
  note: string | null;
  createdAt: string;
}

export const getSupplierPayments = (supplierId: number): SupplierPayment[] => {
  try {
    const database = getDB();
    return database.getAllSync<SupplierPayment>(
      'SELECT * FROM supplier_payments WHERE supplierId = ? ORDER BY COALESCE(paidAt, createdAt) DESC',
      [supplierId]
    );
  } catch (error) {
    console.error('Get supplier payments error:', error);
    return [];
  }
};

export const insertSupplierPayment = (data: { supplierId: number; amount: number; paidAt?: string; method?: string; note?: string }) => {
  try {
    if (!data.supplierId || !data.amount || data.amount <= 0) return null;
    const database = getDB();
    const result = database.runSync(
      'INSERT INTO supplier_payments (supplierId, amount, paidAt, method, note) VALUES (?, ?, ?, ?, ?)',
      data.supplierId,
      data.amount,
      data.paidAt || new Date().toISOString(),
      data.method || null,
      data.note || null
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert supplier payment error:', error);
    return null;
  }
};

// â”€â”€â”€ Supplier product orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SupplierOrderItem {
  itemId?: number | null;
  name: string;
  unit?: string;
  currentStock?: number;
  quantity: number;
  price: number;
}

export interface SupplierOrderRow {
  id: number;
  supplierId: number;
  orderNumber: string;
  items: SupplierOrderItem[];
  totalAmount: number;
  notes: string | null;
  createdAt: string;
}

let _supplierOrderCounter = 0;

const mapSupplierOrderRow = (r: any): SupplierOrderRow => {
  let items: SupplierOrderItem[] = [];
  try {
    items = JSON.parse(r.items || '[]');
  } catch {
    items = [];
  }
  return {
    id: r.id,
    supplierId: r.supplierId,
    orderNumber: r.orderNumber || `SO-${String(r.id).padStart(5, '0')}`,
    items,
    totalAmount: r.totalAmount || 0,
    notes: r.notes || null,
    createdAt: r.createdAt,
  };
};

// Saves a supplier product order. The order number (SO-xxxx-NNN) is
// assigned after insert so it can include the stable row id.
export const insertSupplierOrder = (data: { supplierId: number; items: SupplierOrderItem[]; notes?: string }) => {
  try {
    if (!data.supplierId || !data.items || data.items.length === 0) return null;
    const database = getDB();
    const totalAmount = data.items.reduce((sum, it) => sum + ((it.quantity || 0) * (it.price || 0)), 0);
    const result = database.runSync(
      'INSERT INTO supplier_orders (supplierId, orderNumber, items, totalAmount, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      data.supplierId,
      '',
      JSON.stringify(data.items),
      totalAmount,
      data.notes?.trim() || null,
      new Date().toISOString()
    );
    const id = result.lastInsertRowId;
    _supplierOrderCounter += 1;
    const orderNumber = `SO-${Date.now().toString(36).toUpperCase().slice(-4)}-${String(_supplierOrderCounter).padStart(3, '0')}`;
    database.runSync('UPDATE supplier_orders SET orderNumber = ? WHERE id = ?', orderNumber, id);
    return { id, orderNumber, totalAmount };
  } catch (error) {
    console.error('Insert supplier order error:', error);
    return null;
  }
};

export const getSupplierOrders = (supplierId: number): SupplierOrderRow[] => {
  try {
    const database = getDB();
    const rows = database.getAllSync<any>(
      'SELECT * FROM supplier_orders WHERE supplierId = ? ORDER BY createdAt DESC, id DESC',
      [supplierId]
    );
    return rows.map(mapSupplierOrderRow);
  } catch (error) {
    console.error('Get supplier orders error:', error);
    return [];
  }
};

export const deleteSupplierOrder = (id: number) => {
  try {
    const database = getDB();
    database.runSync('DELETE FROM supplier_orders WHERE id = ?', id);
    return true;
  } catch (error) {
    console.error('Delete supplier order error:', error);
    return false;
  }
};

export const getItemSuppliers = (itemId: number) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT c.*
      FROM item_suppliers isup
      JOIN contacts c ON c.id = isup.supplierId
      WHERE isup.itemId = ?
      ORDER BY c.fullName ASC
    `, [itemId]);
  } catch (error) {
    console.error('Get item suppliers error:', error);
    return [];
  }
};

export const linkItemSupplier = (itemId: number, supplierId: number) => {
  try {
    const database = getDB();
    database.runSync('INSERT OR IGNORE INTO item_suppliers (itemId, supplierId) VALUES (?, ?)', itemId, supplierId);
    return true;
  } catch (error) {
    console.error('Link item supplier error:', error);
    return false;
  }
};

export const unlinkItemSupplier = (itemId: number, supplierId: number) => {
  try {
    const database = getDB();
    database.runSync('DELETE FROM item_suppliers WHERE itemId = ? AND supplierId = ?', itemId, supplierId);
    return true;
  } catch (error) {
    console.error('Unlink item supplier error:', error);
    return false;
  }
};


// â†’â†’ getSalesGroupedByDateRange â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’
// Returns sales rows with extra computed columns used by SalesRecordScreen
// to group them by day-of-week, week-number, or month-number.
export const getSalesGroupedByDateRange = (
  period: 'today' | 'yesterday' | 'date' | 'week' | 'month' | 'year',
  targetDate?: string,
  offset: number = 0
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const now = new Date();
    let whereClause = '';

    if (period === 'today') {
      const d = now.toISOString().split('T')[0];
      whereClause = `WHERE date(s.createdAt) = '${d}'`;
    } else if (period === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      whereClause = `WHERE date(s.createdAt) = '${d}'`;
    } else if (period === 'date' && targetDate) {
      whereClause = `WHERE date(s.createdAt) = '${targetDate}'`;
    } else if (period === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + offset * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      whereClause = `WHERE date(s.createdAt) >= '${weekStart.toISOString().split('T')[0]}' AND date(s.createdAt) <= '${weekEnd.toISOString().split('T')[0]}'`;
    } else if (period === 'month') {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = monthDate.getFullYear();
      const m = String(monthDate.getMonth() + 1).padStart(2, '0');
      whereClause = `WHERE strftime('%Y-%m', s.createdAt) = '${y}-${m}'`;
    } else if (period === 'year') {
      const yr = now.getFullYear() + offset;
      whereClause = `WHERE strftime('%Y', s.createdAt) = '${yr}'`;
    }
    whereClause += `${whereClause ? ' AND' : ' WHERE'} s.businessId = '${bizId}'`;

    const rows = database.getAllSync(`
      SELECT
        s.*,
        i.name                                    AS itemName,
        i.baseUnit,
        i.image                                   AS image,
        strftime('%H:%M', s.createdAt)            AS timeStr,
        CAST(strftime('%w', s.createdAt) AS INTEGER) AS dayOfWeek,
        ((CAST(strftime('%d', s.createdAt) AS INTEGER) - 1) / 7 + 1) AS weekNum,
        CAST(strftime('%m', s.createdAt) AS INTEGER) AS monthNum
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      ${whereClause}
      ORDER BY s.createdAt DESC
    `);

    const groups = new Map<string, any[]>();
    const standalone: any[] = [];

    for (const row of rows as any[]) {
      if (row.batchId) {
        if (!groups.has(row.batchId)) groups.set(row.batchId, []);
        groups.get(row.batchId)!.push(row);
      } else {
        standalone.push(row);
      }
    }

    const result: any[] = [];
    for (const [batchId, items] of groups) {
      const first = items[0];
      result.push({
        isBatch: true,
        batchId,
        items,
        totalPrice: items.reduce((sum, s) => sum + (s.totalPrice || 0), 0),
        quantity: items.length,
        itemName: items.length > 1
          ? items[0]?.itemName + ' +' + (items.length - 1) + ' more'
          : items[0]?.itemName,
        image: items[0]?.image,
        customerName: first?.customerName,
        paymentMethod: first?.paymentMethod,
        paymentStatus: first?.paymentStatus,
        discount: first?.discount,
        vat: first?.vat,
        taxType: first?.taxType,
        createdAt: first?.createdAt,
        timeStr: first?.timeStr,
        dayOfWeek: first?.dayOfWeek,
        weekNum: first?.weekNum,
        monthNum: first?.monthNum,
      });
    }

    return [...result, ...standalone]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('getSalesGroupedByDateRange error:', error);
    return [];
  }
};

// â†’â†’ getPaidOutstandingSummary â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’
// Returns count + total for Paid vs Debt sales, filtered by period/date range.
export const getPaidOutstandingSummary = (
  period: 'today' | 'yesterday' | 'date' | 'week' | 'month' | 'year' = 'today',
  targetDate?: string,
  offset: number = 0
) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const now = new Date();
    let whereClause = '';

    if (period === 'today') {
      const d = now.toISOString().split('T')[0];
      whereClause = `WHERE date(createdAt) = '${d}'`;
    } else if (period === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      whereClause = `WHERE date(createdAt) = '${d}'`;
    } else if (period === 'date' && targetDate) {
      whereClause = `WHERE date(createdAt) = '${targetDate}'`;
    } else if (period === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + offset * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      whereClause = `WHERE date(createdAt) >= '${weekStart.toISOString().split('T')[0]}' AND date(createdAt) <= '${weekEnd.toISOString().split('T')[0]}'`;
    } else if (period === 'month') {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = monthDate.getFullYear();
      const m = String(monthDate.getMonth() + 1).padStart(2, '0');
      whereClause = `WHERE strftime('%Y-%m', createdAt) = '${y}-${m}'`;
    } else if (period === 'year') {
      const yr = now.getFullYear() + offset;
      whereClause = `WHERE strftime('%Y', createdAt) = '${yr}'`;
    }
    whereClause += `${whereClause ? ' AND' : ' WHERE'} businessId = '${bizId}'`;

    const paid = database.getFirstSync<{ count: number; total: number }>(`
      SELECT COUNT(*) AS count, COALESCE(SUM(totalPrice), 0) AS total
      FROM sales
      ${whereClause} ${whereClause ? 'AND' : 'WHERE'} paymentStatus = 'Paid'
    `);

    const outstanding = database.getFirstSync<{ count: number; total: number }>(`
      SELECT COUNT(*) AS count, COALESCE(SUM(totalPrice - COALESCE(paidAmount, 0)), 0) AS total
      FROM sales
      ${whereClause} ${whereClause ? 'AND' : 'WHERE'} paymentStatus = 'Debt'
    `);

    return {
      paid:        { count: paid?.count ?? 0,        total: paid?.total ?? 0 },
      outstanding: { count: outstanding?.count ?? 0, total: outstanding?.total ?? 0 },
    };
  } catch (error) {
    console.error('getPaidOutstandingSummary error:', error);
    return null;
  }
};

export const getBusinesses = () => {
  return [];
};

export const getActiveBusiness = () => {
  return null;
};

/**
 * Resolves the business-scoping key for the current session: the UUID of the
 * active business, falling back to the default business, then any live business.
 * Returns null before onboarding (no business exists yet) so newly created rows
 * stay NULL and are not visible under any active filter.
 */
export const getScopedBusinessId = (): string | null => {
  try {
    const database = getDB();
    const active = database.getFirstSync(`SELECT value FROM app_settings WHERE key = 'active_business_id'`) as any;
    if (active?.value) {
      const ok = database.getFirstSync('SELECT id FROM businesses WHERE id = ? AND is_deleted = 0', [active.value]) as any;
      if (ok?.id) return String(active.value);
    }
    const fb = database.getFirstSync(`SELECT id FROM businesses WHERE is_deleted = 0 ORDER BY (is_default = 1) DESC, id LIMIT 1`) as any;
    return fb?.id ? String(fb.id) : null;
  } catch (error) {
    console.warn('getScopedBusinessId error:', error);
    return null;
  }
};

export const insertPack = (data: { itemId: number; packNumber: number; quantity: number; unit: string }) => {
  try {
    const database = getDB();
    return database.prepareSync(`
      INSERT INTO item_packs (itemId, packNumber, initialQuantity, currentQuantity, unit, businessId)
      VALUES (?, ?, ?, ?, ?, ?)
    `).executeSync([data.itemId, data.packNumber, data.quantity, data.quantity, data.unit, getScopedBusinessId()]) as any;
  } catch (error) {
    console.error('Insert pack error:', error);
    return null;
  }
};

export const insertPacksBatch = (packs: Array<{ itemId: number; packNumber: number; quantity: number; unit: string }>) => {
  try {
    const database = getDB();
    const stmt = database.prepareSync(`
      INSERT INTO item_packs (itemId, packNumber, initialQuantity, currentQuantity, unit, businessId)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const pack of packs) {
      stmt.executeSync([pack.itemId, pack.packNumber, pack.quantity, pack.quantity, pack.unit, getScopedBusinessId()]);
    }
    return packs.length;
  } catch (error) {
    console.error('Batch insert packs error:', error);
    return null;
  }
};

export const insertReturn = (data: { saleId: number; itemId: number; quantity: number; unit: string; unitType: string; totalRefund: number; reason: string; createdAt: string }) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;

    const statement = database.prepareSync(`
      INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, createdAt, businessId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.executeSync([data.saleId, data.itemId, data.quantity, data.unit, data.unitType, data.totalRefund, data.reason, data.createdAt, bizId]);

    const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ? AND businessId = ?', [data.itemId, bizId]);
    let baseQty = data.quantity;
    let packQty = 0;

    if (data.unitType === 'pack' && item?.unitsPerPack) {
      baseQty = data.quantity * item.unitsPerPack;
      packQty = data.quantity;
    }

    database.runSync(
      'UPDATE items SET totalBaseQuantity = totalBaseQuantity + ?, totalPackQuantity = totalPackQuantity + ? WHERE id = ? AND businessId = ?',
      [baseQty, packQty, data.itemId, bizId]
    );

    return true;
  } catch (error) {
    console.error('Insert return error:', error);
    return null;
  }
};

export const getReturnsBySaleId = (saleId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    return database.getAllSync(`
      SELECT r.*, i.name as itemName, i.baseUnit
      FROM returns r
      LEFT JOIN items i ON r.itemId = i.id AND i.businessId = r.businessId
      WHERE r.saleId = ? AND r.businessId = ?
      ORDER BY r.createdAt DESC
    `, [saleId, bizId]);
  } catch (error) {
    console.error('getReturnsBySaleId error:', error);
    return [];
  }
};

export const getReturnStats = (saleId: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return { totalReturnedQty: 0, totalRefundAmount: 0, returnCount: 0, originalQty: 0, remainingQty: 0, status: 'no_return' as const };
    const stats = database.getFirstSync<{
      totalReturnedQty: number;
      totalRefundAmount: number;
      returnCount: number;
      originalQty: number;
    }>(`
      SELECT
        COALESCE(SUM(r.quantity), 0) as totalReturnedQty,
        COALESCE(SUM(r.totalRefund), 0) as totalRefundAmount,
        COUNT(r.id) as returnCount,
        COALESCE(s.quantity, 0) as originalQty
      FROM sales s
      LEFT JOIN returns r ON r.saleId = s.id AND r.businessId = s.businessId
      WHERE s.id = ? AND s.businessId = ?
      GROUP BY s.id
    `, [saleId, bizId]);

    if (!stats) {
      return { totalReturnedQty: 0, totalRefundAmount: 0, returnCount: 0, originalQty: 0, remainingQty: 0, status: 'no_return' as const };
    }

    const remainingQty = Math.max(0, stats.originalQty - stats.totalReturnedQty);
    let status: 'no_return' | 'partial' | 'full';
    if (stats.totalReturnedQty <= 0) {
      status = 'no_return';
    } else if (remainingQty <= 0) {
      status = 'full';
    } else {
      status = 'partial';
    }

    return {
      totalReturnedQty: stats.totalReturnedQty,
      totalRefundAmount: stats.totalRefundAmount,
      returnCount: stats.returnCount,
      originalQty: stats.originalQty,
      remainingQty,
      status,
    };
  } catch (error) {
    console.error('getReturnStats error:', error);
    return { totalReturnedQty: 0, totalRefundAmount: 0, returnCount: 0, originalQty: 0, remainingQty: 0, status: 'no_return' as const };
  }
};

export const processReturn = (data: {
  saleId: number;
  itemId: number;
  quantity: number;
  unit: string;
  unitType: string;
  totalRefund: number;
  reason: string;
  itemCondition: string;
  refundType: string;
  notes?: string;
  returnDate?: string;
  createdAt: string;
}) => {
  const database = getDB();
  const bizId = getScopedBusinessId();
  if (bizId == null) return null;
  beginTransaction(database);
  try {
    // Validate: check cumulative returns against original sale quantity
    const saleCheck = database.getFirstSync<{ quantity: number }>('SELECT quantity FROM sales WHERE id = ? AND businessId = ?', [data.saleId, bizId]);
    if (!saleCheck) {
      rollbackTransaction(database);
      console.error('processReturn error: Sale not found');
      return null;
    }
    const returnTotal = database.getFirstSync<{ totalQty: number }>(
      'SELECT COALESCE(SUM(quantity), 0) as totalQty FROM returns WHERE saleId = ? AND businessId = ?',
      [data.saleId, bizId]
    );
    const cumulativeQty = (returnTotal?.totalQty || 0) + data.quantity;
    if (cumulativeQty > saleCheck.quantity) {
      rollbackTransaction(database);
      console.error('processReturn error: Cannot return more than original sale quantity');
      return null;
    }

    const insertStmt = database.prepareSync(`
      INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, itemCondition, refundType, notes, returnDate, createdAt, businessId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.executeSync([
      data.saleId, data.itemId, data.quantity, data.unit, data.unitType,
      data.totalRefund, data.reason, data.itemCondition, data.refundType,
      data.notes || null, data.returnDate || null, data.createdAt, bizId,
    ]);

    const item = database.getFirstSync<{
      unitsPerPack: number;
      basePurchasePrice: number;
      baseSellingPrice: number;
      packPurchasePrice: number;
      packSellingPrice: number;
      name: string;
    }>('SELECT unitsPerPack, basePurchasePrice, baseSellingPrice, packPurchasePrice, packSellingPrice, name FROM items WHERE id = ? AND businessId = ?', [data.itemId, bizId]);

    let baseQty = data.quantity;
    let packQty = 0;

    if (data.unitType === 'pack' && item?.unitsPerPack) {
      baseQty = data.quantity * item.unitsPerPack;
      packQty = data.quantity;
    }

    const purchasePrice = data.unitType === 'pack' ? (item?.packPurchasePrice || 0) : (item?.basePurchasePrice || 0);
    const costOfReturnedGoods = purchasePrice * data.quantity;

    // Handle inventory based on condition
    if (data.itemCondition === 'Resellable') {
      database.runSync(
        'UPDATE items SET totalBaseQuantity = totalBaseQuantity + ?, totalPackQuantity = totalPackQuantity + ? WHERE id = ? AND businessId = ?',
        [baseQty, packQty, data.itemId, bizId]
      );
    } else {
      const adjStmt = database.prepareSync(`
        INSERT INTO adjustments (itemId, type, oldValue, newValue, quantity, unitType, reason, date, createdAt, businessId)
        VALUES (?, 'damaged', 0, 0, ?, ?, ?, ?, ?, ?)
      `);
      adjStmt.executeSync([
        data.itemId, data.quantity, data.unitType,
        `Returned: ${data.itemCondition} - ${data.reason}`,
        data.createdAt.split('T')[0], data.createdAt, bizId
      ]);
    }

    // Handle store credit
    if (data.refundType === 'Store Credit' && data.totalRefund > 0) {
      const creditBatch = `SCR_${Date.now()}_${data.saleId}`;
      const saleData = database.getFirstSync<{ customerName: string; customerPhone: string }>(
        'SELECT customerName, customerPhone FROM sales WHERE id = ? AND businessId = ?', [data.saleId, bizId]
      );
      const creditStmt = database.prepareSync(`
        INSERT INTO sales (itemId, quantity, unit, unitType, totalPrice, discount, paymentMethod, paymentStatus, customerName, customerPhone, batchId, notes, createdAt, businessId)
        VALUES (?, ?, ?, ?, ?, 0, 'Credit', 'Paid', ?, ?, ?, 'Store credit issued for return', ?, ?)
      `);
      creditStmt.executeSync([
        data.itemId, data.quantity, data.unit, data.unitType,
        -data.totalRefund, saleData?.customerName || '',
        saleData?.customerPhone || '', creditBatch, data.createdAt, bizId
      ]);
    }

    commitTransaction(database);
    return true;
  } catch (error) {
    rollbackTransaction(database);
    console.error('processReturn error:', error);
    return null;
  }
};

export const getAdjustmentById = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const result = database.getFirstSync(`
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.baseSellingPrice, items.packPurchasePrice
      FROM adjustments 
      LEFT JOIN items ON adjustments.itemId = items.id AND items.businessId = adjustments.businessId
      WHERE adjustments.id = ? AND adjustments.businessId = ?
    `, [id, bizId]);
    return result;
  } catch (error) {
    console.error('getAdjustmentById error:', error);
    return null;
  }
};

// Compliance settings helpers
export const getComplianceSettings = () => {
  try {
    const database = getDB();
    const cashLimit = database.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['cash_transaction_limit']);
    const allowNegativeStock = database.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['allow_negative_stock']);
    const requireDigitalOverLimit = database.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['require_digital_over_limit']);
    return {
      cashTransactionLimit: cashLimit ? parseFloat(cashLimit.value) : 50000,
      allowNegativeStock: allowNegativeStock ? allowNegativeStock.value === '1' : false,
      requireDigitalOverLimit: requireDigitalOverLimit ? requireDigitalOverLimit.value === '1' : true,
    };
  } catch (error) {
    console.error('Get compliance settings error:', error);
    return { cashTransactionLimit: 50000, allowNegativeStock: false, requireDigitalOverLimit: true };
  }
};

export const setComplianceSetting = (key: string, value: string) => {
  try {
    const database = getDB();
    database.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
    return true;
  } catch (error) {
    console.error('Set compliance setting error:', error);
    return false;
  }
};

// Generic app_settings read helper (role, counters, flags).
export const getAppSetting = (key: string, fallback: string | null = null): string | null => {
  try {
    const database = getDB();
    const row = database.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row ? row.value : fallback;
  } catch (error) {
    console.error('Get app setting error:', error);
    return fallback;
  }
};

// Progressive disclosure flags for optional features (Warehouses, Shipments).
// New businesses are asked during setup; existing installs keep the default
// (enabled) so nothing disappears for users who already use the feature.
export const getFeatureFlag = (key: string, fallback: boolean = true): boolean => {
  try {
    const database = getDB();
    const row = database.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row ? row.value === '1' : fallback;
  } catch (error) {
    console.error('Get feature flag error:', error);
    return fallback;
  }
};

export const setFeatureFlag = (key: string, value: boolean): void => {
  try {
    const database = getDB();
    database.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value ? '1' : '0']);
  } catch (error) {
    console.error('Set feature flag error:', error);
  }
};

// Generates a unique internal product code (e.g. "SHG-000123") scannable as
// CODE128. Used for products without a manufacturer barcode. The counter lives
// in app_settings so codes stay monotonic across the business.
export const generateShegaCode = (): string => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return 'SHG-' + String(Date.now()).slice(-6);
    const row = database.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['shega_barcode_seq']);
    let seq = row ? parseInt(row.value, 10) || 0 : 0;
    for (let i = 0; i < 100; i++) {
      seq += 1;
      const code = 'SHG-' + String(seq).padStart(6, '0');
      const clash = database.getFirstSync<{ n: number }>(
        'SELECT COUNT(*) as n FROM items WHERE (barcode = ? OR sku = ?) AND is_deleted = 0 AND businessId = ?', [code, code, bizId]
      );
      if (!clash || clash.n === 0) {
        database.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['shega_barcode_seq', String(seq)]);
        return code;
      }
    }
    return 'SHG-' + String(Date.now()).slice(-6);
  } catch (error) {
    console.error('Generate Shega code error:', error);
    return 'SHG-' + String(Date.now()).slice(-6);
  }
};

export const searchInventory = (query: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const q = `%${query}%`;
    return database.getAllSync(
      `SELECT items.*, categories.name as categoryName
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId
      WHERE items.is_deleted = 0 AND items.businessId = ?
        AND (
          items.name LIKE ? 
          OR categories.name LIKE ?
          OR items.sku LIKE ?
          OR items.barcode LIKE ?
          OR EXISTS (
            SELECT 1 FROM item_barcodes ib 
            WHERE ib.itemId = items.id 
            AND ib.businessId = items.businessId
            AND ib.barcode LIKE ? 
            AND ib.is_deleted = 0
          )
        )
      ORDER BY items.id DESC
      LIMIT 20`,
      [bizId, q, q, q, q, q]
    );
  } catch (error) {
    console.error('Search inventory error:', error);
    return [];
  }
};

// â†’â†’ Order Functions â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’

let _orderCounter = 0;
const getNextOrderNumber = (): string => {
  _orderCounter += 1;
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `ORD-${ts}-${String(_orderCounter).padStart(3, '0')}`;
};

export const insertOrder = (data: {
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: { itemId?: number; itemName: string; quantity: number; unitType: string; unit?: string; price: number }[];
}) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    const batchId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 8);
    const orderNumber = getNextOrderNumber();
    const now = new Date().toISOString();

    for (const item of data.items) {
      const totalPrice = item.price * item.quantity;
      database.runSync(
        `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, orderNumber, notes, businessId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.itemId || null,
        item.quantity,
        item.unit || 'pcs',
        item.unitType || 'base',
        0, 0, totalPrice, null, 'Order',
        data.customerName || null,
        data.customerPhone || null,
        batchId, orderNumber, data.notes || null, bizId, now
      );
    }
    return batchId;
  } catch (error) {
    console.error('Insert order error:', error);
    return null;
  }
};

export const getOrders = (statusFilter?: string) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    let whereClause = `WHERE s.paymentStatus IN ('Order', 'Sale', 'Debt', 'Cancelled') AND s.businessId = '${bizId}'`;
    if (statusFilter) {
      whereClause = `WHERE s.paymentStatus = '${statusFilter}' AND s.businessId = '${bizId}'`;
    }

    const rows = database.getAllSync(`
      SELECT
        s.batchId,
        s.orderNumber,
        s.paymentStatus as status,
        s.customerName,
        s.customerPhone,
        s.notes,
        s.createdAt,
        s.convertedAt,
        s.cancelledAt,
        COALESCE(SUM(s.totalPrice), 0) as totalPrice,
        COUNT(*) as itemCount,
        GROUP_CONCAT(s.id) as saleIds,
        GROUP_CONCAT(COALESCE(i.name, 'Unknown')) as itemNames,
        GROUP_CONCAT(s.quantity) as quantities,
        GROUP_CONCAT(s.unit) as units,
        MIN(s.id) as firstId
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      ${whereClause}
      GROUP BY s.batchId
      ORDER BY MAX(s.createdAt) DESC
    `);

    return rows.map((r: any) => {
      const saleIds = (r.saleIds || '').split(',').map(Number);
      const names = (r.itemNames || '').split(',');
      const qties = (r.quantities || '').split(',').map(Number);
      const unitList = (r.units || '').split(',');

      const items = saleIds.map((id: number, idx: number) => ({
        id,
        itemName: names[idx] || 'Unknown',
        quantity: qties[idx] || 0,
        unit: unitList[idx] || 'pcs',
        price: 0,
        totalPrice: 0,
      }));

      return {
        id: r.firstId,
        batchId: r.batchId,
        orderNumber: r.orderNumber,
        status: r.status,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        notes: r.notes,
        totalPrice: r.totalPrice,
        itemCount: r.itemCount,
        items,
        createdAt: r.createdAt,
        convertedAt: r.convertedAt,
        cancelledAt: r.cancelledAt,
      };
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return [];
  }
};

export const getOrderSummary = () => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const active = database.getFirstSync<{ count: number }>(
      `SELECT COUNT(DISTINCT batchId) as count FROM sales WHERE paymentStatus = 'Order' AND businessId = ?`, [bizId]
    );
    const converted = database.getFirstSync<{ count: number }>(
      `SELECT COUNT(DISTINCT batchId) as count FROM sales WHERE paymentStatus IN ('Sale', 'Debt') AND businessId = ?`, [bizId]
    );
    const cancelled = database.getFirstSync<{ count: number }>(
      `SELECT COUNT(DISTINCT batchId) as count FROM sales WHERE paymentStatus = 'Cancelled' AND businessId = ?`, [bizId]
    );
    return {
      active: active?.count || 0,
      converted: converted?.count || 0,
      cancelled: cancelled?.count || 0,
    };
  } catch (error) {
    console.error('Get order summary error:', error);
    return null;
  }
};

export const getOrderById = (id: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return null;
    const first = database.getFirstSync(`
      SELECT s.*, i.name as itemName
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
      WHERE s.id = ? AND s.businessId = ?
    `, [id, bizId]);
    if (!first) return null;

    const bId = (first as any).batchId;
    let items: any[];
    if (bId) {
      items = database.getAllSync(`
        SELECT s.id, s.quantity, s.unit, s.unitType, s.totalPrice, s.discount, s.vat,
               COALESCE(i.name, 'Unknown') as itemName
        FROM sales s
        LEFT JOIN items i ON s.itemId = i.id AND i.businessId = s.businessId
        WHERE s.batchId = ? AND s.businessId = ?
        ORDER BY s.id ASC
      `, [bId, bizId]);
    } else {
      items = [{
        id: (first as any).id,
        quantity: (first as any).quantity,
        unit: (first as any).unit,
        unitType: (first as any).unitType,
        totalPrice: (first as any).totalPrice,
        discount: (first as any).discount,
        vat: (first as any).vat,
        itemName: (first as any).itemName,
      }];
    }

    return {
      id: (first as any).id,
      batchId: bId,
      orderNumber: (first as any).orderNumber,
      status: (first as any).paymentStatus,
      customerName: (first as any).customerName,
      customerPhone: (first as any).customerPhone,
      notes: (first as any).notes,
      totalPrice: items.reduce((sum: number, it: any) => sum + (it.totalPrice || 0), 0),
      items: items.map((it: any) => ({
        id: it.id,
        itemName: it.itemName,
        quantity: it.quantity,
        unit: it.unit,
        price: it.totalPrice / (it.quantity || 1),
        totalPrice: it.totalPrice,
      })),
      createdAt: (first as any).createdAt,
      convertedAt: (first as any).convertedAt,
      cancelledAt: (first as any).cancelledAt,
    };
  } catch (error) {
    console.error('Get order by ID error:', error);
    return null;
  }
};

export const convertOrderToSale = (idOrBatchId: number | string): { success: boolean; error?: string } => {
  const database = getDB();
  const bizId = getScopedBusinessId();
  if (bizId == null) return { success: false, error: 'Order not found' };
  beginTransaction(database);
  try {
    let order: any;
    let targetBatchId: string | null;

    if (typeof idOrBatchId === 'string') {
      targetBatchId = idOrBatchId;
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE batchId = ? AND paymentStatus = ? AND businessId = ? LIMIT 1', [targetBatchId, 'Order', bizId]);
    } else {
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE id = ? AND businessId = ?', [idOrBatchId, bizId]);
      targetBatchId = order?.batchId || null;
    }
    if (!order) {
      rollbackTransaction(database);
      return { success: false, error: 'Order not found' };
    }
    if (order.paymentStatus !== 'Order') {
      rollbackTransaction(database);
      return { success: false, error: 'Order is not active' };
    }

    const now = new Date().toISOString();
    if (targetBatchId) {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Paid', convertedAt = ? WHERE batchId = ? AND paymentStatus = 'Order' AND businessId = ?`,
        [now, targetBatchId, bizId]
      );
      const items = database.getAllSync<any>('SELECT * FROM sales WHERE batchId = ? AND businessId = ?', [targetBatchId, bizId]);
      for (const item of items) {
        const invItem = database.getFirstSync<any>('SELECT * FROM items WHERE id = ? AND businessId = ?', [item.itemId, bizId]);
        if (invItem) {
          let baseQty = item.quantity;
          let packQty = 0;
          if (item.unitType === 'pack' && invItem.unitsPerPack) {
            baseQty = item.quantity * invItem.unitsPerPack;
            packQty = item.quantity;
          }
          database.runSync(
            'UPDATE items SET totalBaseQuantity = totalBaseQuantity - ?, totalPackQuantity = totalPackQuantity - ? WHERE id = ? AND businessId = ?',
            [baseQty, packQty, item.itemId, bizId]
          );
        }
      }
    } else {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Paid', convertedAt = ? WHERE id = ? AND businessId = ?`,
        [now, order.id, bizId]
      );
      const invItem = database.getFirstSync<any>('SELECT * FROM items WHERE id = ? AND businessId = ?', [order.itemId, bizId]);
      if (invItem) {
        let baseQty = order.quantity;
        let packQty = 0;
        if (order.unitType === 'pack' && invItem.unitsPerPack) {
          baseQty = order.quantity * invItem.unitsPerPack;
          packQty = order.quantity;
        }
        database.runSync(
          'UPDATE items SET totalBaseQuantity = totalBaseQuantity - ?, totalPackQuantity = totalPackQuantity - ? WHERE id = ? AND businessId = ?',
          [baseQty, packQty, order.itemId, bizId]
        );
      }
    }

    commitTransaction(database);
    return { success: true };
  } catch (error) {
    rollbackTransaction(database);
    console.error('Convert order to sale error:', error);
    return { success: false, error: String(error) };
  }
};

export const convertOrderToDebt = (idOrBatchId: number | string): { success: boolean; error?: string } => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return { success: false, error: 'Order not found' };
    let order: any;
    let targetBatchId: string | null;

    if (typeof idOrBatchId === 'string') {
      targetBatchId = idOrBatchId;
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE batchId = ? AND paymentStatus = ? AND businessId = ? LIMIT 1', [targetBatchId, 'Order', bizId]);
    } else {
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE id = ? AND businessId = ?', [idOrBatchId, bizId]);
      targetBatchId = order?.batchId || null;
    }
    if (!order) return { success: false, error: 'Order not found' };
    if (order.paymentStatus !== 'Order') return { success: false, error: 'Order is not active' };

    const now = new Date().toISOString();
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (targetBatchId) {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Debt', convertedAt = ?, dueDate = ? WHERE batchId = ? AND paymentStatus = 'Order' AND businessId = ?`,
        [now, dueDate, targetBatchId, bizId]
      );
    } else {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Debt', convertedAt = ?, dueDate = ? WHERE id = ? AND businessId = ?`,
        [now, dueDate, order.id, bizId]
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Convert order to debt error:', error);
    return { success: false, error: String(error) };
  }
};

export const cancelOrder = (idOrBatchId: number | string): { success: boolean; error?: string } => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return { success: false, error: 'Order not found' };
    let order: any;
    let targetBatchId: string | null;

    if (typeof idOrBatchId === 'string') {
      targetBatchId = idOrBatchId;
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE batchId = ? AND paymentStatus = ? AND businessId = ? LIMIT 1', [targetBatchId, 'Order', bizId]);
    } else {
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE id = ? AND businessId = ?', [idOrBatchId, bizId]);
      targetBatchId = order?.batchId || null;
    }
    if (!order) return { success: false, error: 'Order not found' };
    if (order.paymentStatus !== 'Order') return { success: false, error: 'Order is not active' };

    const now = new Date().toISOString();
    if (targetBatchId) {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Cancelled', cancelledAt = ? WHERE batchId = ? AND paymentStatus = 'Order' AND businessId = ?`,
        [now, targetBatchId, bizId]
      );
    } else {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Cancelled', cancelledAt = ? WHERE id = ? AND businessId = ?`,
        [now, order.id, bizId]
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Cancel order error:', error);
    return { success: false, error: String(error) };
  }
};

export const getLatestItemsByPeriod = (period: 'today' | 'yesterday' | 'date' | 'week' | 'month' | 'year', targetDate?: string, offset?: number) => {
  try {
    const database = getDB();
    const bizId = getScopedBusinessId();
    if (bizId == null) return [];
    const now = new Date();
    let params: any[] = [];
    let query = '';

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%H:%M', items.createdAt) as timeStr FROM items LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId WHERE date(items.createdAt) = ? AND items.businessId = ? ORDER BY items.createdAt DESC`;
      params = [todayStr, bizId];
    } else if (period === 'yesterday') {
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%H:%M', items.createdAt) as timeStr FROM items LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId WHERE date(items.createdAt) = ? AND items.businessId = ? ORDER BY items.createdAt DESC`;
      params = [yesterdayStr, bizId];
    } else if (period === 'date') {
      const dateStr = targetDate || now.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%H:%M', items.createdAt) as timeStr FROM items LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId WHERE date(items.createdAt) = ? AND items.businessId = ? ORDER BY items.createdAt DESC`;
      params = [dateStr, bizId];
    } else if (period === 'week') {
      const safeOffset = offset || 0;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (safeOffset * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%w', items.createdAt) as dayOfWeek, strftime('%Y-%m-%d', items.createdAt) as dateStr FROM items LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId WHERE date(items.createdAt) >= ? AND date(items.createdAt) <= ? AND items.businessId = ? ORDER BY items.createdAt DESC`;
      params = [startStr, endStr, bizId];
    } else if (period === 'month') {
      const monthOffset = offset || 0;
      const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const y = monthDate.getFullYear();
      const m = String(monthDate.getMonth() + 1).padStart(2, '0');
      query = `SELECT items.*, categories.name as categoryName, ((CAST(strftime('%d', items.createdAt) AS INTEGER) - 1) / 7 + 1) as weekNum, strftime('%Y-%m-%d', items.createdAt) as dateStr FROM items LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId WHERE strftime('%m', items.createdAt) = ? AND strftime('%Y', items.createdAt) = ? AND items.businessId = ? ORDER BY items.createdAt`;
      params = [m, y, bizId];
    } else if (period === 'year') {
      const yearOffset = offset || 0;
      const yearDate = new Date(now.getFullYear() + yearOffset, 0, 1);
      const yearStr = yearDate.getFullYear().toString();
      query = `SELECT items.*, categories.name as categoryName, CAST(strftime('%m', items.createdAt) AS INTEGER) as monthNum, strftime('%Y-%m-%d', items.createdAt) as dateStr FROM items LEFT JOIN categories ON items.categoryId = categories.id AND categories.businessId = items.businessId WHERE strftime('%Y', items.createdAt) = ? AND items.businessId = ? ORDER BY items.createdAt`;
      params = [yearStr, bizId];
    }

    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get latest items by period error:', error);
    return [];
  }
};

// â†’â†’ Subscription Functions â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’â†’

export interface SubscriptionData {
  id: number;
  plan: string;
  status: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  durationMonths: number;
  price: number | null;
  currency: string;
  startedAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getSubscription = (): SubscriptionData | null => {
  try {
    const database = getDB();
    return database.getFirstSync<SubscriptionData>('SELECT * FROM subscriptions ORDER BY id DESC LIMIT 1');
  } catch (error) {
    console.error('Get subscription error:', error);
    return null;
  }
};

const VALID_PLANS: Record<string, { months: number; price: number }[]> = {
  subscription: [
    { months: 1, price: 2499 },
    { months: 3, price: 5499 },
  ],
};

const isValidPlanPrice = (plan: string, durationMonths: number, price: number): boolean => {
  const planPrices = VALID_PLANS[plan];
  if (!planPrices) return false;
  return planPrices.some(p => p.months === durationMonths && p.price === price);
};

export const updateSubscriptionPlan = (plan: string, durationMonths: number, price: number): boolean => {
  try {
    if (!isValidPlanPrice(plan, durationMonths, price)) {
      console.error('Update subscription plan error: Invalid plan/price combination');
      return false;
    }
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
    database.runSync(
      `UPDATE subscriptions SET plan = ?, durationMonths = ?, price = ?, startedAt = datetime('now'), expiresAt = ?, status = 'pending_payment', updatedAt = datetime('now') WHERE id = ?`,
      [plan, durationMonths, price, expiresAt.toISOString(), sub.id]
    );
    logAudit(sub.id, 'plan_selected', sub.plan, plan);
    return true;
  } catch (error) {
    console.error('Update subscription plan error:', error);
    return false;
  }
};

export const verifySubscriptionPayment = (): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    database.runSync(
      "UPDATE subscriptions SET status = 'pending_verification', updatedAt = datetime('now') WHERE id = ?",
      [sub.id]
    );
    logAudit(sub.id, 'payment_submitted', sub.status, 'pending_verification');
    return true;
  } catch (error) {
    console.error('Verify subscription payment error:', error);
    return false;
  }
};

export const enablePremiumForTesting = (): boolean => {
  try {
    const database = getDB();
    const result = database.runSync(
      `UPDATE subscriptions SET plan = 'premium', status = 'active', expiresAt = NULL, trialEndsAt = NULL, updatedAt = datetime('now') WHERE id = (SELECT id FROM subscriptions LIMIT 1)`
    );
    if (result.changes === 0) {
      database.runSync(`INSERT INTO subscriptions (plan, status) VALUES ('premium', 'active')`);
    }
    console.log('Subscription set to premium/active for testing');
    return true;
  } catch (error) {
    console.error('Enable premium error:', error);
    return false;
  }
};

export const approveSubscription = (): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    database.runSync(
      "UPDATE subscriptions SET status = 'active', updatedAt = datetime('now') WHERE id = ?",
      [sub.id]
    );
    logAudit(sub.id, 'approved', sub.status, 'active');
    return true;
  } catch (error) {
    console.error('Approve subscription error:', error);
    return false;
  }
};

// Starts (or restarts) the local 7-day free trial. Grants a 7-day premium
// trial locally. Safe to call at any time â€” it resets an expired/cancelled
// subscription back to a fresh trial.
export const startFreeTrial = (): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    if (sub) {
      database.runSync(
        "UPDATE subscriptions SET plan = 'premium', status = 'trial', trialStartedAt = datetime('now'), trialEndsAt = ?, startedAt = datetime('now'), expiresAt = ?, durationMonths = 0, price = NULL, updatedAt = datetime('now') WHERE id = ?",
        [trialEnd.toISOString(), trialEnd.toISOString(), sub.id]
      );
      logAudit(sub.id, 'trial_started', sub.status, 'trial');
    } else {
      database.runSync(
        "INSERT INTO subscriptions (plan, status, trialStartedAt, trialEndsAt, startedAt, expiresAt, durationMonths) VALUES ('premium', 'trial', datetime('now'), ?, datetime('now'), ?, 0)",
        [trialEnd.toISOString(), trialEnd.toISOString()]
      );
    }
    return true;
  } catch (error) {
    console.error('Start free trial error:', error);
    return false;
  }
};

// Reconciles the local (offline) subscription row with an active subscription
// confirmed by the backend (admin-approved payment -> license). This unlocks
// the premium gate on-device without relying on the legacy local-only payment
// flow. Only ever upgrades the local state; never locks a paying user offline.
export const syncServerSubscription = (params: {
  plan: string | null;
  status: string;
  expiresAt: string | null;
}): boolean => {
  try {
    if (!params || params.status !== 'active') return false;
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    const localPlan =
      params.plan && params.plan.toLowerCase().includes('premium') ? 'premium' : 'basic';
    database.runSync(
      `UPDATE subscriptions
       SET plan = ?, status = 'active', expiresAt = ?,
           startedAt = COALESCE(startedAt, datetime('now')),
           updatedAt = datetime('now')
       WHERE id = ?`,
      [localPlan, params.expiresAt, sub.id]
    );
    database.runSync(
      `UPDATE subscription_payments
       SET status = 'verified', verifiedAt = datetime('now')
       WHERE subscriptionId = ? AND status = 'pending_verification'`,
      [sub.id]
    );
    logAudit(sub.id, 'synced_from_server', sub.status, 'active');
    return true;
  } catch (error) {
    console.error('Sync server subscription error:', error);
    return false;
  }
};

export const rejectSubscription = (): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    database.runSync(
      "UPDATE subscriptions SET status = 'rejected', updatedAt = datetime('now') WHERE id = ?",
      [sub.id]
    );
    logAudit(sub.id, 'rejected', sub.status, 'rejected');
    return true;
  } catch (error) {
    console.error('Reject subscription error:', error);
    return false;
  }
};

export const cancelSubscription = (): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    database.runSync(
      "UPDATE subscriptions SET status = 'cancelled', cancelledAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?",
      [sub.id]
    );
    logAudit(sub.id, 'cancelled', sub.status, 'cancelled');
    return true;
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return false;
  }
};

export const expireSubscription = (): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    database.runSync(
      "UPDATE subscriptions SET status = 'expired', plan = 'basic', updatedAt = datetime('now') WHERE id = ?",
      [sub.id]
    );
    logAudit(sub.id, 'expired', sub.status, 'expired');
    return true;
  } catch (error) {
    console.error('Expire subscription error:', error);
    return false;
  }
};

export const renewSubscription = (durationMonths: number, price: number): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    const previousExpiry = sub.expiresAt;
    const now = new Date();
    const newExpiry = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
    database.runSync(
      `UPDATE subscriptions SET status = 'renewing', durationMonths = ?, price = ?, expiresAt = ?, updatedAt = datetime('now') WHERE id = ?`,
      [durationMonths, price, newExpiry.toISOString(), sub.id]
    );
    database.runSync(
      `INSERT INTO subscription_renewals (subscriptionId, previousExpiry, newExpiry, plan, durationMonths, amount) VALUES (?, ?, ?, ?, ?, ?)`,
      [sub.id, previousExpiry, newExpiry.toISOString(), sub.plan, durationMonths, price]
    );
    logAudit(sub.id, 'renewal_initiated', `expiry:${previousExpiry}`, `expiry:${newExpiry.toISOString()}`);
    return true;
  } catch (error) {
    console.error('Renew subscription error:', error);
    return false;
  }
};

export const confirmRenewal = (): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    database.runSync(
      "UPDATE subscriptions SET status = 'active', updatedAt = datetime('now') WHERE id = ?",
      [sub.id]
    );
    logAudit(sub.id, 'renewal_confirmed', 'renewing', 'active');
    return true;
  } catch (error) {
    console.error('Confirm renewal error:', error);
    return false;
  }
};

export const insertSubscriptionPayment = (data: {
  transactionId: string;
  businessName: string;
  phoneNumber: string;
  planName: string;
  amount: number;
  paymentDate: string;
  notes?: string;
}): boolean => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return false;
    database.runSync(
      `INSERT INTO subscription_payments (subscriptionId, transactionId, businessName, phoneNumber, planName, amount, paymentDate, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification')`,
      [sub.id, data.transactionId, data.businessName, data.phoneNumber, data.planName, data.amount, data.paymentDate, data.notes || null]
    );
    logAudit(sub.id, 'payment_recorded', 'none', `txn:${data.transactionId}`);
    return true;
  } catch (error) {
    console.error('Insert subscription payment error:', error);
    return false;
  }
};

export const getSubscriptionPayments = () => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM subscription_payments ORDER BY createdAt DESC');
  } catch (error) {
    console.error('Get subscription payments error:', error);
    return [];
  }
};

export const getSubscriptionRenewals = () => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM subscription_renewals ORDER BY createdAt DESC');
  } catch (error) {
    console.error('Get subscription renewals error:', error);
    return [];
  }
};

export const getSubscriptionAuditLog = () => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM subscription_audit ORDER BY performedAt DESC');
  } catch (error) {
    console.error('Get subscription audit log error:', error);
    return [];
  }
};

const logAudit = (subscriptionId: number, action: string, oldValue: string, newValue: string) => {
  try {
    const database = getDB();
    database.runSync(
      `INSERT INTO subscription_audit (subscriptionId, action, oldValue, newValue) VALUES (?, ?, ?, ?)`,
      [subscriptionId, action, oldValue, newValue]
    );
  } catch (error) {
    console.error('Log audit error:', error);
  }
};

export const checkAndExpireSubscription = (): SubscriptionData | null => {
  try {
    const database = getDB();
    const sub = getSubscription();
    if (!sub) return null;
    if (sub.status === 'trial' && sub.trialEndsAt) {
      const trialEnd = new Date(sub.trialEndsAt);
      if (new Date() > trialEnd) {
        database.runSync(
          "UPDATE subscriptions SET status = 'expired', plan = 'basic', updatedAt = datetime('now') WHERE id = ?",
          [sub.id]
        );
        logAudit(sub.id, 'trial_ended', 'trial', 'expired');
        return { ...sub, status: 'expired', plan: 'basic' };
      }
    }
    if (sub.status === 'active' && sub.expiresAt) {
      const expiry = new Date(sub.expiresAt);
      if (new Date() > expiry) {
        database.runSync(
          "UPDATE subscriptions SET status = 'expired', plan = 'basic', updatedAt = datetime('now') WHERE id = ?",
          [sub.id]
        );
        logAudit(sub.id, 'subscription_expired', 'active', 'expired');
        return { ...sub, status: 'expired', plan: 'basic' };
      }
    }
    return sub;
  } catch (error) {
    console.error('Check and expire subscription error:', error);
    return null;
  }
};

export const getTrialDaysRemaining = (): number => {
  try {
    const sub = getSubscription();
    if (!sub || !sub.trialEndsAt) return 0;
    if (sub.status !== 'trial') return 0;
    const trialEnd = new Date(sub.trialEndsAt);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  } catch (error) {
    console.error('Get trial days remaining error:', error);
    return 0;
  }
};

const VALID_PREMIUM_FEATURES = new Set([
  'reports', 'dashboard_overview', 'pdf_download', 'csv_import', 'csv_export',
  'debt', 'orders', 'purchase_orders', 'multi_warehouse',
  'ai_assistant', 'health_score', 'biometrics', 'themes', 'supplier_reminders',
  'supplier_management',
]);

export const isPremiumFeatureUnlocked = (feature: string): boolean => {
  try {
    if (!VALID_PREMIUM_FEATURES.has(feature)) return false;
    const sub = checkAndExpireSubscription();
    if (!sub) return false;
    if (sub.status === 'trial') return true;
    if (sub.status !== 'active') return false;
    return sub.plan === 'premium' || sub.plan === 'subscription';
  } catch (error) {
    console.error('Is premium feature unlocked error:', error);
    return false;
  }
};
