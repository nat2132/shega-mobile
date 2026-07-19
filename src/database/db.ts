import { fromEthiopianToDate, getEthiopianDaysInMonth, toEthiopianDate } from '@/utils/date-utils';
import * as SQLite from 'expo-sqlite';

const GLOBAL_DB_KEY = '__shega_db';
const DB_NAME = 'shegabe.db';

let db: SQLite.SQLiteDatabase | null = null;
let dbReady = false;

const openDB = (useNew = false) => {
  const opened = SQLite.openDatabaseSync(DB_NAME, useNew ? { useNewConnection: true } : undefined);
  try { opened.execSync('ROLLBACK'); } catch {}
  opened.execSync('PRAGMA journal_mode=WAL');
  opened.execSync('PRAGMA busy_timeout=5000');
  return opened;
};

const recoverDB = () => {
  try { db?.closeSync(); } catch {}
  (globalThis as any)[GLOBAL_DB_KEY] = null;
  db = null;
  dbReady = false;

  try {
    SQLite.deleteDatabaseSync(DB_NAME);
    db = openDB();
    (globalThis as any)[GLOBAL_DB_KEY] = db;
    dbReady = true;
    return db;
  } catch {}

  try {
    db = openDB(true);
    (globalThis as any)[GLOBAL_DB_KEY] = db;
    dbReady = true;
    return db;
  } catch {}

  throw new Error('Cannot recover database - still locked after delete + reopen');
};

const getDBCached = (): SQLite.SQLiteDatabase => {
  const cached = (globalThis as any)[GLOBAL_DB_KEY];
  if (cached) {
    try {
      try { cached.execSync('ROLLBACK'); } catch {}
      cached.execSync('PRAGMA journal_mode=WAL');
      cached.execSync('PRAGMA busy_timeout=5000');
      return cached;
    } catch {
      try { cached.closeSync(); } catch {}
      (globalThis as any)[GLOBAL_DB_KEY] = null;
    }
  }
  try {
    db = openDB();
  } catch {
    return recoverDB();
  }
  (globalThis as any)[GLOBAL_DB_KEY] = db;
  return db;
};

export const getDB = () => {
  if (db && dbReady) {
    return db;
  }
  db = getDBCached();
  dbReady = true;
  return db;
};

export const resetDatabase = () => {
  try { db?.closeSync(); } catch {}
  db = null;
  dbReady = false;
  (globalThis as any)[GLOBAL_DB_KEY] = null;
  SQLite.deleteDatabaseSync(DB_NAME);
  db = getDB();
  return db;
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
    { name: 'allowSellByPackUnit', type: 'INTEGER', default: '0' }
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
        isCustom INTEGER NOT NULL DEFAULT 0
      );
    `);
    console.log('Table "categories" checked/created.');

    database.execSync(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        categoryId INTEGER,
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
        isCredit INTEGER,
        supplierPhone TEXT,
        supplierAccount TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
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
        FOREIGN KEY (itemId) REFERENCES items(id)
      );
    `);
    console.log('Table "item_packs" checked/created.');

    database.execSync(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        unitType TEXT NOT NULL,
        discount REAL DEFAULT 0,
        vat REAL DEFAULT 0,
        totalPrice REAL NOT NULL,
        paymentMethod TEXT,
        paymentStatus TEXT,
        customerName TEXT,
        customerPhone TEXT,
        packId INTEGER,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
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
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "debt_payments" checked/created.');

    database.execSync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT,
        date TEXT NOT NULL,
        isRecurring INTEGER DEFAULT 0,
        frequency TEXT,
        nextBillingDate TEXT,
        isOverdue INTEGER DEFAULT 0,
        overdueDays INTEGER DEFAULT 0,
        lastNotified TEXT,
        paymentStatus TEXT DEFAULT 'pending',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "expenses" checked/created.');

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
        date TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
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

    // Migration: Add supplierId to items table if not exists
    try {
      database.execSync(`ALTER TABLE items ADD COLUMN supplierId INTEGER REFERENCES contacts(id);`);
      console.log('Successfully migrated items table: Added supplierId');
    } catch {}

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

  // Migration: Add recurring expense tracking columns
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN isOverdue INTEGER DEFAULT 0;`);
    console.log('Successfully migrated expenses table: Added isOverdue');
  } catch {}
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN overdueDays INTEGER DEFAULT 0;`);
    console.log('Successfully migrated expenses table: Added overdueDays');
  } catch {}
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN lastNotified TEXT;`);
    console.log('Successfully migrated expenses table: Added lastNotified');
  } catch {}
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN paymentStatus TEXT DEFAULT 'pending';`);
    console.log('Successfully migrated expenses table: Added paymentStatus');
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

  // Indexes for fast querying
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_isread ON notifications(isRead);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_category ON notifications(category);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_groupkey ON notifications(groupKey);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(createdAt DESC);`);

  // →→ Budget tables →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  database.execSync(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'business' CHECK(type IN ('business','department','project','branch')),
      period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly','quarterly','yearly')),
      year INTEGER NOT NULL,
      month INTEGER,
      quarter INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','archived','closed')),
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Widen period CHECK to include daily/weekly (safe migration for existing tables)
  try { database.execSync(`ALTER TABLE budgets DROP CONSTRAINT IF EXISTS check_period`); } catch {}
  try { database.execSync(`ALTER TABLE budgets ADD CONSTRAINT check_period CHECK(period IN ('daily','weekly','monthly','quarterly','yearly'))`); } catch {}
  // SQLite workaround: recreate with looser constraint
  try {
    database.execSync(`PRAGMA foreign_keys=OFF`);
    database.execSync(`CREATE TABLE budgets_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'business',
      period TEXT NOT NULL DEFAULT 'monthly',
      year INTEGER NOT NULL,
      month INTEGER,
      quarter INTEGER,
      notes TEXT,
      status TEXT DEFAULT 'active',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    database.execSync(`INSERT INTO budgets_new SELECT * FROM budgets`);
    database.execSync(`DROP TABLE budgets`);
    database.execSync(`ALTER TABLE budgets_new RENAME TO budgets`);
    database.execSync(`PRAGMA foreign_keys=ON`);
  } catch { /* table already has wider constraint or first creation */ }
  console.log('Table "budgets" checked/created.');

  database.execSync(`
    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budgetId INTEGER NOT NULL,
      category TEXT NOT NULL,
      plannedAmount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budgetId) REFERENCES budgets(id) ON DELETE CASCADE
    );
  `);
  console.log('Table "budget_categories" checked/created.');

  database.execSync(`
    CREATE TABLE IF NOT EXISTS budget_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budgetCategoryId INTEGER NOT NULL,
      previousAmount REAL NOT NULL,
      newAmount REAL NOT NULL,
      reason TEXT NOT NULL,
      approvedBy TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budgetCategoryId) REFERENCES budget_categories(id) ON DELETE CASCADE
    );
  `);
  console.log('Table "budget_adjustments" checked/created.');

  // Budget indexes
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_budgets_type ON budgets(type);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(year, month);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_budget_cat_budget ON budget_categories(budgetId);`);

  // Migration: Add budgetCategoryId to expenses table
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN budgetCategoryId INTEGER REFERENCES budget_categories(id);`);
    console.log('Successfully migrated expenses table: Added budgetCategoryId');
  } catch {}

  // Create recurring_expense_templates table
  database.execSync(`
    CREATE TABLE IF NOT EXISTS recurring_expense_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL CHECK(frequency IN ('Daily','Weekly','Monthly','Quarterly','Yearly')),
      startDate TEXT NOT NULL,
      endDate TEXT,
      budgetCategoryId INTEGER,
      isActive INTEGER DEFAULT 1,
      lastIncurred TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budgetCategoryId) REFERENCES budget_categories(id) ON DELETE SET NULL
    );
  `);
  console.log('Table "recurring_expense_templates" checked/created.');

  // →→ Subscription tables →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
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

export const insertCategory = (name: string, icon: string, isCustom: boolean) => {
  try {
    const database = getDB();
    const statement = database.prepareSync('INSERT INTO categories (name, icon, isCustom) VALUES (?, ?, ?)');
    const result = statement.executeSync([name, icon, isCustom ? 1 : 0]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert category error:', error);
    return null;
  }
};

export const getCategories = () => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM categories');
  } catch (error) {
    console.error('Get categories error:', error);
    return [];
  }
};

export const getUserCategories = () => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM categories WHERE isCustom = 1');
  } catch (error) {
    console.error('Get user categories error:', error);
    return [];
  }
};

export const seedDefaultCategories = (categories: { name: string, icon: string }[]) => {
  try {
    const database = getDB();
    const existingCount = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories');

    if (existingCount && existingCount.count === 0) {
      const statement = database.prepareSync('INSERT INTO categories (name, icon, isCustom) VALUES (?, ?, 0)');
      for (const cat of categories) {
        statement.executeSync([cat.name, cat.icon]);
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
  supplierPhone: string | null;
  supplierAccount: string | null;
  supplierCallEnabled: boolean;
  lastPriceCheckAt: string | null;
  createdAt: string;
}

export interface InsertItemData {
  name: string;
  categoryId: number;
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
}

export const getNextItemId = () => {
  try {
    const database = getDB();
    const result = database.getFirstSync<{ maxId: number }>('SELECT MAX(id) as maxId FROM items');
    return (result?.maxId || 0) + 1;
  } catch (error) {
    console.error('Get next item ID error:', error);
    return 1;
  }
};

export const insertItem = (data: InsertItemData) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO items (name, categoryId, companyName, purchaseUnit, baseUnit, unitsPerPack, totalPackQuantity, totalBaseQuantity, packPurchasePrice, basePurchasePrice, baseSellingPrice, packSellingPrice, allowSellByBaseUnit, allowSellByPackUnit, expiryDate, qualityGrade, notes, isCredit, supplierPhone, supplierAccount, supplierCallEnabled, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      data.name, data.categoryId, data.companyName || null, data.purchaseUnit || 'pcs', data.baseUnit || 'pcs', data.unitsPerPack || 0, data.totalPackQuantity || 0, data.totalBaseQuantity || 0, data.packPurchasePrice || 0, data.basePurchasePrice || 0, data.baseSellingPrice || 0, data.packSellingPrice || 0, data.allowSellByBaseUnit ? 1 : 0, data.allowSellByPackUnit ? 1 : 0, data.expiryDate || null, data.qualityGrade || null, data.notes || null, data.isCredit ? 1 : 0, data.supplierPhone || null, data.supplierAccount || null, data.supplierCallEnabled ? 1 : 0, null
    ]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert item error:', error);
    return null;
  }
};

export const getItems = () => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id 
      ORDER BY items.id DESC
    `);
  } catch (error) {
    console.error('Get items error:', error);
    return [];
  }
};

export const getItemById = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync(`
      SELECT items.*, categories.name as categoryName
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE items.id = ?
    `, [id]);
  } catch (error) {
    console.error('Get item by ID error:', error);
    return null;
  }
};

// Returns items flagged with supplierCallEnabled that have had a price
// adjustment (price_up / price_down) within the last `days` days.
// Used by the weekly "should I call the supplier?" notification.
export const getItemsWithRecentPriceChanges = (days: number = 7) => {
  try {
    const database = getDB();
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
      INNER JOIN adjustments a ON a.itemId = i.id
      WHERE i.supplierCallEnabled = 1
        AND a.type IN ('price_up', 'price_down')
        AND date(a.createdAt) >= date('now', ?)
        AND a.id = (
          SELECT a2.id FROM adjustments a2
          WHERE a2.itemId = i.id
            AND a2.type IN ('price_up', 'price_down')
          ORDER BY a2.createdAt DESC
          LIMIT 1
        )
      ORDER BY a.createdAt DESC
    `, [`-${days} days`]);
  } catch (error) {
    console.error('getItemsWithRecentPriceChanges error:', error);
    return [];
  }
};

// Returns items that have supplierCallEnabled = 1 and either have
// no lastPriceCheckAt or it is older than `days` days — used to
// surface a weekly reminder even when no price change happened.
export const getItemsDueForSupplierCheck = (days: number = 7) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT id AS itemId, name AS itemName, companyName, supplierPhone, supplierAccount,
             baseSellingPrice AS currentPrice, lastPriceCheckAt
      FROM items
      WHERE supplierCallEnabled = 1
        AND (lastPriceCheckAt IS NULL OR date(lastPriceCheckAt) < date('now', ?))
      ORDER BY name ASC
    `, [`-${days} days`]);
  } catch (error) {
    console.error('getItemsDueForSupplierCheck error:', error);
    return [];
  }
};

export const getSaleById = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id 
      WHERE sales.id = ?
    `, [id]);
  } catch (error) {
    console.error('Get sale by ID error:', error);
    return null;
  }
};

export const getSaleWithItemsById = (id: number | string) => {
  try {
    const database = getDB();

    // If id is a string, it could be a batchId or a numeric ID cast to string
    if (typeof id === 'string') {
      // Try batchId first
      const items = database.getAllSync(`
        SELECT s.*, i.name as itemName, i.baseUnit
        FROM sales s
        LEFT JOIN items i ON s.itemId = i.id
        WHERE s.batchId = ?
        ORDER BY s.id ASC
      `, [id]);
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
          SELECT sales.*, items.name as itemName, items.baseUnit
          FROM sales
          LEFT JOIN items ON sales.itemId = items.id
          WHERE sales.id = ?
        `, [numId]);
        if (!single) return null;
        const bId = (single as any).batchId;
        if (!bId) return { ...single, isBatch: false };
        const batchItems = database.getAllSync(`
          SELECT s.*, i.name as itemName, i.baseUnit
          FROM sales s
          LEFT JOIN items i ON s.itemId = i.id
          WHERE s.batchId = ?
          ORDER BY s.id ASC
        `, [bId]);
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
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id 
      WHERE sales.id = ?
    `, [id]);
    if (!first) return null;

    const bId = (first as any).batchId;
    if (!bId) {
      return { ...first, isBatch: false };
    }

    const items = database.getAllSync(`
      SELECT s.*, i.name as itemName, i.baseUnit
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id
      WHERE s.batchId = ?
      ORDER BY s.id ASC
    `, [bId]);

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
    let query = `SELECT items.*, categories.name as categoryName FROM items LEFT JOIN categories ON items.categoryId = categories.id`;
    const params: any[] = [];
    const conditions: string[] = [];

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
}) => {
  try {
    const database = getDB();
    
    // Insert the sale record
    const statement = database.prepareSync(`
      INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, taxType, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, packId, batchId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.executeSync([
      saleData.itemId, saleData.quantity, saleData.unit, saleData.unitType,
      saleData.discount || 0, saleData.vat || 0, saleData.taxType || 'VAT', saleData.totalPrice,
      saleData.paymentMethod || null, saleData.paymentStatus || 'Paid',
      saleData.customerName || null, saleData.customerPhone || null,
      saleData.packId || null, saleData.batchId || null
    ]);

    // Update inventory quantities
    const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ?', [saleData.itemId]);
    let baseQty = saleData.quantity;
    let packQty = 0;
    
    if (saleData.unitType === 'pack' && item?.unitsPerPack) {
      baseQty = saleData.quantity * item.unitsPerPack;
      packQty = saleData.quantity;
    }

    database.execSync(`
      UPDATE items 
      SET totalBaseQuantity = totalBaseQuantity - ${baseQty},
          totalPackQuantity = totalPackQuantity - ${packQty}
      WHERE id = ${saleData.itemId}
    `);

    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert sale error:', error);
    return null;
  }
};

export const getSales = () => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id 
      WHERE paymentStatus != 'Order'
      ORDER BY sales.id DESC
    `);
  } catch (error) {
    console.error('Get sales error:', error);
    return [];
  }
};

export const getSalesByDateRange = (startDate: string, endDate: string) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id 
      WHERE date(sales.createdAt) >= ? AND date(sales.createdAt) <= ? AND paymentStatus != 'Order'
      ORDER BY sales.createdAt DESC
    `, [startDate, endDate]);
  } catch (error) {
    console.error('Get sales by date range error:', error);
    return [];
  }
};

export const getFilteredSales = (options: FilterOptions) => {
  try {
    const database = getDB();
    let query = `SELECT sales.*, items.name as itemName, items.baseUnit FROM sales LEFT JOIN items ON sales.itemId = items.id`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.search) {
      conditions.push('(items.name LIKE ? OR sales.customerName LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.category && options.category !== 'All') {
      conditions.push('items.name = ?');
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
  try {
    const database = getDB();
    
    // 1. Log the adjustment
    const statement = database.prepareSync(`
      INSERT INTO adjustments (itemId, type, oldValue, newValue, quantity, unitType, reason, date, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      adj.itemId, adj.type, adj.oldValue, adj.newValue, adj.quantity, adj.unitType, adj.reason, adj.date, adj.createdAt || null
    ]);

    // 2. Update the item based on adjustment type
    if (adj.type === 'price_up' || adj.type === 'price_down') {
      database.execSync(`
        UPDATE items 
        SET baseSellingPrice = ${adj.newValue} 
        WHERE id = ${adj.itemId}
      `);
      
      // Also update pack price proportionally if unitsPerPack exists
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [adj.itemId]) as any;
      if (item && item.unitsPerPack) {
        const newPackPrice = adj.newValue * item.unitsPerPack;
        database.execSync(`UPDATE items SET packSellingPrice = ${newPackPrice} WHERE id = ${adj.itemId}`);
      }
    } else if (adj.type === 'damaged') {
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [adj.itemId]) as any;
      if (item) {
        let baseDeduction = adj.quantity;
        let packDeduction = 0;

        if (adj.unitType === 'pack') {
          baseDeduction = adj.quantity * (item.unitsPerPack || 1);
          packDeduction = adj.quantity;
        } else {
          packDeduction = adj.quantity / (item.unitsPerPack || 1);
        }

        database.execSync(`
          UPDATE items 
          SET totalBaseQuantity = totalBaseQuantity - ${baseDeduction},
              totalPackQuantity = totalPackQuantity - ${packDeduction}
          WHERE id = ${adj.itemId}
        `);
      }
    }

    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert adjustment error:', error);
    return null;
  }
};

export const getRecentAdjustments = (type?: string, limit: number = 20) => {
  try {
    const database = getDB();
    let query = `
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.baseSellingPrice, items.packPurchasePrice
      FROM adjustments 
      LEFT JOIN items ON adjustments.itemId = items.id
    `;
    const params: any[] = [];
    
    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
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

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.baseSellingPrice, items.packPurchasePrice
      FROM adjustments
      LEFT JOIN items ON adjustments.itemId = items.id
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
    const adj = database.getFirstSync('SELECT * FROM adjustments WHERE id = ?', [id]) as any;
    if (!adj) return false;

    // Only restore items quantity if it was damaged
    if (adj.type === 'damaged') {
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [adj.itemId]) as any;
      if (item) {
        let baseRefund = adj.quantity;
        let packRefund = 0;
        if (adj.unitType === 'pack') {
          baseRefund = adj.quantity * (item.unitsPerPack || 1);
          packRefund = adj.quantity;
        } else {
          packRefund = adj.quantity / (item.unitsPerPack || 1);
        }
        database.execSync(`
          UPDATE items 
          SET totalBaseQuantity = totalBaseQuantity + ${baseRefund},
              totalPackQuantity = totalPackQuantity + ${packRefund}
          WHERE id = ${adj.itemId}
        `);
      }
    }
    
    // For price_up/price_down, reverting price is risky if new adjustments exist, so we only delete the log.
    database.runSync('DELETE FROM adjustments WHERE id = ?', id);
    return true;
  } catch (error) {
    console.error('Delete adjustment error:', error);
    return false;
  }
};

export const updateAdjustment = (adjId: number, data: { quantity?: number, newValue?: number, reason?: string }) => {
  try {
    const database = getDB();
    const existing = database.getFirstSync('SELECT * FROM adjustments WHERE id = ?', [adjId]) as any;
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
          const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [existing.itemId]) as any;
          if (item) {
            let baseDiff = diff;
            let packDiff = 0;
            if (existing.unitType === 'pack') {
              baseDiff = diff * (item.unitsPerPack || 1);
              packDiff = diff;
            } else {
              packDiff = diff / (item.unitsPerPack || 1);
            }
            database.execSync(`
              UPDATE items 
              SET totalBaseQuantity = totalBaseQuantity - ${baseDiff},
                  totalPackQuantity = totalPackQuantity - ${packDiff}
              WHERE id = ${existing.itemId}
            `);
          }
        }
      }
    }
    
    if (data.newValue !== undefined) {
      updates.push('newValue = ?');
      params.push(data.newValue);
      
      // Affect the current price
      if (existing.type === 'price_up' || existing.type === 'price_down') {
         database.execSync(`UPDATE items SET baseSellingPrice = ${data.newValue} WHERE id = ${existing.itemId}`);
         const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [existing.itemId]) as any;
         if (item && item.unitsPerPack) {
           const newPackPrice = data.newValue * item.unitsPerPack;
           database.execSync(`UPDATE items SET packSellingPrice = ${newPackPrice} WHERE id = ${existing.itemId}`);
         }
      }
    }

    if (data.reason !== undefined) {
      updates.push('reason = ?');
      params.push(data.reason);
    }

    if (updates.length > 0) {
      params.push(adjId);
      database.runSync(`UPDATE adjustments SET ${updates.join(', ')} WHERE id = ?`, ...params);
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
    const limit = options.limit || 50;

    // Build date condition
    const saleDateWhere = options.date ? "WHERE date(s.createdAt) = '" + options.date + "'" : '';
    const adjDateWhere = options.date ? "WHERE date(a.createdAt) = '" + options.date + "'" : '';
    const expDateWhere = options.date ? "WHERE date(e.date) = '" + options.date + "'" : '';
    const invDateWhere = options.date ? "WHERE date(i.createdAt) = '" + options.date + "'" : '';

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
            SELECT SUM(sub.totalPrice) FROM sales sub WHERE sub.batchId = s.batchId
          )
          ELSE s.totalPrice 
        END as value,
        CASE 
          WHEN s.batchId IS NOT NULL THEN (
            SELECT COUNT(*) FROM sales sub WHERE sub.batchId = s.batchId
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
            JOIN items i2 ON sub2.itemId = i2.id
            WHERE sub2.batchId = s.batchId
          )
          ELSE i.name 
        END as label,
        CASE 
          WHEN s.batchId IS NOT NULL THEN (
            SELECT MIN(sub3.createdAt) FROM sales sub3 WHERE sub3.batchId = s.batchId
          )
          ELSE s.createdAt 
        END as createdAt,
        s.discount,
        s.vat,
        s.batchId
      FROM sales s
      JOIN items i ON s.itemId = i.id
      ${saleDateWhere}
      GROUP BY COALESCE(s.batchId, CAST(s.id AS TEXT))
      ORDER BY createdAt DESC
      LIMIT ${limit}
    `);

    // Adjustments with type info
    const adjustments = database.getAllSync(`
      SELECT 'adjustment' as type, 'adjustment' as category, a.id, a.newValue as value, a.quantity, a.type as adjType, a.oldValue, COALESCE(i.name, 'Item') as label, a.createdAt, i.basePurchasePrice
      FROM adjustments a
      LEFT JOIN items i ON a.itemId = i.id
      ${adjDateWhere}
      ORDER BY a.createdAt DESC
      LIMIT ${limit}
    `);

    // Expenses
    const expenses = database.getAllSync(`
      SELECT 'expense' as type, 'expense' as category, e.id, e.amount as value, NULL as quantity, e.name as label, e.date as createdAt, e.category as expenseCategory, e.isRecurring
      FROM expenses e
      ${expDateWhere}
      ORDER BY e.date DESC
      LIMIT ${limit}
    `);

    // Inventory additions
    const inventory = database.getAllSync(`
      SELECT 'inventory' as type, 'inventory' as category, i.id, (i.totalBaseQuantity * i.basePurchasePrice) as value, i.totalBaseQuantity as quantity, i.name as label, i.createdAt, i.companyName
      FROM items i
      ${invDateWhere}
      ORDER BY i.createdAt DESC
      LIMIT ${limit}
    `);

    // Merge and sort by date
    const combined = [...sales, ...adjustments, ...expenses, ...inventory]
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

// --- Expense Functions ---

export const insertExpense = (expense: { name: string; amount: number; category: string; date?: string; isRecurring?: boolean; frequency?: string; nextBillingDate?: string; budgetCategoryId?: number }) => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
    const statement = database.prepareSync(`
      INSERT INTO expenses (name, amount, category, date, isRecurring, frequency, nextBillingDate, budgetCategoryId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      expense.name, expense.amount, expense.category || 'General', expense.date || today,
      expense.isRecurring ? 1 : 0, expense.frequency || null, expense.nextBillingDate || null,
      expense.budgetCategoryId || null, null
    ]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert expense error:', error);
    return null;
  }
};

export const getRecentExpenses = (limit: number = 10, targetDate?: string) => {
  try {
    const database = getDB();
    if (targetDate) {
      return database.getAllSync('SELECT * FROM expenses WHERE date(date) <= date(?) ORDER BY date DESC, createdAt DESC LIMIT ?', [targetDate, limit]);
    }
    return database.getAllSync('SELECT * FROM expenses ORDER BY date DESC, createdAt DESC LIMIT ?', [limit]);
  } catch (error) {
    console.error('Get recent expenses error:', error);
    return [];
  }
};

export const getTodaysExpenses = () => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
    return database.getAllSync('SELECT * FROM expenses WHERE date(date) = ? ORDER BY createdAt DESC', [today]);
  } catch (error) {
    console.error('Get todays expenses error:', error);
    return [];
  }
};


export const getFilteredExpenses = (options: FilterOptions) => {
  try {
    const database = getDB();
    let query = `SELECT * FROM expenses`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.search) {
      conditions.push('(name LIKE ? OR category LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.category && options.category !== 'All') {
      conditions.push('category = ?');
      params.push(options.category);
    }

    if (options.date) {
       conditions.push('date(date) = ?');
       params.push(options.date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    let orderBy = 'date DESC, createdAt DESC';
    if (options.sortBy === 'amount_desc' || options.sortBy === 'Highest Amount') orderBy = 'amount DESC';
    else if (options.sortBy === 'amount_asc' || options.sortBy === 'Lowest Amount') orderBy = 'amount ASC';
    else if (options.sortBy === 'name_asc' || options.sortBy === 'Name (A-Z)') orderBy = 'name ASC';

    query += ` ORDER BY ${orderBy}`;

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get filtered expenses error:', error);
    return [];
  }
};

export const getUpcomingExpenses = () => {
  try {
    const database = getDB();
    const now = new Date().toISOString().split('T')[0];
    return database.getAllSync(`
      SELECT * FROM expenses 
      WHERE isRecurring = 1 AND nextBillingDate >= ?
      ORDER BY nextBillingDate ASC
    `, [now]);
  } catch (error) {
    console.error('Get upcoming expenses error:', error);
    return [];
  }
};

// →→ Recurring Expense Reminder Functions →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const getRecurringExpensesDueToday = () => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
    return database.getAllSync(`
      SELECT * FROM expenses 
      WHERE isRecurring = 1 
        AND nextBillingDate <= ? 
        AND paymentStatus != 'paid'
      ORDER BY nextBillingDate ASC
    `, [today]);
  } catch (error) {
    console.error('getRecurringExpensesDueToday error:', error);
    return [];
  }
};

export const getOverdueExpenses = () => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT * FROM expenses 
      WHERE isOverdue = 1 AND paymentStatus = 'overdue'
      ORDER BY overdueDays DESC
    `);
  } catch (error) {
    console.error('getOverdueExpenses error:', error);
    return [];
  }
};

export const getRecurringExpensesForDashboard = () => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
    
    const dueToday = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM expenses 
      WHERE isRecurring = 1 AND nextBillingDate <= ? AND paymentStatus != 'paid'
    `, [today]);

    const overdue = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM expenses 
      WHERE isOverdue = 1 AND paymentStatus = 'overdue'
    `);

    return {
      dueTodayCount: dueToday?.count || 0,
      overdueCount: overdue?.count || 0
    };
  } catch (error) {
    console.error('getRecurringExpensesForDashboard error:', error);
    return { dueTodayCount: 0, overdueCount: 0 };
  }
};

export const getRecurringExpensesDueTomorrow = () => {
  try {
    const database = getDB();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    return database.getAllSync(`
      SELECT * FROM expenses
      WHERE isRecurring = 1
        AND nextBillingDate > ? AND nextBillingDate <= ?
        AND paymentStatus != 'paid'
      ORDER BY nextBillingDate ASC
    `, [todayStr, tomorrowStr]);
  } catch (error) {
    console.error('getRecurringExpensesDueTomorrow error:', error);
    return [];
  }
};

export const getUpcomingRecurringExpenses = (limit: number = 5) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT * FROM expenses 
      WHERE isRecurring = 1 
      ORDER BY nextBillingDate ASC 
      LIMIT ?
    `, [limit]);
  } catch (error) {
    console.error('getUpcomingRecurringExpenses error:', error);
    return [];
  }
};

export const markRecurringAsPaid = (id: number) => {
  try {
    const database = getDB();
    const expense = database.getFirstSync<any>('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!expense) return false;

    if (expense.isRecurring) {
      // Calculate next billing date based on frequency
      const currentDate = new Date(expense.nextBillingDate || expense.date);
      let newDate = new Date(currentDate);
      
      if (expense.frequency === 'Daily') {
        newDate.setDate(newDate.getDate() + 1);
      } else if (expense.frequency === 'Weekly') {
        newDate.setDate(newDate.getDate() + 7);
      } else if (expense.frequency === 'Monthly') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (expense.frequency === 'Yearly') {
        newDate.setFullYear(newDate.getFullYear() + 1);
      }

      const nextBilling = newDate.toISOString().split('T')[0];

      database.runSync(`
        UPDATE expenses 
        SET paymentStatus = 'paid', 
            isOverdue = 0, 
            overdueDays = 0, 
            nextBillingDate = ?,
            lastNotified = NULL
        WHERE id = ?
      `, [nextBilling, id]);
    } else {
      database.runSync(`
        UPDATE expenses 
        SET paymentStatus = 'paid', 
            isOverdue = 0, 
            overdueDays = 0, 
            lastNotified = NULL
        WHERE id = ?
      `, [id]);
    }
    return true;
  } catch (error) {
    console.error('markRecurringAsPaid error:', error);
    return false;
  }
};

export const markRecurringAsOverdue = (id: number) => {
  try {
    const database = getDB();
    const expense = database.getFirstSync<any>('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!expense) return false;

    const dueDate = new Date(expense.nextBillingDate || expense.date);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
    const overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    database.runSync(`
      UPDATE expenses 
      SET isOverdue = 1, 
          overdueDays = ?, 
          paymentStatus = 'overdue',
          lastNotified = ?
      WHERE id = ?
    `, [overdueDays, new Date().toISOString().split('T')[0], id]);
    return true;
  } catch (error) {
    console.error('markRecurringAsOverdue error:', error);
    return false;
  }
};

export const updateLastNotified = (id: number) => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
    database.runSync('UPDATE expenses SET lastNotified = ? WHERE id = ?', [today, id]);
    return true;
  } catch (error) {
    console.error('updateLastNotified error:', error);
    return false;
  }
};

export const shouldSendReminder = (id: number): boolean => {
  try {
    const database = getDB();
    const expense = database.getFirstSync<any>('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!expense) return false;

    // If no notification sent yet, should send
    if (!expense.lastNotified) return true;

    const lastNotified = new Date(expense.lastNotified);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - lastNotified.getTime()) / (1000 * 60 * 60 * 24));
    
    // Send reminder every 7 days
    return diffDays >= 7;
  } catch (error) {
    console.error('shouldSendReminder error:', error);
    return false;
  }
};

export const getMonthlyExpenseTotal = () => {
  try {
    const database = getDB();
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const result = database.getFirstSync<{ total: number }>(`
      SELECT SUM(amount) as total FROM expenses 
      WHERE date >= ?
    `, [firstDay]);
    return result?.total || 0;
  } catch (error) {
    console.error('Get monthly expense total error:', error);
    return 0;
  }
};

export const getSalesSummary = () => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
    
    // Total sales revenue and count today
    const salesToday = database.getFirstSync<{ total: number, count: number }>(`
      SELECT SUM(totalPrice) as total, COUNT(*) as count FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order'
    `, [today]);

    // Total returns refund today
    const returnsToday = database.getFirstSync<{ total: number }>(`
      SELECT SUM(totalRefund) as total FROM returns WHERE date(createdAt) = ?
    `, [today]);

    // Total volume (units) today
    const totalUnits = database.getFirstSync<{ volume: number }>(`
      SELECT SUM(quantity) as volume FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order'
    `, [today]);

    // Total returned quantity today
    const returnedQty = database.getFirstSync<{ qty: number }>(`
      SELECT SUM(CASE WHEN itemCondition = 'Resellable' THEN quantity ELSE 0 END) as qty FROM returns WHERE date(createdAt) = ?
    `, [today]);

    // Best hour of the day
    const bestHour = database.getFirstSync<{ hour: string }>(`
      SELECT strftime('%H', datetime(createdAt, 'localtime')) as hour, COUNT(*) as count 
      FROM sales 
      WHERE paymentStatus != 'Order'
      GROUP BY hour 
      ORDER BY count DESC 
      LIMIT 1
    `);

    // Payment method distribution
    const paymentDist = database.getAllSync<{ method: string, count: number }>(`
      SELECT paymentMethod as method, COUNT(*) as count 
      FROM sales 
      WHERE paymentStatus != 'Order'
      GROUP BY method
    `);

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
    const today = new Date().toISOString().split('T')[0];
    const results = database.getAllSync(`
      SELECT items.*,
        SUM(sales.quantity) - COALESCE(r.returnedQty, 0) as totalQty,
        SUM(sales.totalPrice) - COALESCE(r.returnedRefund, 0) as totalRevenue,
        categories.name as categoryName
      FROM sales
      JOIN items ON sales.itemId = items.id
      LEFT JOIN (
        SELECT itemId, SUM(quantity) as returnedQty, SUM(totalRefund) as returnedRefund
        FROM returns
        WHERE date(createdAt) = ?
        GROUP BY itemId
      ) r ON items.id = r.itemId
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE date(sales.createdAt) = ? AND paymentStatus != 'Order'
      GROUP BY items.id
      ORDER BY totalQty DESC
      LIMIT ?
    `, [today, today, limit]);
    return results;
  } catch (error) {
    console.error('Get top selling items error:', error);
    return [];
  }
};

export const getSlowMovingItems = (limit: number = 5) => {
  try {
    const database = getDB();
    const results = database.getAllSync(`
      SELECT items.*, COALESCE(SUM(sales.quantity), 0) as totalQty, categories.name as categoryName
      FROM items
      LEFT JOIN sales ON items.id = sales.itemId AND sales.createdAt >= date('now', '-30 days')
      LEFT JOIN categories ON items.categoryId = categories.id
      GROUP BY items.id
      ORDER BY totalQty ASC
      LIMIT ?
    `, [limit]);
    return results;
  } catch (error) {
    console.error('Get slow moving items error:', error);
    return [];
  }
};

export const getExpiringItems = (days: number = 30) => {
  try {
    const database = getDB();
    const expiryLimit = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    const results = database.getAllSync(`
      SELECT items.*, categories.name as categoryName
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE expiryDate IS NOT NULL AND expiryDate <= ? AND expiryDate >= date('now')
      ORDER BY expiryDate ASC
    `, [expiryLimit]);
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
    const today = targetDate || new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(new Date(today + 'T00:00:00').getTime() - 86400000);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    // Today's Stats
    const todaySales = database.getFirstSync<{ revenue: number, count: number }>(`
      SELECT SUM(totalPrice) as revenue, COUNT(*) as count FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order' AND totalPrice >= 0
    `, [today]);

    const todayExpenses = database.getFirstSync<{ total: number }>(`
      SELECT SUM(amount) as total FROM expenses WHERE date(date) = ?
    `, [today]);

    const todayDebt = database.getFirstSync<{ total: number }>(`
      SELECT SUM(totalPrice) as total FROM sales WHERE date(createdAt) = ? AND paymentStatus = 'Debt' AND paymentStatus != 'Order'
    `, [today]);

    const todayReturns = database.getFirstSync<{ totalRefund: number }>(`
      SELECT COALESCE(SUM(totalRefund), 0) as totalRefund FROM returns WHERE date(createdAt) = ?
    `, [today]);

    // Yesterday's Stats for comparison
    const yesterdaySales = database.getFirstSync<{ revenue: number, count: number }>(`
      SELECT SUM(totalPrice) as revenue, COUNT(*) as count FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order' AND totalPrice >= 0
    `, [yesterday]);

    const yesterdayExpenses = database.getFirstSync<{ total: number }>(`
      SELECT SUM(amount) as total FROM expenses WHERE date(date) = ?
    `, [yesterday]);

    const yesterdayProfitData = database.getFirstSync<{ gross: number }>(`
      SELECT SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))) as gross
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) = ? AND paymentStatus != 'Order' AND s.totalPrice >= 0
    `, [yesterday]);

    const yesterdayReturns = database.getFirstSync<{ totalRefund: number }>(`
      SELECT COALESCE(SUM(totalRefund), 0) as totalRefund FROM returns WHERE date(createdAt) = ?
    `, [yesterday]);

    // Profit Calculation (Today) - EXCLUDING debt (not realized until paid)
    const profitData = database.getFirstSync<{ gross: number }>(`
      SELECT SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))) as gross
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) = ? AND s.paymentStatus != 'Debt' AND s.paymentStatus != 'Order' AND s.totalPrice >= 0
    `, [today]);

    const todayNetSales = (todaySales?.revenue || 0) - (todayReturns?.totalRefund || 0);
    const yesterdayNetSales = (yesterdaySales?.revenue || 0) - (yesterdayReturns?.totalRefund || 0);

    return {
      today: {
        revenue: todayNetSales,
        salesCount: todaySales?.count || 0,
        expenses: todayExpenses?.total || 0,
        debt: todayDebt?.total || 0,
        grossProfit: (profitData?.gross || 0) - (todayReturns?.totalRefund || 0),
        returns: todayReturns?.totalRefund || 0,
      },
      yesterday: {
        revenue: yesterdayNetSales,
        salesCount: yesterdaySales?.count || 0,
        expenses: yesterdayExpenses?.total || 0,
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
    
    // Build queries dynamically based on warehouseId
    let totalsQuery = `SELECT SUM(totalBaseQuantity * basePurchasePrice) as value, COUNT(*) as count FROM items`;
    let lowStockQuery = `SELECT COUNT(*) as count FROM items WHERE totalBaseQuantity < 10`;
    let highValueQuery = `SELECT name, (totalBaseQuantity * basePurchasePrice) as value FROM items`;
    let categoriesQuery = `
      SELECT c.name, COUNT(i.id) as count, SUM(i.totalBaseQuantity * i.basePurchasePrice) as value
      FROM categories c
      JOIN items i ON i.categoryId = c.id
    `;
    
    const params: any[] = [];
    if (warehouseId) {
      totalsQuery += ` WHERE warehouseId = ?`;
      lowStockQuery += ` AND warehouseId = ?`;
      highValueQuery += ` WHERE warehouseId = ?`;
      categoriesQuery += ` WHERE i.warehouseId = ?`;
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

export const getExpenseHealth = () => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];

    // Total expenses
    const totalExpenses = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM expenses
    `);

    // Overdue or due expenses (problematic)
    const problematicExpenses = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM expenses 
      WHERE (isOverdue = 1 AND paymentStatus = 'overdue')
         OR (isRecurring = 1 AND nextBillingDate <= ? AND paymentStatus != 'paid')
    `, [today]);

    const totalCount = totalExpenses?.count || 0;
    const problemCount = problematicExpenses?.count || 0;
    const health = totalCount > 0 ? Math.round(((totalCount - problemCount) / totalCount) * 100) : 100;

    return {
      totalCount,
      problemCount,
      expenseHealth: health,
      hasIssues: problemCount > 0
    };
  } catch (error) {
    console.error('getExpenseHealth error:', error);
    return { totalCount: 0, problemCount: 0, expenseHealth: 100, hasIssues: false };
  }
};

export const getInventoryStats = (warehouseId?: number | null) => {
  try {
    const database = getDB();
    
    let totalValueQuery = `SELECT SUM(totalBaseQuantity * basePurchasePrice) as value FROM items`;
    let lowStockQuery = `SELECT COUNT(*) as count FROM items WHERE totalBaseQuantity < 10`;
    let categoriesQuery = `
      SELECT c.name, COUNT(i.id) as count 
      FROM categories c
      JOIN items i ON i.categoryId = c.id
    `;
    
    const params: any[] = [];
    if (warehouseId) {
      totalValueQuery += ` WHERE warehouseId = ?`;
      lowStockQuery += ` AND warehouseId = ?`;
      categoriesQuery += ` WHERE i.warehouseId = ?`;
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
      movingQuery += ` JOIN items ON sales.itemId = items.id WHERE items.warehouseId = ? AND sales.createdAt >= date('now', '-30 days')`;
      movingParams.push(warehouseId);
    } else {
      movingQuery += ` WHERE sales.createdAt >= date('now', '-30 days')`;
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
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE totalBaseQuantity < 10
      ORDER BY totalBaseQuantity ASC
    `);
  } catch (error) {
    console.error('Get low stock items error:', error);
    return [];
  }
};

export const getDebtCustomers = () => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT 
        customerName, 
        customerPhone, 
        SUM(totalPrice - paidAmount) as oweAmount,
        MAX(createdAt) as lastBorrowed,
        MIN(dueDate) as earliestDue,
        COUNT(*) as totalDebts
      FROM sales 
      WHERE paymentStatus = 'Debt'
      GROUP BY customerName, customerPhone
      ORDER BY oweAmount DESC
    `);
  } catch (error) {
    console.error('Get debt customers error:', error);
    return [];
  }
};

export const getDebtSales = (customerName?: string) => {
  try {
    const database = getDB();
    let query = `
      SELECT sales.*, items.name as itemName, items.baseUnit
      FROM sales
      LEFT JOIN items ON sales.itemId = items.id
      WHERE (paymentStatus = 'Debt' OR (paymentStatus = 'Paid' AND totalPrice > paidAmount))
    `;
    const params: any[] = [];
    if (customerName) {
      query += ' AND customerName = ?';
      params.push(customerName);
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
    const method = options?.paymentMethod || null;
    if (type === 'full') {
      if (method) {
        database.runSync(
          "UPDATE sales SET paymentStatus = 'Paid', paidAmount = totalPrice, paymentMethod = ? WHERE customerName = ? AND paymentStatus = 'Debt'",
          [method, customerName]
        );
      } else {
        database.runSync(
          "UPDATE sales SET paymentStatus = 'Paid', paidAmount = totalPrice WHERE customerName = ? AND paymentStatus = 'Debt'",
          [customerName]
        );
      }
    } else {
      // Partial payment logic: distribute across sales
      const sales = database.getAllSync<{id: number, totalPrice: number, paidAmount: number}>(
        "SELECT id, totalPrice, paidAmount FROM sales WHERE customerName = ? AND paymentStatus = 'Debt' ORDER BY createdAt ASC",
        [customerName]
      );

      let remaining = amount;
      for (const sale of sales) {
        if (remaining <= 0) break;
        const outstanding = sale.totalPrice - (sale.paidAmount || 0);
        const apply = Math.min(remaining, outstanding);
        const newPaid = (sale.paidAmount || 0) + apply;
        const newStatus = newPaid >= sale.totalPrice ? 'Paid' : 'Debt';

        database.runSync(
          "UPDATE sales SET paidAmount = ?, paymentStatus = ? WHERE id = ?",
          [newPaid, newStatus, sale.id]
        );
        remaining -= apply;
      }
    }
    // Record this payment in the history table
    try {
      database.runSync(
        'INSERT INTO debt_payments (saleId, customerName, customerPhone, amount, type, note) VALUES (?, ?, ?, ?, ?, ?)',
        [
          options?.saleId ?? null,
          customerName,
          options?.customerPhone ?? null,
          amount,
          type,
          options?.note ?? null,
        ],
      );
    } catch (e) {
      console.error('Record debt payment history error:', e);
    }

    // Create a payment record in sales so it appears in activity feed
    try {
      const batchId = 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const firstDebt = database.getFirstSync<any>(
        "SELECT itemId, unit, unitType FROM sales WHERE customerName = ? AND paymentStatus = 'Paid' ORDER BY id DESC LIMIT 1",
        [customerName]
      );
      database.runSync(
        `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, createdAt)
         VALUES (?, 1, ?, ?, 0, 0, ?, ?, 'Paid', ?, ?, ?, ?)`,
        [
          firstDebt?.itemId ?? 1,
          firstDebt?.unit || 'pcs',
          firstDebt?.unitType || 'base',
          -Math.abs(amount),
          method || 'Cash',
          customerName,
          options?.customerPhone ?? null,
          batchId,
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
    const sales = database.getAllSync<{ id: number; totalPrice: number; paidAmount: number }>(
      "SELECT id, totalPrice, paidAmount FROM sales WHERE customerName = ? AND paymentStatus = 'Debt'",
      [customerName],
    );
    const outstanding = sales.reduce(
      (sum, s) => sum + Math.max(0, (s.totalPrice || 0) - (s.paidAmount || 0)),
      0,
    );
    database.runSync(
      "UPDATE sales SET paymentStatus = 'Loss' WHERE customerName = ? AND paymentStatus = 'Debt'",
      [customerName]
    );
    // Record write-off as a history entry (negative direction, type='loss')
    try {
      if (outstanding > 0) {
        database.runSync(
          'INSERT INTO debt_payments (customerName, customerPhone, amount, type, note) VALUES (?, ?, ?, ?, ?)',
          [
            customerName,
            options?.customerPhone ?? null,
            outstanding,
            'loss',
            options?.note ?? null,
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
    const rows = database.getFirstSync<{
      totalOwed: number | null;
      debtorCount: number | null;
      overdueCount: number | null;
      overdueAmount: number | null;
    }>(`
      SELECT
        COALESCE(SUM(totalPrice - paidAmount), 0) as totalOwed,
        COUNT(DISTINCT customerName) as debtorCount,
        SUM(CASE WHEN dueDate IS NOT NULL AND dueDate < date('now') THEN 1 ELSE 0 END) as overdueCount,
        COALESCE(SUM(CASE WHEN dueDate IS NOT NULL AND dueDate < date('now') THEN (totalPrice - paidAmount) ELSE 0 END), 0) as overdueAmount
      FROM sales
      WHERE paymentStatus = 'Debt'
    `);
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
    return database.getAllSync(
      `SELECT id, saleId, customerName, customerPhone, amount, type, note, createdAt
       FROM debt_payments
       WHERE customerName = ?
       ORDER BY datetime(createdAt) DESC
       LIMIT 100`,
      [customerName],
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
    const row = database.getFirstSync<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM debt_payments
       WHERE customerName = ? AND type IN ('full', 'partial')`,
      [customerName],
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
    database.runSync("UPDATE items SET isCredit = 0 WHERE id = ?", [itemId]);
    return true;
  } catch (error) {
    console.error('Settle item credit error:', error);
    return false;
  }
};

export const getOnCreditItems = () => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE isCredit = 1
      ORDER BY createdAt DESC
    `);
  } catch (error) {
    console.error('Get on credit items error:', error);
    return [];
  }
};

export const getSalesChartData = (period: 'W' | 'M' | 'Y', offset: number = 0, calendarType?: string) => {
  try {
    const database = getDB();
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
        WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND paymentStatus != 'Order'
        GROUP BY label
        ORDER BY label
      `, [startStr, endStr]);

      const returnRefunds = database.getAllSync<{ label: string, value: number }>(`
        SELECT 
          strftime('%w', createdAt) as label,
          SUM(totalRefund) as value
        FROM returns 
        WHERE date(createdAt) >= ? AND date(createdAt) <= ?
        GROUP BY label
        ORDER BY label
      `, [startStr, endStr]);

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
          WHERE date(createdAt) >= ? AND date(createdAt) < ? AND paymentStatus != 'Order'
        `, [startStr, endStr]);

        const allReturns = database.getAllSync<{ createdAt: string, totalRefund: number }>(`
          SELECT createdAt, totalRefund FROM returns
          WHERE date(createdAt) >= ? AND date(createdAt) < ?
        `, [startStr, endStr]);

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
        WHERE strftime('%Y-%m', createdAt) = ? AND paymentStatus != 'Order'
        GROUP BY label
        ORDER BY label
      `, [`${y}-${m}`]);

      const returnRefunds = database.getAllSync<{ label: string, value: number }>(`
        SELECT ((CAST(strftime('%d', createdAt) AS INTEGER) - 1) / 7 + 1) as label, SUM(totalRefund) as value
        FROM returns
        WHERE strftime('%Y-%m', createdAt) = ?
        GROUP BY label
        ORDER BY label
      `, [`${y}-${m}`]);

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
          WHERE strftime('%Y', createdAt) = ? AND paymentStatus != 'Order'
        `, [String(yr)]);

        const allReturns = database.getAllSync<{ createdAt: string, totalRefund: number }>(`
          SELECT createdAt, totalRefund FROM returns
          WHERE strftime('%Y', createdAt) = ?
        `, [String(yr)]);

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
        WHERE strftime('%Y', createdAt) = ? AND paymentStatus != 'Order'
        GROUP BY label
        ORDER BY label
      `, [String(yr)]);

      const returnRefunds = database.getAllSync<{ label: string, value: number }>(`
        SELECT CAST(strftime('%m', createdAt) AS INTEGER) as label, SUM(totalRefund) as value
        FROM returns
        WHERE strftime('%Y', createdAt) = ?
        GROUP BY label
        ORDER BY label
      `, [String(yr)]);

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
  am_days: ['ሰንዠት', 'እሑድ', 'ማክሰኞ', 'ረቡዕ', 'ሙስ', 'ዓርብ', 'ቅዳሜ'],
  om_days: ['Dil', 'Wii', 'Qib', 'Roob', 'Kam', 'Jum', 'San'],
  ti_days: ['ሰንበት', 'እሑድ', 'ሰኑ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርቢ'],
  en_months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  am_months: ['ጃንዩ', 'ፌብሩ', 'ማርች', 'ኤፕሪል', 'ሜይ', 'ጁን', 'ጁላይ', 'ኦገስ', 'ሴፕቴምበር', 'ኦክቶበር', 'ኖቬምበር', 'ዲሴምበር'],
  om_months: ['Ama', 'Gur', 'Bit', 'Ebl', 'Caa', 'Wax', 'Ado', 'Hag', 'Ful', 'Onk', 'Sad', 'Mud'],
  ti_months: ['ጃንዩ', 'ፌብሩ', 'ማርች', 'ኤፕሪል', 'ሜይ', 'ጁን', 'ጁላይ', 'ኦገስ', 'ሴፕቴምበር', 'ኦክቶበር', 'ኖቬምበር', 'ዲሴምበር'],
  en_hours: ['3 AM', '6 AM', '9 AM', '12 PM', '3 PM'],
  am_hours: ['3:00 ጽ', '6:00 ጽ', '9:00 ጽ', '12:00 ረፋድ', '3:00 ረፋድ'],
  om_hours: ['3 AA', '6 AA', '9 AA', '12 WB', '3 WB'],
  ti_hours: ['3:00 ጽ', '6:00 ጽ', '9:00 ጽ', '12:00 ረፋድ', '3:00 ረፋድ'],
};

export const getExpenseChartData = (period: string, language: string = 'en', targetDate?: string, timeSystem: 'device' | 'ethiopian' = 'device') => {
  try {
    const database = getDB();

    if (period === 'today' || period === 'yesterday') {
      const refDate = period === 'today'
        ? (targetDate || new Date().toISOString().split('T')[0])
        : (targetDate || new Date(Date.now() - 86400000).toISOString().split('T')[0]);
      const results = database.getAllSync<{ hour: string, value: number }>(`
        SELECT
          strftime('%H', datetime(createdAt, 'localtime')) as hour,
          SUM(amount) as value
        FROM expenses
        WHERE date(date) = ?
        GROUP BY hour
      `, [refDate]);

      const hours = ['09', '12', '15', '18', '21'];
      const hourLabels = CHART_LABELS[`${language}_hours`] || CHART_LABELS.en_hours;
      return hours.map((h, index) => {
        const sum = results.reduce((acc, r) => {
          const hrRaw = parseInt(r.hour);
          if (!Number.isFinite(hrRaw)) return acc;
          // Shift to Ethiopian clock (hr âˆ’ 6) when the user has
          // selected the Ethiopian time system. This re-buckets
          // expenses into Ethiopian hours so the chart shows
          // "9:00 á‰€áŠ•" instead of "3:00 AM" etc.
          const hr = timeSystem === 'ethiopian' ? ((hrRaw - 6) % 24 + 24) % 24 : hrRaw;
          if (h === '09' && hr < 10) return acc + r.value;
          if (h === '12' && hr >= 10 && hr < 13) return acc + r.value;
          if (h === '15' && hr >= 13 && hr < 16) return acc + r.value;
          if (h === '18' && hr >= 16 && hr < 19) return acc + r.value;
          if (h === '21' && hr >= 19) return acc + r.value;
          return acc;
        }, 0);
        return { label: hourLabels[index], value: sum };
      });
    } else if (period === 'this_week' || period === 'W') {
      const now = targetDate ? new Date(targetDate.replace(/-/g, '/')) : new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      const results = database.getAllSync<{ day_num: string, value: number }>(`
        SELECT strftime('%w', date) as day_num, SUM(amount) as value
        FROM expenses
        WHERE date >= ? AND date <= ?
        GROUP BY day_num
      `, [startStr, endStr]);

      const dayLabels = CHART_LABELS[`${language}_days`] || CHART_LABELS.en_days;
      return dayLabels.map((day, index) => {
        const existing = results.find(r => parseInt(r.day_num) === index);
        return { label: day, value: existing ? existing.value : 0 };
      });
    } else if (period === 'this_month' || period === 'M') {
      const now = targetDate ? new Date(targetDate.replace(/-/g, '/')) : new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startStr = monthStart.toISOString().split('T')[0];
      const endStr = monthEnd.toISOString().split('T')[0];

      const results = database.getAllSync<{ week_num: number, value: number }>(`
        SELECT ((CAST(strftime('%d', date) AS INTEGER) - 1) / 7 + 1) as week_num, SUM(amount) as value
        FROM expenses
        WHERE date >= ? AND date <= ?
        GROUP BY week_num
      `, [startStr, endStr]);

      const weekPrefix: Record<string, string> = { en: 'Week', am: 'ሳምንት', om: 'Torban', ti: 'ሳምንት' };
      const prefix = weekPrefix[language] || 'Week';
      const numWeeks = Math.ceil(monthEnd.getDate() / 7);
      const weeks: { label: string, value: number }[] = [];
      for (let i = 1; i <= numWeeks; i++) {
        const existing = results.find(r => r.week_num === i);
        weeks.push({ label: `${prefix} ${i}`, value: existing ? existing.value : 0 });
      }
      return weeks;
    } else {
      const now = targetDate ? new Date(targetDate.replace(/-/g, '/')) : new Date();
      const startStr = `${now.getFullYear()}-01-01`;
      const endStr = `${now.getFullYear()}-12-31`;

      const results = database.getAllSync<{ month_num: number, value: number }>(`
        SELECT CAST(strftime('%m', date) AS INTEGER) as month_num, SUM(amount) as value
        FROM expenses
        WHERE date >= ? AND date <= ?
        GROUP BY month_num
      `, [startStr, endStr]);

      const monthLabels = CHART_LABELS[`${language}_months`] || CHART_LABELS.en_months;
      return monthLabels.map((month, index) => {
        const existing = results.find(r => r.month_num === (index + 1));
        return { label: month, value: existing ? existing.value : 0 };
      });
    }
  } catch (error) {
    console.error('Get expense chart data error:', error);
    return [];
  }
};

export const deleteExpense = (id: number) => {
  try {
    const database = getDB();
    database.execSync(`DELETE FROM expenses WHERE id = ${id}`);
    return true;
  } catch (error) {
    console.error('Delete expense error:', error);
    return false;
  }
};

export const deleteItem = (id: number) => {
  try {
    const database = getDB();
    database.execSync(`DELETE FROM items WHERE id = ${id}`);
    return true;
  } catch (error) {
    console.error('Delete item error:', error);
    return false;
  }
};

export const deleteSale = (id: number) => {
  try {
    const database = getDB();
    const sale = database.getFirstSync<{ itemId: number, quantity: number, unitType: string }>('SELECT * FROM sales WHERE id = ?', [id]);
    
    if (sale) {
      const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ?', [sale.itemId]);
      
      let baseRefund = sale.quantity;
      let packRefund = 0;
      
      if (sale.unitType === 'pack' && item?.unitsPerPack) {
        baseRefund = sale.quantity * item.unitsPerPack;
        packRefund = sale.quantity;
      } else if (item?.unitsPerPack) {
        packRefund = sale.quantity / item.unitsPerPack;
      }

      database.execSync(`
        UPDATE items 
        SET totalBaseQuantity = totalBaseQuantity + ${baseRefund},
            totalPackQuantity = totalPackQuantity + ${packRefund}
        WHERE id = ${sale.itemId}
      `);
    }

    database.execSync(`DELETE FROM sales WHERE id = ${id}`);
    return true;
  } catch (error) {
    console.error('Delete sale error:', error);
    return false;
  }
};

export const deleteSalesByBatchId = (batchId: string) => {
  try {
    const database = getDB();
    const batchSales = database.getAllSync<{ id: number, itemId: number, quantity: number, unitType: string }>(
      'SELECT * FROM sales WHERE batchId = ?', [batchId]
    );
    for (const sale of batchSales) {
      const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ?', [sale.itemId]);
      let baseRefund = sale.quantity;
      let packRefund = 0;
      if (sale.unitType === 'pack' && item?.unitsPerPack) {
        baseRefund = sale.quantity * item.unitsPerPack;
        packRefund = sale.quantity;
      } else if (item?.unitsPerPack) {
        packRefund = sale.quantity / item.unitsPerPack;
      }
      database.execSync(`
        UPDATE items 
        SET totalBaseQuantity = totalBaseQuantity + ${baseRefund},
            totalPackQuantity = totalPackQuantity + ${packRefund}
        WHERE id = ${sale.itemId}
      `);
    }
    database.execSync(`DELETE FROM sales WHERE batchId = '${batchId}'`);
    return true;
  } catch (error) {
    console.error('Delete sales by batchId error:', error);
    return false;
  }
};

export const getInventoryComparisonStats = () => {
  try {
    const database = getDB();
    const d = new Date();
    const currentMonthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const previousMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const lastMonthPrefix = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;
    
    const currentStats = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM items WHERE createdAt LIKE ?
    `, [`${currentMonthPrefix}%`]);
    
    const previousStats = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM items WHERE createdAt LIKE ?
    `, [`${lastMonthPrefix}%`]);
    
    const currentTotal = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items');

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

export const getExpenseComparisonStats = () => {
  try {
    const database = getDB();
    const d = new Date();
    const currentMonthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const previousMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const lastMonthPrefix = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const currentStats = database.getFirstSync<{ total: number }>(`
      SELECT SUM(amount) as total FROM expenses WHERE date LIKE ?
    `, [`${currentMonthPrefix}%`]);

    const previousStats = database.getFirstSync<{ total: number }>(`
      SELECT SUM(amount) as total FROM expenses WHERE date LIKE ?
    `, [`${lastMonthPrefix}%`]);

    const allTotal = database.getFirstSync<{ total: number }>('SELECT SUM(amount) as total FROM expenses');

    return {
      totalLoss: allTotal?.total || 0,
      thisMonthLoss: currentStats?.total || 0,
      lastMonthLoss: previousStats?.total || 0,
      diff: (currentStats?.total || 0) - (previousStats?.total || 0)
    };
  } catch (error) {
    console.error('getExpenseComparisonStats error:', error);
    return null;
  }
};

export const getCapitalSummary = (period: string = 'this_month', targetDate?: string) => {
  try {
    const database = getDB();
    const d = targetDate ? new Date(targetDate.replace(/-/g, '/')) : new Date();
    let startStr = '';
    let endStr = '';

    if (period === 'today') {
      startStr = endStr = d.toISOString().split('T')[0];
    } else if (period === 'yesterday') {
      const yesterday = new Date(d.getTime() - 86400000);
      startStr = endStr = yesterday.toISOString().split('T')[0];
    } else if (period === 'this_week') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      startStr = weekStart.toISOString().split('T')[0];
      endStr = weekEnd.toISOString().split('T')[0];
    } else if (period === 'this_year') {
      startStr = `${d.getFullYear()}-01-01`;
      endStr = `${d.getFullYear()}-12-31`;
    } else {
      // default: this_month
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      startStr = monthStart.toISOString().split('T')[0];
      endStr = monthEnd.toISOString().split('T')[0];
    }

    // 1. Total Disbursement in this period
    const currentTotal = database.getFirstSync<{ total: number }>(
      'SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ?',
      [startStr, endStr]
    );

    // 2. Top Category
    const topCategory = database.getFirstSync<{ name: string, total: number }>(`
      SELECT category as name, SUM(amount) as total 
      FROM expenses 
      WHERE date >= ? AND date <= ?
      GROUP BY category 
      ORDER BY total DESC 
      LIMIT 1
    `, [startStr, endStr]);

    // 3. Category Distribution
    const categories = database.getAllSync<{ name: string, total: number }>(`
      SELECT category as name, SUM(amount) as total 
      FROM expenses 
      WHERE date >= ? AND date <= ? 
      GROUP BY category 
      ORDER BY total DESC
    `, [startStr, endStr]);

    // 4. Budget from budgets table
    let budget = 50000;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const activeBudget = database.getFirstSync<any>(
      `SELECT b.*, COALESCE(SUM(bc.plannedAmount), 0) as totalPlanned
       FROM budgets b
       LEFT JOIN budget_categories bc ON bc.budgetId = b.id
       WHERE b.status = 'active'
         AND (b.year = ? OR b.period = 'yearly')
         AND (b.month = ? OR b.month IS NULL OR b.period != 'monthly')
       GROUP BY b.id
       ORDER BY b.year DESC, b.month DESC
       LIMIT 1`,
      [year, month]
    );
    if (activeBudget?.totalPlanned) {
      budget = activeBudget.totalPlanned;
      if (period === 'today' || period === 'yesterday') {
        budget = Math.round(budget / 30);
      } else if (period === 'this_week') {
        budget = Math.round(budget / 4);
      } else if (period === 'this_year') {
        budget = budget * 12;
      }
    }

    return {
      monthlyDisbursement: currentTotal?.total || 0,
      topCategory: topCategory || { name: 'None', total: 0 },
      budget,
      budgetProgress: Math.min(((currentTotal?.total || 0) / budget) * 100, 100),
      categoryDistribution: categories,
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
    const validColumns = [
      'name', 'categoryId', 'companyName', 'purchaseUnit', 'baseUnit',
      'unitsPerPack', 'totalPackQuantity', 'totalBaseQuantity',
      'packPurchasePrice', 'basePurchasePrice', 'baseSellingPrice',
      'packSellingPrice', 'allowSellByBaseUnit', 'allowSellByPackUnit',
      'expiryDate', 'qualityGrade', 'notes', 'isCredit',
      'supplierPhone', 'supplierAccount', 'supplierCallEnabled', 'lastPriceCheckAt', 'createdAt'
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
    
    const itemsSql = `UPDATE items SET ${setQuery} WHERE id = ?`;
    const itemsParams = [...values, id] as any[];
    database.runSync(itemsSql, ...itemsParams);
    return true;
  } catch (error) {
    console.error('Update item error:', error);
    return false;
  }
};

export const updateSale = (id: number, updates: any) => {
  try {
    const database = getDB();
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
    
    const salesSql = `UPDATE sales SET ${setQuery} WHERE id = ?`;
    const salesParams = [...values, id] as any[];
    database.runSync(salesSql, ...salesParams);
    return true;
  } catch (error) {
    console.error('Update sale error:', error);
    return false;
  }
};

export const updateSaleItem = (id: number, updates: any) => {
  try {
    const database = getDB();
    const old = database.getFirstSync<{ itemId: number, quantity: number, unitType: string }>('SELECT * FROM sales WHERE id = ?', [id]);
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
      const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ?', [old.itemId]);
      let baseQty = diff;
      let packQty = 0;
      if (old.unitType === 'pack' && item?.unitsPerPack) {
        baseQty = diff * item.unitsPerPack;
        packQty = diff;
      } else if (item?.unitsPerPack) {
        packQty = diff / item.unitsPerPack;
      }
      database.execSync(`
        UPDATE items 
        SET totalBaseQuantity = totalBaseQuantity + ${baseQty},
            totalPackQuantity = totalPackQuantity + ${packQty}
        WHERE id = ${old.itemId}
      `);
    }

    const setQuery = Object.keys(filteredUpdates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredUpdates);
    const sql = `UPDATE sales SET ${setQuery} WHERE id = ?`;
    database.runSync(sql, ...([...values, id] as any[]));
    return true;
  } catch (error) {
    console.error('Update sale item error:', error);
    return false;
  }
};

export const updateExpense = (id: number, updates: any) => {
  try {
    const database = getDB();
    const validColumns = [
      'name', 'amount', 'category', 'date', 
      'isRecurring', 'frequency', 'nextBillingDate', 'createdAt',
      'budgetCategoryId'
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
    
    const expensesSql = `UPDATE expenses SET ${setQuery} WHERE id = ?`;
    const expensesParams = [...values, id] as any[];
    database.runSync(expensesSql, ...expensesParams);
    return true;
  } catch (error) {
    console.error('Update expense error:', error);
    return false;
  }
};

export const clearDatabase = () => {
  try {
    const database = getDB();
    database.execSync('PRAGMA foreign_keys = OFF;');
    database.execSync('DELETE FROM budget_adjustments;');
    database.execSync('DELETE FROM budget_categories;');
    database.execSync('DELETE FROM budgets;');
    database.execSync('DELETE FROM recurring_expense_templates;');
    database.execSync('DELETE FROM scheduled_reminders;');
    database.execSync('DELETE FROM notifications;');
    database.execSync('DELETE FROM notification_preferences;');
    database.execSync('DELETE FROM returns;');
    database.execSync('DELETE FROM debt_payments;');
    database.execSync('DELETE FROM adjustments;');
    database.execSync('DELETE FROM sales;');
    database.execSync('DELETE FROM item_packs;');
    database.execSync('DELETE FROM items;');
    database.execSync('DELETE FROM expenses;');
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
    const d = new Date();
    const currentMonthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const totalRecords = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM adjustments WHERE createdAt LIKE ?',
      [`${currentMonthPrefix}%`]
    );

    const priceDecreaseLeakage = database.getFirstSync<{ total: number }>(`
      SELECT SUM((oldValue - newValue) * i.totalBaseQuantity) as total 
      FROM adjustments a
      JOIN items i ON a.itemId = i.id
      WHERE a.type = 'price_down' AND a.createdAt LIKE ?
    `, [`${currentMonthPrefix}%`]);

    const damagedLeakage = database.getFirstSync<{ total: number }>(`
      SELECT SUM(a.quantity * i.basePurchasePrice) as total 
      FROM adjustments a
      JOIN items i ON a.itemId = i.id
      WHERE a.type = 'damaged' AND a.createdAt LIKE ?
    `, [`${currentMonthPrefix}%`]);

    const topAdjusted = database.getFirstSync<{ name: string, count: number }>(`
      SELECT i.name, COUNT(a.id) as count 
      FROM adjustments a
      JOIN items i ON a.itemId = i.id
      WHERE a.createdAt LIKE ?
      GROUP BY a.itemId 
      ORDER BY count DESC 
      LIMIT 1
    `, [`${currentMonthPrefix}%`]);

    const types = database.getAllSync<{ type: string, count: number }>(`
      SELECT type, COUNT(*) as count 
      FROM adjustments 
      WHERE createdAt LIKE ?
      GROUP BY type
    `, [`${currentMonthPrefix}%`]);

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
    const today = targetDate || new Date().toISOString().split('T')[0];
    
    const topItem = database.getFirstSync<{ name: string, quantity: number }>(`
      SELECT i.name, SUM(s.quantity) as quantity
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) = ?
      GROUP BY s.itemId
      ORDER BY quantity DESC
      LIMIT 1
    `, [today]);

    const stats = getDashboardStats(targetDate);
    let healthScore = 100;
    if (stats) {
      const revenue = stats.today.revenue;
      const expenses = stats.today.expenses;
      const profit = stats.today.grossProfit;
      
      if (revenue > 0) {
        const profitMargin = (profit / revenue) * 100;
        const opexRatio = (expenses / revenue) * 100;
        healthScore = Math.min(Math.max(profitMargin * 2 - opexRatio, 0), 100);
      } else if (expenses > 0) {
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
    const results = database.getAllSync(`
      SELECT items.*, categories.name as categoryName,
             (items.totalBaseQuantity * items.baseSellingPrice) as totalValue
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id
      ORDER BY totalValue DESC
      LIMIT ?
    `, [limit]);
    return results;
  } catch (error) {
    console.error('Get top highest value items error:', error);
    return [];
  }
};

export const getInventoryItemsByPeriod = (period: 'today' | 'yesterday' | 'date' | 'week' | 'month' | 'year', targetDate?: string, offset?: number) => {
  try {
    const database = getDB();
    const now = new Date();
    let params: any[] = [];
    let query = '';

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      query = `
        SELECT items.*, categories.name as categoryName,
               strftime('%H:%M', items.createdAt) as timeStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id
        WHERE date(items.createdAt) = ?
        ORDER BY items.createdAt DESC
      `;
      params = [todayStr];
    } else if (period === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      query = `
        SELECT items.*, categories.name as categoryName,
               strftime('%H:%M', items.createdAt) as timeStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id
        WHERE date(items.createdAt) = ?
        ORDER BY items.createdAt DESC
      `;
      params = [yesterdayStr];
    } else if (period === 'date') {
      const dateStr = targetDate || now.toISOString().split('T')[0];
      query = `
        SELECT items.*, categories.name as categoryName,
               strftime('%H:%M', items.createdAt) as timeStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id
        WHERE date(items.createdAt) = ?
        ORDER BY items.createdAt DESC
      `;
      params = [dateStr];
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
        LEFT JOIN categories ON items.categoryId = categories.id
        WHERE date(items.createdAt) >= ? AND date(items.createdAt) <= ?
        ORDER BY items.createdAt DESC
      `;
      params = [startStr, endStr];
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
        LEFT JOIN categories ON items.categoryId = categories.id
        WHERE strftime('%m', items.createdAt) = ? AND strftime('%Y', items.createdAt) = ?
        ORDER BY items.createdAt
      `;
      params = [monthStr, yearStr];
    } else if (period === 'year') {
      const yearOffset = offset || 0;
      const yearDate = new Date(now.getFullYear() + yearOffset, 0, 1);
      const yearStr = yearDate.getFullYear().toString();

      query = `
        SELECT items.*, categories.name as categoryName,
               CAST(strftime('%m', items.createdAt) AS INTEGER) as monthNum,
               strftime('%Y-%m-%d', items.createdAt) as dateStr
        FROM items
        LEFT JOIN categories ON items.categoryId = categories.id
        WHERE strftime('%Y', items.createdAt) = ?
        ORDER BY items.createdAt
      `;
      params = [yearStr];
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
        JOIN items ON sales.itemId = items.id
        LEFT JOIN categories ON items.categoryId = categories.id
        WHERE 1=1 AND paymentStatus != 'Order' ${dateCondition}
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
      LEFT JOIN sales ON items.id = sales.itemId
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE 1=1 AND paymentStatus != 'Order' ${dateCondition}
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
    return database.getAllSync<ItemData>(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE totalBaseQuantity > 0
      ORDER BY totalBaseQuantity DESC
    `);
  } catch (error) {
    console.error('Get in stock items error:', error);
    return [];
  }
};

export const getItemsFilteredByStockStatus = (status: 'in_stock' | 'low_stock'): ItemData[] => {
  try {
    const database = getDB();
    let condition = status === 'in_stock' 
      ? 'totalBaseQuantity > 0'
      : 'totalBaseQuantity < 10';
    
    return database.getAllSync<ItemData>(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE ${condition}
      ORDER BY totalBaseQuantity ${status === 'in_stock' ? 'DESC' : 'ASC'}
    `);
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
    
    // Default to current month if no dates provided
    const d = new Date();
    const defaultStart = startDate || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultEnd = endDate || new Date().toISOString().split('T')[0];

    // Items Increased in Price
    const increasedCount = database.getFirstSync<{ count: number, total: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(newValue - oldValue), 0) as total
      FROM adjustments 
      WHERE type = 'price_up' AND date(createdAt) >= ? AND date(createdAt) <= ?
    `, [defaultStart, defaultEnd]);

    // Items Decreased in Price
    const decreasedCount = database.getFirstSync<{ count: number, total: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(oldValue - newValue), 0) as total
      FROM adjustments 
      WHERE type = 'price_down' AND date(createdAt) >= ? AND date(createdAt) <= ?
    `, [defaultStart, defaultEnd]);

    // Damaged Items
    const damagedData = database.getFirstSync<{ count: number, total: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(a.quantity * i.basePurchasePrice), 0) as total
      FROM adjustments a
      JOIN items i ON a.itemId = i.id
      WHERE a.type = 'damaged' AND date(a.createdAt) >= ? AND date(a.createdAt) <= ?
    `, [defaultStart, defaultEnd]);

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

    // Sales (Cash)
    const salesCash = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(totalPrice), 0) as total FROM sales 
      WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND paymentStatus != 'Order'
    `, [startDate, endDate]);

    // Sales (Items count)
    const salesItems = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM sales 
      WHERE date(createdAt) >= ? AND date(createdAt) <= ? AND paymentStatus != 'Order'
    `, [startDate, endDate]);

    // Profit (Gross Profit = Revenue - COGS)
    const profitData = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))), 0) as total
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ? AND paymentStatus != 'Order'
    `, [startDate, endDate]);

    // Expenses
    const expenses = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
      WHERE date(date) >= ? AND date(date) <= ?
    `, [startDate, endDate]);

    // Debt
    const debt = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(totalPrice - COALESCE(paidAmount, 0)), 0) as total FROM sales 
      WHERE paymentStatus = 'Debt' AND date(createdAt) >= ? AND date(createdAt) <= ?
    `, [startDate, endDate]);

    // Returns (total refunds in the period)
    const returnData = database.getFirstSync<{ totalRefund: number, returnCount: number }>(`
      SELECT COALESCE(SUM(totalRefund), 0) as totalRefund, COUNT(*) as returnCount FROM returns 
      WHERE date(createdAt) >= ? AND date(createdAt) <= ?
    `, [startDate, endDate]);

    // Damage Loss
    const damageLoss = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(a.quantity * i.basePurchasePrice), 0) as total
      FROM adjustments a
      JOIN items i ON a.itemId = i.id
      WHERE a.type = 'damaged' AND date(a.createdAt) >= ? AND date(a.createdAt) <= ?
    `, [startDate, endDate]);

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
      WHERE date(createdAt) >= ? AND date(createdAt) <= ?
    `, [startDate, endDate]);

    // Other Losses (debt marked as loss)
    const otherLosses = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(totalPrice - COALESCE(paidAmount, 0)), 0) as total FROM sales 
      WHERE paymentStatus = 'Loss' AND date(createdAt) >= ? AND date(createdAt) <= ?
    `, [startDate, endDate]);

    const salesCashVal = salesCash?.total || 0;
    const salesItemsVal = salesItems?.total || 0;
    const profitVal = profitData?.total || 0;
    const expensesVal = expenses?.total || 0;
    const debtVal = debt?.total || 0;
    const returnVal = returnData?.totalRefund || 0;
    const returnCount = returnData?.returnCount || 0;
    const damageLossVal = damageLoss?.total || 0;
    const priceChangesVal = priceChanges?.total || 0;
    const otherLossesVal = otherLosses?.total || 0;

    // Net Sales = Sales Cash - Returns
    const netSalesCash = salesCashVal - returnVal;

    // Net Profit = Sales Profit + Price Change Gains - Expenses - Returns - Damage Losses - Other Losses
    const netProfit = profitVal + (priceChangesVal > 0 ? priceChangesVal : 0) - expensesVal - returnVal - damageLossVal - otherLossesVal;

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
      expenses: expensesVal,
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
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ?
      ORDER BY s.createdAt DESC
    `, [startDate, endDate]);

    const adjustments = database.getAllSync(`
      SELECT a.*, i.name as itemName, 'adjustment' as sourceType
      FROM adjustments a
      JOIN items i ON a.itemId = i.id
      WHERE date(a.createdAt) >= ? AND date(a.createdAt) <= ?
      ORDER BY a.createdAt DESC
    `, [startDate, endDate]);

    const expenses = database.getAllSync(`
      SELECT *, 'expense' as sourceType FROM expenses
      WHERE date(date) >= ? AND date(date) <= ?
      ORDER BY date DESC
    `, [startDate, endDate]);

    return {
      startDate,
      endDate,
      sales,
      adjustments,
      expenses
    };
  } catch (error) {
    console.error('getRecordsByPeriod error:', error);
    return null;
  }
};

export const getEarliestRecordDate = (): string | undefined => {
  try {
    const database = getDB();
    const dates = database.getFirstSync<{ minDate: string }>(`
      SELECT MIN(minDate) as minDate FROM (
        SELECT MIN(date(createdAt)) as minDate FROM sales
        UNION ALL
        SELECT MIN(date(date)) as minDate FROM expenses
        UNION ALL
        SELECT MIN(date(createdAt)) as minDate FROM adjustments
      )
    `);
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
    return database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id 
      ORDER BY sales.createdAt DESC 
      LIMIT ?
    `, [limit]);
  } catch (error) {
    console.error('Get recent sales error:', error);
    return [];
  }
};

export const getRecentSalesGrouped = (limit: number = 20) => {
  try {
    const database = getDB();
    const sales = database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit 
      FROM sales 
      LEFT JOIN items ON sales.itemId = items.id 
      ORDER BY sales.createdAt DESC 
      LIMIT ?
    `, [limit]);
    
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
    return database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id 
      ORDER BY items.id DESC 
      LIMIT ?
    `, [limit]);
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

export const updateMonthlyBudget = (amount: number) => {
  try {
    const database = getDB();
    database.execSync(`PRAGMA user_version = ${amount}`);
    return true;
  } catch (error) {
    console.error('Update monthly budget error:', error);
    return false;
  }
};

export const getCustomerActivity = (customerName?: string) => {
  try {
    const database = getDB();

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
        LEFT JOIN items i ON s.itemId = i.id
        WHERE s.customerName = ?
          AND (
            s.paymentStatus = 'Debt'
            OR s.paymentStatus = 'Loss'
            OR (s.paymentStatus = 'Paid' AND COALESCE(s.paidAmount, 0) > 0)
          )
        ORDER BY s.createdAt DESC
      `, [customerName]);
    }

    // No customer — aggregated summary
    return database.getAllSync(`
      SELECT
        customerName,
        COUNT(*)        AS visitCount,
        SUM(totalPrice) AS totalSpent,
        MAX(createdAt)  AS lastVisit
      FROM sales
      WHERE customerName IS NOT NULL AND customerName != '' AND paymentStatus != 'Order'
      GROUP BY customerName
      ORDER BY lastVisit DESC
    `);
  } catch (error) {
    console.error('Get customer activity error:', error);
    return [];
  }
};

export const getPaymentMethodBreakdown = (startDate?: string, endDate?: string) => {
  try {
    const database = getDB();
    let query = `SELECT s.paymentMethod, COUNT(*) as count, SUM(s.totalPrice) - COALESCE(r.refunded, 0) as total FROM sales s`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (startDate) {
      conditions.push('date(s.createdAt) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date(s.createdAt) <= ?');
      params.push(endDate);
    }

    conditions.push("s.paymentStatus != 'Order'");

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
    const today = new Date().toISOString().split('T')[0];
    let query = `SELECT strftime('%H', datetime(createdAt, 'localtime')) as hour, COUNT(*) as count, SUM(quantity) as totalQty FROM sales WHERE date(createdAt) = ? AND paymentStatus != 'Order'`;
    const params: any[] = [today];
    
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
      INSERT INTO warehouses (name, location, contactPerson, phone, notes)
      VALUES (?, ?, ?, ?, ?)
    `).executeSync([data.name, data.location || null, data.contactPerson || null, data.phone || null, data.notes || null]);
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert warehouse error:', error);
    return null;
  }
};

export const getWarehouses = () => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM warehouses ORDER BY name ASC');
  } catch (error) {
    console.error('Get warehouses error:', error);
    return [];
  }
};

export const getWarehouseById = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync('SELECT * FROM warehouses WHERE id = ?', [id]);
  } catch (error) {
    console.error('Get warehouse by ID error:', error);
    return null;
  }
};

export const updateWarehouse = (id: number, data: { name?: string; location?: string; contactPerson?: string; phone?: string; notes?: string }) => {
  try {
    const database = getDB();
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
    params.push(id);
    database.runSync(`UPDATE warehouses SET ${updates.join(', ')} WHERE id = ?`, ...params);
    return true;
  } catch (error) {
    console.error('Update warehouse error:', error);
    return false;
  }
};

export const deleteWarehouse = (id: number) => {
  try {
    const database = getDB();
    // Check if any items reference this warehouse
    const itemsUsing = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE warehouseId = ?', [id]);
    if (itemsUsing && itemsUsing.count > 0) {
      // Set warehouseId to NULL for those items first
      database.runSync('UPDATE items SET warehouseId = NULL WHERE warehouseId = ?', [id]);
    }
    database.runSync('DELETE FROM warehouses WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Delete warehouse error:', error);
    return false;
  }
};

export const getWarehouseStats = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync(`
      SELECT 
        COUNT(*) as itemCount,
        COALESCE(SUM(totalBaseQuantity * basePurchasePrice), 0) as totalValue,
        COALESCE(SUM(totalBaseQuantity), 0) as totalStock
      FROM items WHERE warehouseId = ?
    `, [id]);
  } catch (error) {
    console.error('Get warehouse stats error:', error);
    return null;
  }
};

export const processIndividualPayment = (saleId: number, amount: number, paymentMethod?: string) => {
  try {
    const database = getDB();
    const sale = database.getFirstSync<{ totalPrice: number, paidAmount: number, itemId: number, unit: string, unitType: string, customerName: string, customerPhone: string }>(
      'SELECT totalPrice, paidAmount, itemId, unit, unitType, customerName, customerPhone FROM sales WHERE id = ?', [saleId]
    );
    if (!sale) return false;

    const newPaid = (sale.paidAmount || 0) + amount;
    const newStatus = newPaid >= sale.totalPrice ? 'Paid' : 'Debt';

    if (paymentMethod) {
      database.runSync(
        'UPDATE sales SET paidAmount = ?, paymentStatus = ?, paymentMethod = ? WHERE id = ?',
        [newPaid, newStatus, paymentMethod, saleId]
      );
    } else {
      database.runSync(
        'UPDATE sales SET paidAmount = ?, paymentStatus = ? WHERE id = ?',
        [newPaid, newStatus, saleId]
      );
    }

    // Create a payment record in sales so it appears in activity feed
    try {
      const batchId = 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      database.runSync(
        `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, createdAt)
         VALUES (?, 1, ?, ?, 0, 0, ?, ?, 'Paid', ?, ?, ?, ?)`,
        [
          sale.itemId ?? 1,
          sale.unit || 'pcs',
          sale.unitType || 'base',
          -Math.abs(amount),
          paymentMethod || 'Cash',
          sale.customerName,
          sale.customerPhone ?? null,
          batchId,
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
    let remaining = Math.max(0, amount);
    if (remaining <= 0) return 0;

    const sales = database.getAllSync<{ id: number, totalPrice: number, paidAmount: number }>(`
      SELECT id, totalPrice, paidAmount FROM sales
      WHERE customerName = ?
        AND (paymentStatus = 'Debt' OR (paymentStatus = 'Paid' AND totalPrice > paidAmount))
      ORDER BY createdAt ASC
    `, [customerName]);

    let affected = 0;
    for (const s of sales) {
      if (remaining <= 0) break;
      const outstanding = s.totalPrice - (s.paidAmount || 0);
      if (outstanding <= 0) continue;
      const pay = Math.min(remaining, outstanding);
      const newPaid = (s.paidAmount || 0) + pay;
      const newStatus = newPaid >= s.totalPrice ? 'Paid' : 'Debt';
      database.runSync(
        'UPDATE sales SET paidAmount = ?, paymentStatus = ? WHERE id = ?',
        [newPaid, newStatus, s.id],
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
}

export const insertContact = (data: InsertContactData) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO contacts (fullName, category, subCategory, phone, alternatePhone, accountNumber, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.executeSync([
      data.fullName,
      data.category,
      data.subCategory || null,
      data.phone || null,
      data.alternatePhone || null,
      data.accountNumber || null,
      data.notes || null
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
    const validColumns = ['fullName', 'category', 'subCategory', 'phone', 'alternatePhone', 'accountNumber', 'notes'];
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

// →→ getSalesGroupedByDateRange →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// Returns sales rows with extra computed columns used by SalesRecordScreen
// to group them by day-of-week, week-number, or month-number.
export const getSalesGroupedByDateRange = (
  period: 'today' | 'yesterday' | 'date' | 'week' | 'month' | 'year',
  targetDate?: string,
  offset: number = 0
) => {
  try {
    const database = getDB();
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

    const rows = database.getAllSync(`
      SELECT
        s.*,
        i.name                                    AS itemName,
        i.baseUnit,
        strftime('%H:%M', s.createdAt)            AS timeStr,
        CAST(strftime('%w', s.createdAt) AS INTEGER) AS dayOfWeek,
        ((CAST(strftime('%d', s.createdAt) AS INTEGER) - 1) / 7 + 1) AS weekNum,
        CAST(strftime('%m', s.createdAt) AS INTEGER) AS monthNum
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id
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

// →→ getPaidOutstandingSummary →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// Returns count + total for Paid vs Debt sales, filtered by period/date range.
export const getPaidOutstandingSummary = (
  period: 'today' | 'yesterday' | 'date' | 'week' | 'month' | 'year' = 'today',
  targetDate?: string,
  offset: number = 0
) => {
  try {
    const database = getDB();
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

export const insertPack = (data: { itemId: number; packNumber: number; quantity: number; unit: string }) => {
  try {
    const database = getDB();
    return database.prepareSync(`
      INSERT INTO item_packs (itemId, packNumber, initialQuantity, currentQuantity, unit)
      VALUES (?, ?, ?, ?, ?)
    `).executeSync([data.itemId, data.packNumber, data.quantity, data.quantity, data.unit]) as any;
  } catch (error) {
    console.error('Insert pack error:', error);
    return null;
  }
};

export const insertReturn = (data: { saleId: number; itemId: number; quantity: number; unit: string; unitType: string; totalRefund: number; reason: string; createdAt: string }) => {
  try {
    const database = getDB();

    const statement = database.prepareSync(`
      INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.executeSync([data.saleId, data.itemId, data.quantity, data.unit, data.unitType, data.totalRefund, data.reason, data.createdAt]);

    const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ?', [data.itemId]);
    let baseQty = data.quantity;
    let packQty = 0;

    if (data.unitType === 'pack' && item?.unitsPerPack) {
      baseQty = data.quantity * item.unitsPerPack;
      packQty = data.quantity;
    }

    database.execSync(`
      UPDATE items
      SET totalBaseQuantity = totalBaseQuantity + ${baseQty},
          totalPackQuantity = totalPackQuantity + ${packQty}
      WHERE id = ${data.itemId}
    `);

    return true;
  } catch (error) {
    console.error('Insert return error:', error);
    return null;
  }
};

export const getReturnsBySaleId = (saleId: number) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT r.*, i.name as itemName, i.baseUnit
      FROM returns r
      LEFT JOIN items i ON r.itemId = i.id
      WHERE r.saleId = ?
      ORDER BY r.createdAt DESC
    `, [saleId]);
  } catch (error) {
    console.error('getReturnsBySaleId error:', error);
    return [];
  }
};

export const getReturnStats = (saleId: number) => {
  try {
    const database = getDB();
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
      LEFT JOIN returns r ON r.saleId = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `, [saleId]);

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
  try {
    const database = getDB();

    // Validate: check cumulative returns against original sale quantity
    const saleCheck = database.getFirstSync<{ quantity: number }>('SELECT quantity FROM sales WHERE id = ?', [data.saleId]);
    if (!saleCheck) {
      console.error('processReturn error: Sale not found');
      return null;
    }
    const returnTotal = database.getFirstSync<{ totalQty: number }>(
      'SELECT COALESCE(SUM(quantity), 0) as totalQty FROM returns WHERE saleId = ?',
      [data.saleId]
    );
    const cumulativeQty = (returnTotal?.totalQty || 0) + data.quantity;
    if (cumulativeQty > saleCheck.quantity) {
      console.error('processReturn error: Cannot return more than original sale quantity');
      return null;
    }

    const insertStmt = database.prepareSync(`
      INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, itemCondition, refundType, notes, returnDate, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.executeSync([
      data.saleId, data.itemId, data.quantity, data.unit, data.unitType,
      data.totalRefund, data.reason, data.itemCondition, data.refundType,
      data.notes || null, data.returnDate || null, data.createdAt,
    ]);

    const item = database.getFirstSync<{
      unitsPerPack: number;
      basePurchasePrice: number;
      baseSellingPrice: number;
      packPurchasePrice: number;
      packSellingPrice: number;
      name: string;
    }>('SELECT unitsPerPack, basePurchasePrice, baseSellingPrice, packPurchasePrice, packSellingPrice, name FROM items WHERE id = ?', [data.itemId]);

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
      // Add back to sellable stock
      database.execSync(`
        UPDATE items
        SET totalBaseQuantity = totalBaseQuantity + ${baseQty},
            totalPackQuantity = totalPackQuantity + ${packQty}
        WHERE id = ${data.itemId}
      `);
    } else {
      // Non-resellable: record as damaged/movement adjustment
      database.execSync(`
        INSERT INTO adjustments (itemId, type, oldValue, newValue, quantity, unitType, reason, date, createdAt)
        VALUES (${data.itemId}, 'damaged', 0, 0, ${data.quantity}, '${data.unitType}', 'Returned: ${data.itemCondition} - ${data.reason}', '${data.createdAt.split('T')[0]}', '${data.createdAt}')
      `);
    }

    // Handle store credit
    if (data.refundType === 'Store Credit' && data.totalRefund > 0) {
      // Create a negative-value "sale" to track store credit in customer financials
      const creditBatch = `SCR_${Date.now()}_${data.saleId}`;
      const saleData = database.getFirstSync<{ customerName: string; customerPhone: string }>(
        'SELECT customerName, customerPhone FROM sales WHERE id = ?', [data.saleId]
      );
      database.execSync(`
        INSERT INTO sales (itemId, quantity, unit, unitType, totalPrice, discount, paymentMethod, paymentStatus, customerName, customerPhone, batchId, notes, createdAt)
        VALUES (${data.itemId}, ${data.quantity}, '${data.unit}', '${data.unitType}', ${-data.totalRefund}, 0, 'Credit', 'Paid', '${saleData?.customerName?.replace(/'/g, "''") || ''}', '${saleData?.customerPhone?.replace(/'/g, "''") || ''}', '${creditBatch}', 'Store credit issued for return', '${data.createdAt}')
      `);
    }

    return true;
  } catch (error) {
    console.error('processReturn error:', error);
    return null;
  }
};

export const getAdjustmentById = (id: number) => {
  try {
    const database = getDB();
    const result = database.getFirstSync(`
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.baseSellingPrice, items.packPurchasePrice
      FROM adjustments 
      LEFT JOIN items ON adjustments.itemId = items.id 
      WHERE adjustments.id = ?
    `, [id]);
    return result;
  } catch (error) {
    console.error('getAdjustmentById error:', error);
    return null;
  }
};

export const getExpenseById = (id: number) => {
  try {
    const database = getDB();
    const result = database.getFirstSync('SELECT * FROM expenses WHERE id = ?', [id]);
    return result;
  } catch (error) {
    console.error('getExpenseById error:', error);
    return null;
  }
};

export const searchInventory = (query: string) => {
  try {
    const database = getDB();
    const q = `%${query}%`;
    return database.getAllSync(
      `SELECT items.*, categories.name as categoryName
      FROM items
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE items.name LIKE ? OR categories.name LIKE ?
      ORDER BY items.id DESC
      LIMIT 20`,
      [q, q]
    );
  } catch (error) {
    console.error('Search inventory error:', error);
    return [];
  }
};

// →→ Order Functions →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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
    const batchId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 8);
    const orderNumber = getNextOrderNumber();
    const now = new Date().toISOString();

    for (const item of data.items) {
      const totalPrice = item.price * item.quantity;
      database.runSync(
        `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, orderNumber, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.itemId || null,
        item.quantity,
        item.unit || 'pcs',
        item.unitType || 'base',
        0, 0, totalPrice, null, 'Order',
        data.customerName || null,
        data.customerPhone || null,
        batchId, orderNumber, data.notes || null, now
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
    let whereClause = `WHERE s.paymentStatus IN ('Order', 'Sale', 'Debt', 'Cancelled')`;
    if (statusFilter) {
      whereClause = `WHERE s.paymentStatus = '${statusFilter}'`;
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
      LEFT JOIN items i ON s.itemId = i.id
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
    const active = database.getFirstSync<{ count: number }>(
      `SELECT COUNT(DISTINCT batchId) as count FROM sales WHERE paymentStatus = 'Order'`
    );
    const converted = database.getFirstSync<{ count: number }>(
      `SELECT COUNT(DISTINCT batchId) as count FROM sales WHERE paymentStatus IN ('Sale', 'Debt')`
    );
    const cancelled = database.getFirstSync<{ count: number }>(
      `SELECT COUNT(DISTINCT batchId) as count FROM sales WHERE paymentStatus = 'Cancelled'`
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
    const first = database.getFirstSync(`
      SELECT s.*, i.name as itemName
      FROM sales s
      LEFT JOIN items i ON s.itemId = i.id
      WHERE s.id = ?
    `, [id]);
    if (!first) return null;

    const bId = (first as any).batchId;
    let items: any[];
    if (bId) {
      items = database.getAllSync(`
        SELECT s.id, s.quantity, s.unit, s.unitType, s.totalPrice, s.discount, s.vat,
               COALESCE(i.name, 'Unknown') as itemName
        FROM sales s
        LEFT JOIN items i ON s.itemId = i.id
        WHERE s.batchId = ?
        ORDER BY s.id ASC
      `, [bId]);
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
  try {
    const database = getDB();
    let order: any;
    let targetBatchId: string | null;

    if (typeof idOrBatchId === 'string') {
      targetBatchId = idOrBatchId;
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE batchId = ? AND paymentStatus = ? LIMIT 1', [targetBatchId, 'Order']);
    } else {
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE id = ?', [idOrBatchId]);
      targetBatchId = order?.batchId || null;
    }
    if (!order) return { success: false, error: 'Order not found' };
    if (order.paymentStatus !== 'Order') return { success: false, error: 'Order is not active' };

    const now = new Date().toISOString();
    if (targetBatchId) {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Paid', convertedAt = ? WHERE batchId = ? AND paymentStatus = 'Order'`,
        [now, targetBatchId]
      );
      const items = database.getAllSync<any>('SELECT * FROM sales WHERE batchId = ?', [targetBatchId]);
      for (const item of items) {
        const invItem = database.getFirstSync<any>('SELECT * FROM items WHERE id = ?', [item.itemId]);
        if (invItem) {
          let baseQty = item.quantity;
          let packQty = 0;
          if (item.unitType === 'pack' && invItem.unitsPerPack) {
            baseQty = item.quantity * invItem.unitsPerPack;
            packQty = item.quantity;
          }
          database.execSync(`
            UPDATE items
            SET totalBaseQuantity = totalBaseQuantity - ${baseQty},
                totalPackQuantity = totalPackQuantity - ${packQty}
            WHERE id = ${item.itemId}
          `);
        }
      }
    } else {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Paid', convertedAt = ? WHERE id = ?`,
        [now, order.id]
      );
      const invItem = database.getFirstSync<any>('SELECT * FROM items WHERE id = ?', [order.itemId]);
      if (invItem) {
        let baseQty = order.quantity;
        let packQty = 0;
        if (order.unitType === 'pack' && invItem.unitsPerPack) {
          baseQty = order.quantity * invItem.unitsPerPack;
          packQty = order.quantity;
        }
        database.execSync(`
          UPDATE items
          SET totalBaseQuantity = totalBaseQuantity - ${baseQty},
              totalPackQuantity = totalPackQuantity - ${packQty}
          WHERE id = ${order.itemId}
        `);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Convert order to sale error:', error);
    return { success: false, error: String(error) };
  }
};

export const convertOrderToDebt = (idOrBatchId: number | string): { success: boolean; error?: string } => {
  try {
    const database = getDB();
    let order: any;
    let targetBatchId: string | null;

    if (typeof idOrBatchId === 'string') {
      targetBatchId = idOrBatchId;
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE batchId = ? AND paymentStatus = ? LIMIT 1', [targetBatchId, 'Order']);
    } else {
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE id = ?', [idOrBatchId]);
      targetBatchId = order?.batchId || null;
    }
    if (!order) return { success: false, error: 'Order not found' };
    if (order.paymentStatus !== 'Order') return { success: false, error: 'Order is not active' };

    const now = new Date().toISOString();
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (targetBatchId) {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Debt', convertedAt = ?, dueDate = ? WHERE batchId = ? AND paymentStatus = 'Order'`,
        [now, dueDate, targetBatchId]
      );
    } else {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Debt', convertedAt = ?, dueDate = ? WHERE id = ?`,
        [now, dueDate, order.id]
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
    let order: any;
    let targetBatchId: string | null;

    if (typeof idOrBatchId === 'string') {
      targetBatchId = idOrBatchId;
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE batchId = ? AND paymentStatus = ? LIMIT 1', [targetBatchId, 'Order']);
    } else {
      order = database.getFirstSync<any>('SELECT * FROM sales WHERE id = ?', [idOrBatchId]);
      targetBatchId = order?.batchId || null;
    }
    if (!order) return { success: false, error: 'Order not found' };
    if (order.paymentStatus !== 'Order') return { success: false, error: 'Order is not active' };

    const now = new Date().toISOString();
    if (targetBatchId) {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Cancelled', cancelledAt = ? WHERE batchId = ? AND paymentStatus = 'Order'`,
        [now, targetBatchId]
      );
    } else {
      database.runSync(
        `UPDATE sales SET paymentStatus = 'Cancelled', cancelledAt = ? WHERE id = ?`,
        [now, order.id]
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
    const now = new Date();
    let params: any[] = [];
    let query = '';

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%H:%M', items.createdAt) as timeStr FROM items LEFT JOIN categories ON items.categoryId = categories.id WHERE date(items.createdAt) = ? ORDER BY items.createdAt DESC`;
      params = [todayStr];
    } else if (period === 'yesterday') {
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%H:%M', items.createdAt) as timeStr FROM items LEFT JOIN categories ON items.categoryId = categories.id WHERE date(items.createdAt) = ? ORDER BY items.createdAt DESC`;
      params = [yesterdayStr];
    } else if (period === 'date') {
      const dateStr = targetDate || now.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%H:%M', items.createdAt) as timeStr FROM items LEFT JOIN categories ON items.categoryId = categories.id WHERE date(items.createdAt) = ? ORDER BY items.createdAt DESC`;
      params = [dateStr];
    } else if (period === 'week') {
      const safeOffset = offset || 0;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (safeOffset * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      query = `SELECT items.*, categories.name as categoryName, strftime('%w', items.createdAt) as dayOfWeek, strftime('%Y-%m-%d', items.createdAt) as dateStr FROM items LEFT JOIN categories ON items.categoryId = categories.id WHERE date(items.createdAt) >= ? AND date(items.createdAt) <= ? ORDER BY items.createdAt DESC`;
      params = [startStr, endStr];
    } else if (period === 'month') {
      const monthOffset = offset || 0;
      const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const y = monthDate.getFullYear();
      const m = String(monthDate.getMonth() + 1).padStart(2, '0');
      query = `SELECT items.*, categories.name as categoryName, ((CAST(strftime('%d', items.createdAt) AS INTEGER) - 1) / 7 + 1) as weekNum, strftime('%Y-%m-%d', items.createdAt) as dateStr FROM items LEFT JOIN categories ON items.categoryId = categories.id WHERE strftime('%m', items.createdAt) = ? AND strftime('%Y', items.createdAt) = ? ORDER BY items.createdAt`;
      params = [m, y];
    } else if (period === 'year') {
      const yearOffset = offset || 0;
      const yearDate = new Date(now.getFullYear() + yearOffset, 0, 1);
      const yearStr = yearDate.getFullYear().toString();
      query = `SELECT items.*, categories.name as categoryName, CAST(strftime('%m', items.createdAt) AS INTEGER) as monthNum, strftime('%Y-%m-%d', items.createdAt) as dateStr FROM items LEFT JOIN categories ON items.categoryId = categories.id WHERE strftime('%Y', items.createdAt) = ? ORDER BY items.createdAt`;
      params = [yearStr];
    }

    return database.getAllSync(query, params);
  } catch (error) {
    console.error('Get latest items by period error:', error);
    return [];
  }
};

// →→ Budget Functions →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const DEFAULT_BUDGET_CATEGORIES = [
  'employee_salaries_labor',
  'rent',
  'utilities_electricity_water_internet',
  'inventory_purchases',
  'marketing_advertising',
];

export const insertBudget = (data: {
  name: string;
  type: 'business' | 'department' | 'project' | 'branch';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  year: number;
  month?: number;
  quarter?: number;
  notes?: string;
}) => {
  try {
    const database = getDB();
    const result = database.runSync(
      `INSERT INTO budgets (name, type, period, year, month, quarter, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      data.name,
      data.type,
      data.period,
      data.year,
      data.month || null,
      data.quarter || null,
      data.notes || null
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert budget error:', error);
    return null;
  }
};

export const updateBudget = (id: number, data: {
  name?: string;
  notes?: string;
  status?: 'active' | 'archived' | 'closed';
}) => {
  try {
    const database = getDB();
    const updates: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    updates.push("updatedAt = datetime('now')");
    params.push(id);
    if (updates.length > 1) {
      database.runSync(`UPDATE budgets SET ${updates.join(', ')} WHERE id = ?`, ...params);
    }
    return true;
  } catch (error) {
    console.error('Update budget error:', error);
    return false;
  }
};

export const getBudgets = (filters?: {
  type?: string;
  period?: string;
  year?: number;
  month?: number;
  status?: string;
}) => {
  try {
    const database = getDB();
    const conditions: string[] = [];
    const params: any[] = [];
    if (filters?.type) { conditions.push('b.type = ?'); params.push(filters.type); }
    if (filters?.period) { conditions.push('b.period = ?'); params.push(filters.period); }
    if (filters?.year) { conditions.push('b.year = ?'); params.push(filters.year); }
    if (filters?.month) { conditions.push('b.month = ?'); params.push(filters.month); }
    if (filters?.status) { conditions.push('b.status = ?'); params.push(filters.status); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return database.getAllSync(`
      SELECT
        b.*,
        COALESCE(SUM(bc.plannedAmount), 0) as totalPlanned,
        COALESCE((
          SELECT SUM(e.amount) FROM expenses e
          JOIN budget_categories bc2 ON e.budgetCategoryId = bc2.id
          WHERE bc2.budgetId = b.id AND e.date >= date('now', '-1 year')
        ), 0) as totalActual
      FROM budgets b
      LEFT JOIN budget_categories bc ON bc.budgetId = b.id
      ${where}
      GROUP BY b.id
      ORDER BY b.year DESC, COALESCE(b.month, 0) DESC, b.createdAt DESC
    `, params);
  } catch (error) {
    console.error('Get budgets error:', error);
    return [];
  }
};

export const getBudgetById = (id: number) => {
  try {
    const database = getDB();
    const budget = database.getFirstSync<any>('SELECT * FROM budgets WHERE id = ?', [id]);
    if (!budget) return null;

    const categories = database.getAllSync(`
      SELECT
        bc.*,
        COALESCE((
          SELECT SUM(e.amount) FROM expenses e
          WHERE e.budgetCategoryId = bc.id
            AND e.date >= date('now', '-1 year')
        ), 0) as actualAmount,
        COALESCE((
          SELECT COUNT(*) FROM budget_adjustments ba
          WHERE ba.budgetCategoryId = bc.id
        ), 0) as adjustmentCount
      FROM budget_categories bc
      WHERE bc.budgetId = ?
      ORDER BY bc.category ASC
    `, [id]);

    const totalPlanned = categories.reduce((s: number, c: any) => s + c.plannedAmount, 0);
    const totalActual = categories.reduce((s: number, c: any) => s + c.actualAmount, 0);

    return { ...budget, categories, totalPlanned, totalActual, remaining: totalPlanned - totalActual };
  } catch (error) {
    console.error('Get budget by ID error:', error);
    return null;
  }
};

export const deleteBudget = (id: number) => {
  try {
    const database = getDB();
    const catIds = database.getAllSync<any>('SELECT id FROM budget_categories WHERE budgetId = ?', [id]);
    const ids = catIds.map((c: any) => c.id);
    if (ids.length > 0) {
      const ph = ids.map(() => '?').join(',');
      database.runSync(`UPDATE expenses SET budgetCategoryId = NULL WHERE budgetCategoryId IN (${ph})`, ...ids);
      database.runSync(`UPDATE recurring_expense_templates SET budgetCategoryId = NULL WHERE budgetCategoryId IN (${ph})`, ...ids);
      database.runSync(`DELETE FROM budget_adjustments WHERE budgetCategoryId IN (${ph})`, ...ids);
      database.runSync(`DELETE FROM budget_categories WHERE id IN (${ph})`, ...ids);
    }
    database.runSync('DELETE FROM budgets WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Delete budget error:', error);
    return false;
  }
};

export const insertBudgetCategory = (budgetId: number, data: {
  category: string;
  plannedAmount: number;
  notes?: string;
}) => {
  try {
    const database = getDB();
    const result = database.runSync(
      `INSERT INTO budget_categories (budgetId, category, plannedAmount, notes) VALUES (?, ?, ?, ?)`,
      budgetId, data.category, data.plannedAmount, data.notes || null
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert budget category error:', error);
    return null;
  }
};

export const updateBudgetCategory = (id: number, data: {
  plannedAmount?: number;
  notes?: string;
}) => {
  try {
    const database = getDB();
    const updates: string[] = [];
    const params: any[] = [];
    if (data.plannedAmount !== undefined) { updates.push('plannedAmount = ?'); params.push(data.plannedAmount); }
    if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes); }
    params.push(id);
    if (updates.length > 0) {
      database.runSync(`UPDATE budget_categories SET ${updates.join(', ')} WHERE id = ?`, ...params);
    }
    return true;
  } catch (error) {
    console.error('Update budget category error:', error);
    return false;
  }
};

export const deleteBudgetCategory = (id: number) => {
  try {
    const database = getDB();
    database.runSync('DELETE FROM budget_categories WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Delete budget category error:', error);
    return false;
  }
};

export const getBudgetDashboard = () => {
  try {
    const database = getDB();
    const activeBudgets = database.getAllSync<any>(`
      SELECT b.*,
        COALESCE(SUM(bc.plannedAmount), 0) as totalPlanned,
        COALESCE((
          SELECT SUM(e.amount) FROM expenses e
          JOIN budget_categories bc3 ON e.budgetCategoryId = bc3.id
          WHERE bc3.budgetId = b.id
        ), 0) as totalActual
      FROM budgets b
      LEFT JOIN budget_categories bc ON bc.budgetId = b.id
      WHERE b.status = 'active'
      GROUP BY b.id
      ORDER BY b.createdAt DESC
    `);

    const totalBudget = activeBudgets.reduce((s: number, b: any) => s + (b.totalPlanned || 0), 0);
    const totalSpent = activeBudgets.reduce((s: number, b: any) => s + (b.totalActual || 0), 0);
    const remaining = totalBudget - totalSpent;
    const healthScore = totalBudget > 0 ? Math.max(0, Math.min(100, Math.round((1 - totalSpent / totalBudget) * 100))) : 100;

    // Top spending categories across all active budgets
    const topCategories = database.getAllSync(`
      SELECT bc.category, SUM(e.amount) as spent, SUM(bc.plannedAmount) as planned
      FROM expenses e
      JOIN budget_categories bc ON e.budgetCategoryId = bc.id
      JOIN budgets b ON bc.budgetId = b.id
      WHERE b.status = 'active'
      GROUP BY bc.category
      ORDER BY spent DESC
      LIMIT 5
    `);

    return { activeBudgets, totalBudget, totalSpent, remaining, healthScore, topCategories };
  } catch (error) {
    console.error('Get budget dashboard error:', error);
    return null;
  }
};

export const getBudgetCategorySpending = (budgetId: number) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT
        bc.id, bc.category, bc.plannedAmount,
        COALESCE(SUM(e.amount), 0) as actualAmount,
        COUNT(e.id) as expenseCount
      FROM budget_categories bc
      LEFT JOIN expenses e ON e.budgetCategoryId = bc.id
      WHERE bc.budgetId = ?
      GROUP BY bc.id
      ORDER BY bc.category ASC
    `, [budgetId]);
  } catch (error) {
    console.error('Get budget category spending error:', error);
    return [];
  }
};

export const getBudgetMonthlyTrends = (budgetId: number) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT
        strftime('%Y-%m', e.date) as month,
        SUM(e.amount) as actual
      FROM expenses e
      JOIN budget_categories bc ON e.budgetCategoryId = bc.id
      WHERE bc.budgetId = ?
      GROUP BY strftime('%Y-%m', e.date)
      ORDER BY month ASC
    `, [budgetId]);
  } catch (error) {
    console.error('Get budget monthly trends error:', error);
    return [];
  }
};

export const duplicateBudget = (sourceId: number, month?: number, year?: number) => {
  try {
    const database = getDB();
    const source = database.getFirstSync<any>('SELECT * FROM budgets WHERE id = ?', [sourceId]);
    if (!source) return null;

    const newMonth = month || source.month;
    const newYear = year || source.year;

    // Create new budget
    const result = database.runSync(
      `INSERT INTO budgets (name, type, period, year, month, quarter, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      source.name, source.type, source.period, newYear, newMonth, source.quarter, source.notes
    );
    const newId = result.lastInsertRowId;

    // Copy categories
    const categories = database.getAllSync<any>(
      'SELECT category, plannedAmount, notes FROM budget_categories WHERE budgetId = ?',
      [sourceId]
    );
    for (const cat of categories) {
      database.runSync(
        `INSERT INTO budget_categories (budgetId, category, plannedAmount, notes) VALUES (?, ?, ?, ?)`,
        newId, cat.category, cat.plannedAmount, cat.notes
      );
    }

    return newId;
  } catch (error) {
    console.error('Duplicate budget error:', error);
    return null;
  }
};

export const adjustBudgetCategory = (
  categoryId: number,
  newAmount: number,
  reason: string,
  approvedBy?: string
): { success: boolean; error?: string } => {
  try {
    const database = getDB();
    const current = database.getFirstSync<any>('SELECT plannedAmount FROM budget_categories WHERE id = ?', [categoryId]);
    if (!current) return { success: false, error: 'Category not found' };

    const previousAmount = current.plannedAmount;

    database.runSync(
      `INSERT INTO budget_adjustments (budgetCategoryId, previousAmount, newAmount, reason, approvedBy, status) VALUES (?, ?, ?, ?, ?, 'approved')`,
      categoryId, previousAmount, newAmount, reason, approvedBy || null
    );
    database.runSync('UPDATE budget_categories SET plannedAmount = ? WHERE id = ?', [newAmount, categoryId]);
    // Touch parent budget updatedAt
    const bc = database.getFirstSync<any>('SELECT budgetId FROM budget_categories WHERE id = ?', [categoryId]);
    if (bc) database.runSync("UPDATE budgets SET updatedAt = datetime('now') WHERE id = ?", [bc.budgetId]);

    return { success: true };
  } catch (error) {
    console.error('Adjust budget category error:', error);
    return { success: false, error: String(error) };
  }
};

export const getBudgetForecast = (budgetId: number) => {
  try {
    const database = getDB();
    const categories = database.getAllSync<any>(
      'SELECT id, category, plannedAmount FROM budget_categories WHERE budgetId = ?', [budgetId]
    );

    const forecast = categories.map((cat: any) => {
      const history = database.getAllSync<any>(
        `SELECT strftime('%Y-%m', e.date) as month, SUM(e.amount) as total
         FROM expenses e WHERE e.budgetCategoryId = ?
         GROUP BY strftime('%Y-%m', e.date)
         ORDER BY month ASC`,
        [cat.id]
      );

      const avgMonthly = history.length > 0
        ? history.reduce((s: number, h: any) => s + h.total, 0) / history.length
        : 0;

      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const today = new Date().getDate();
      const projected = avgMonthly * (daysInMonth / Math.max(today, 1));

      return {
        id: cat.id,
        category: cat.category,
        planned: cat.plannedAmount,
        averageMonthly: Math.round(avgMonthly),
        projected: Math.round(projected),
        remaining: cat.plannedAmount - projected,
        status: projected > cat.plannedAmount ? 'over' : projected > cat.plannedAmount * 0.8 ? 'near' : 'within',
      };
    });

    const totalPlanned = categories.reduce((s: number, c: any) => s + c.plannedAmount, 0);
    const totalProjected = forecast.reduce((s: number, f: any) => s + f.projected, 0);

    return { forecast, totalPlanned, totalProjected, totalRemaining: totalPlanned - totalProjected };
  } catch (error) {
    console.error('Get budget forecast error:', error);
    return null;
  }
};

export const getBudgetReportData = (budgetId: number) => {
  try {
    const budget = getBudgetById(budgetId);
    if (!budget) return null;

    const trends = getBudgetMonthlyTrends(budgetId);
    const spending = getBudgetCategorySpending(budgetId);

    return { budget, trends, spending };
  } catch (error) {
    console.error('Get budget report data error:', error);
    return null;
  }
};

export const getBudgetAlerts = (thresholdPercent: number = 80) => {
  try {
    const database = getDB();
    const categories = database.getAllSync<any>(`
      SELECT
        bc.id, bc.category, bc.plannedAmount, bc.budgetId,
        COALESCE(SUM(e.amount), 0) as spent,
        b.name as budgetName
      FROM budget_categories bc
      JOIN budgets b ON bc.budgetId = b.id
      LEFT JOIN expenses e ON e.budgetCategoryId = bc.id
      WHERE b.status = 'active'
      GROUP BY bc.id
      HAVING bc.plannedAmount > 0
        AND (spent >= bc.plannedAmount * (CAST(? AS REAL) / 100.0) OR spent > bc.plannedAmount)
      ORDER BY (CAST(spent AS REAL) / bc.plannedAmount) DESC
    `, [thresholdPercent]);

    return categories.map((c: any) => {
      const pct = c.plannedAmount > 0 ? Math.round((c.spent / c.plannedAmount) * 100) : 0;
      return {
        ...c,
        percentUsed: pct,
        isExceeded: c.spent >= c.plannedAmount,
        level: c.spent >= c.plannedAmount ? 'exceeded' : pct >= thresholdPercent ? 'warning' : 'ok',
      };
    });
  } catch (error) {
    console.error('Get budget alerts error:', error);
    return [];
  }
};

export const connectExpenseToBudget = (expenseId: number, budgetCategoryId: number) => {
  try {
    const database = getDB();
    database.runSync('UPDATE expenses SET budgetCategoryId = ? WHERE id = ?', [budgetCategoryId, expenseId]);
    return true;
  } catch (error) {
    console.error('Connect expense to budget error:', error);
    return false;
  }
};

export const getUncategorizedExpenses = (budgetId: number) => {
  try {
    const database = getDB();
    const categories = database.getAllSync<any>(
      'SELECT category FROM budget_categories WHERE budgetId = ?', [budgetId]
    );
    const categoryNames = categories.map((c: any) => c.category);
    if (categoryNames.length === 0) return [];

    const placeholders = categoryNames.map(() => '?').join(',');
    return database.getAllSync(
      `SELECT * FROM expenses WHERE category NOT IN (${placeholders}) AND date >= date('now', '-1 year') ORDER BY date DESC LIMIT 50`,
      categoryNames
    );
  } catch (error) {
    console.error('Get uncategorized expenses error:', error);
    return [];
  }
};

// →→ Recurring Expense Templates →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const insertRecurringTemplate = (data: {
  name: string; category: string; amount: number;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  startDate: string; endDate?: string; budgetCategoryId?: number;
}) => {
  try {
    const database = getDB();
    const result = database.runSync(
      `INSERT INTO recurring_expense_templates (name, category, amount, frequency, startDate, endDate, budgetCategoryId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      data.name, data.category, data.amount, data.frequency, data.startDate,
      data.endDate || null, data.budgetCategoryId || null
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert recurring template error:', error);
    return null;
  }
};

export const updateRecurringTemplate = (id: number, data: {
  name?: string; category?: string; amount?: number;
  frequency?: string; startDate?: string; endDate?: string;
  budgetCategoryId?: number; isActive?: number;
}) => {
  try {
    const database = getDB();
    const updates: string[] = [];
    const params: any[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { updates.push(`${k} = ?`); params.push(v); }
    }
    if (updates.length === 0) return true;
    params.push(id);
    database.runSync(`UPDATE recurring_expense_templates SET ${updates.join(', ')} WHERE id = ?`, ...params);
    return true;
  } catch (error) {
    console.error('Update recurring template error:', error);
    return false;
  }
};

export const getRecurringTemplates = (activeOnly?: boolean) => {
  try {
    const database = getDB();
    const where = activeOnly ? 'WHERE isActive = 1' : '';
    return database.getAllSync(
      `SELECT rt.*, bc.category as budgetCategoryName, bc.plannedAmount as budgetPlanned
       FROM recurring_expense_templates rt
       LEFT JOIN budget_categories bc ON rt.budgetCategoryId = bc.id
       ${where}
       ORDER BY rt.name ASC`
    );
  } catch (error) {
    console.error('Get recurring templates error:', error);
    return [];
  }
};

export const deleteRecurringTemplate = (id: number) => {
  try {
    const database = getDB();
    database.runSync('DELETE FROM recurring_expense_templates WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Delete recurring template error:', error);
    return false;
  }
};

// →→ Budget-Expense Integration Helpers →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const getCurrentMonthBudget = () => {
  try {
    const database = getDB();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const budget = database.getFirstSync<any>(
      `SELECT b.*,
        COALESCE(SUM(bc.plannedAmount), 0) as totalPlanned,
        COALESCE(SUM(bc2.actualAmount), 0) as totalActual
       FROM budgets b
       LEFT JOIN budget_categories bc ON bc.budgetId = b.id
       LEFT JOIN (
         SELECT bc3.id as catId, SUM(e.amount) as actualAmount
         FROM budget_categories bc3
         LEFT JOIN expenses e ON e.budgetCategoryId = bc3.id
           AND strftime('%Y-%m', e.date) = ?
         GROUP BY bc3.id
       ) bc2 ON bc2.catId = bc.id
       WHERE b.year = ? AND (b.month = ? OR b.month IS NULL)
         AND b.period = 'monthly' AND b.status = 'active'
       GROUP BY b.id
       ORDER BY b.month DESC
       LIMIT 1`,
      [`${year}-${String(month).padStart(2, '0')}`, year, month]
    );
    if (!budget) return null;
    return { ...budget, remaining: budget.totalPlanned - budget.totalActual };
  } catch (error) {
    console.error('Get current month budget error:', error);
    return null;
  }
};

export const getCategoryBudgetStatus = (budgetId: number, categoryName: string) => {
  try {
    const database = getDB();
    const cat = database.getFirstSync<any>(
      `SELECT bc.*,
        COALESCE(SUM(e.amount), 0) as spent
       FROM budget_categories bc
       LEFT JOIN expenses e ON e.budgetCategoryId = bc.id
       WHERE bc.budgetId = ? AND bc.category = ?
       GROUP BY bc.id`,
      [budgetId, categoryName]
    );
    if (!cat) return null;
    const pct = cat.plannedAmount > 0 ? Math.round((cat.spent / cat.plannedAmount) * 100) : 0;
    return {
      ...cat, spent: cat.spent, percentUsed: pct,
      remaining: cat.plannedAmount - cat.spent,
      status: pct >= 100 ? 'exceeded' : pct >= 90 ? 'critical' : pct >= 80 ? 'warning' : 'ok',
    };
  } catch (error) {
    console.error('Get category budget status error:', error);
    return null;
  }
};

export const getBudgetExpensesForCategory = (budgetCategoryId: number, limit: number = 50) => {
  try {
    const database = getDB();
    return database.getAllSync(
      `SELECT * FROM expenses WHERE budgetCategoryId = ? ORDER BY date DESC LIMIT ?`,
      [budgetCategoryId, limit]
    );
  } catch (error) {
    console.error('Get budget expenses for category error:', error);
    return [];
  }
};

export const getBudgetWithCategoryProgress = (budgetId: number) => {
  try {
    const database = getDB();
    const budget = database.getFirstSync<any>('SELECT * FROM budgets WHERE id = ?', [budgetId]);
    if (!budget) return null;

    const categories = database.getAllSync(`
      SELECT bc.*,
        COALESCE(SUM(e.amount), 0) as spent,
        COUNT(e.id) as expenseCount
      FROM budget_categories bc
      LEFT JOIN expenses e ON e.budgetCategoryId = bc.id
      WHERE bc.budgetId = ?
      GROUP BY bc.id
      ORDER BY bc.category ASC
    `, [budgetId]);

    const totalPlanned = categories.reduce((s: number, c: any) => s + c.plannedAmount, 0);
    const totalSpent = categories.reduce((s: number, c: any) => s + (c.spent || 0), 0);

    const categoriesWithStatus = categories.map((c: any) => {
      const pct = c.plannedAmount > 0 ? Math.round((c.spent / c.plannedAmount) * 100) : 0;
      return {
        ...c,
        percentUsed: pct,
        remaining: c.plannedAmount - (c.spent || 0),
        status: pct >= 100 ? 'exceeded' : pct >= 90 ? 'critical' : pct >= 80 ? 'warning' : 'ok',
      };
    });

    return {
      ...budget,
      categories: categoriesWithStatus,
      totalPlanned,
      totalSpent,
      remaining: totalPlanned - totalSpent,
      percentUsed: totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0,
    };
  } catch (error) {
    console.error('Get budget with category progress error:', error);
    return null;
  }
};

export const getMonthlyBudgetSummary = (year: number, month: number) => {
  try {
    const database = getDB();
    const yymm = `${year}-${String(month).padStart(2, '0')}`;

    const budget = database.getFirstSync<any>(
      `SELECT b.*, COALESCE(SUM(bc.plannedAmount), 0) as totalPlanned
       FROM budgets b
       LEFT JOIN budget_categories bc ON bc.budgetId = b.id
       WHERE b.year = ? AND b.month = ? AND b.status = 'active' AND b.period = 'monthly'
       GROUP BY b.id
       LIMIT 1`,
      [year, month]
    );

    const totalSpent = database.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', date) = ?`,
      [yymm]
    );

    const byCategory = database.getAllSync(
      `SELECT e.category as name, SUM(e.amount) as spent,
        COALESCE(bc.plannedAmount, 0) as planned
       FROM expenses e
       LEFT JOIN budget_categories bc ON e.budgetCategoryId = bc.id
       WHERE strftime('%Y-%m', e.date) = ?
       GROUP BY e.category
       ORDER BY spent DESC`,
      [yymm]
    );

    const totalPlanned = budget?.totalPlanned || 0;
    const actual = totalSpent?.total || 0;

    const projection = getRecurringProjection();
    const projectedTotal = actual + projection.monthlyTotal;

    return {
      hasBudget: !!budget,
      budgetId: budget?.id,
      budgetName: budget?.name,
      totalPlanned,
      totalSpent: actual,
      remaining: totalPlanned - actual,
      percentUsed: totalPlanned > 0 ? Math.round((actual / totalPlanned) * 100) : 0,
      projectedRemaining: totalPlanned - projectedTotal,
      projectedPercent: totalPlanned > 0 ? Math.round((projectedTotal / totalPlanned) * 100) : 0,
      recurringMonthlyProjection: projection.monthlyTotal,
      recurringTemplateCount: projection.templatesCount,
      byCategory,
    };
  } catch (error) {
    console.error('Get monthly budget summary error:', error);
    return null;
  }
};

export const getUpcomingRecurringExpensesTotal = () => {
  try {
    const database = getDB();
    const result = database.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM recurring_expense_templates WHERE isActive = 1`
    );
    return result?.total || 0;
  } catch (error) {
    console.error('Get upcoming recurring expenses total error:', error);
    return 0;
  }
};

export const getRecurringProjection = () => {
  try {
    const database = getDB();
    const templates = database.getAllSync<any>(
      `SELECT * FROM recurring_expense_templates WHERE isActive = 1`
    );

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let monthlyTotal = 0;
    const byCategory: Record<string, number> = {};

    for (const tmpl of templates) {
      let monthlyAmount = 0;
      switch (tmpl.frequency) {
        case 'Daily': monthlyAmount = tmpl.amount * daysInMonth; break;
        case 'Weekly': monthlyAmount = tmpl.amount * (daysInMonth / 7); break;
        case 'Monthly': monthlyAmount = tmpl.amount; break;
        case 'Quarterly': monthlyAmount = tmpl.amount / 3; break;
        case 'Yearly': monthlyAmount = tmpl.amount / 12; break;
      }
      monthlyTotal += monthlyAmount;
      byCategory[tmpl.category] = (byCategory[tmpl.category] || 0) + monthlyAmount;
    }

    return {
      templatesCount: templates.length,
      monthlyTotal: Math.round(monthlyTotal),
      byCategory,
      dailyProjection: Math.round(templates.reduce((s: number, t: any) => {
        if (t.frequency === 'Daily') return s + t.amount;
        if (t.frequency === 'Weekly') return s + t.amount / 7;
        if (t.frequency === 'Monthly') return s + t.amount / daysInMonth;
        if (t.frequency === 'Quarterly') return s + t.amount / (daysInMonth * 3);
        return s + t.amount / (daysInMonth * 12);
      }, 0)),
    };
  } catch (error) {
    console.error('Get recurring projection error:', error);
    return { templatesCount: 0, monthlyTotal: 0, byCategory: {}, dailyProjection: 0 };
  }
};

export const getRecommendedBudget = () => {
  try {
    const database = getDB();
    const templates = database.getAllSync<any>(
      `SELECT * FROM recurring_expense_templates WHERE isActive = 1`
    );

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const categoryMap: Record<string, { amount: number; count: number; frequencies: string[] }> = {};

    for (const tmpl of templates) {
      let monthlyAmount = 0;
      switch (tmpl.frequency) {
        case 'Daily': monthlyAmount = tmpl.amount * daysInMonth; break;
        case 'Weekly': monthlyAmount = tmpl.amount * (daysInMonth / 7); break;
        case 'Monthly': monthlyAmount = tmpl.amount; break;
        case 'Quarterly': monthlyAmount = tmpl.amount / 3; break;
        case 'Yearly': monthlyAmount = tmpl.amount / 12; break;
      }
      if (!categoryMap[tmpl.category]) {
        categoryMap[tmpl.category] = { amount: 0, count: 0, frequencies: [] };
      }
      categoryMap[tmpl.category].amount += monthlyAmount;
      categoryMap[tmpl.category].count += 1;
      if (!categoryMap[tmpl.category].frequencies.includes(tmpl.frequency)) {
        categoryMap[tmpl.category].frequencies.push(tmpl.frequency);
      }
    }

    const categories = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      recommendedAmount: Math.round(data.amount * 1.1),
      baseRecurringAmount: Math.round(data.amount),
      templateCount: data.count,
      frequencies: data.frequencies,
      buffer: Math.round(data.amount * 0.1),
    }));

    const totalRecommended = categories.reduce((s, c) => s + c.recommendedAmount, 0);
    const totalRecurring = categories.reduce((s, c) => s + c.baseRecurringAmount, 0);

    return {
      categories,
      totalRecommended,
      totalRecurring,
      bufferTotal: totalRecommended - totalRecurring,
      templateCount: templates.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Get recommended budget error:', error);
    return null;
  }
};

export const getBudgetWithRecurringProjection = (budgetId: number) => {
  try {
    const database = getDB();
    const budget = database.getFirstSync<any>('SELECT * FROM budgets WHERE id = ?', [budgetId]);
    if (!budget) return null;

    const categories = database.getAllSync<any>(
      `SELECT bc.*,
        COALESCE(SUM(e.amount), 0) as spent,
        COUNT(e.id) as expenseCount
       FROM budget_categories bc
       LEFT JOIN expenses e ON e.budgetCategoryId = bc.id
       WHERE bc.budgetId = ?
       GROUP BY bc.id
       ORDER BY bc.category ASC`,
      [budgetId]
    );

    const projection = getRecurringProjection();
    const totalPlanned = categories.reduce((s: number, c: any) => s + c.plannedAmount, 0);
    const totalSpent = categories.reduce((s: number, c: any) => s + (c.spent || 0), 0);

    const categoriesWithStatus = categories.map((c: any) => {
      const pct = c.plannedAmount > 0 ? Math.round((c.spent / c.plannedAmount) * 100) : 0;
      const recurringMonthly = projection.byCategory[c.category] || 0;
      const projectedTotal = c.spent + recurringMonthly;
      const projectedPct = c.plannedAmount > 0 ? Math.round((projectedTotal / c.plannedAmount) * 100) : 0;
      return {
        ...c,
        percentUsed: pct,
        remaining: c.plannedAmount - (c.spent || 0),
        recurringProjection: Math.round(recurringMonthly),
        projectedTotal: Math.round(projectedTotal),
        projectedPercent: projectedPct,
        status: pct >= 100 ? 'exceeded' : pct >= 90 ? 'critical' : pct >= 80 ? 'warning' : 'ok',
      };
    });

    return {
      ...budget,
      categories: categoriesWithStatus,
      totalPlanned,
      totalSpent,
      remaining: totalPlanned - totalSpent,
      percentUsed: totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0,
      recurringProjection: projection,
      projectedTotal: totalSpent + projection.monthlyTotal,
      projectedPercent: totalPlanned > 0 ? Math.round(((totalSpent + projection.monthlyTotal) / totalPlanned) * 100) : 0,
    };
  } catch (error) {
    console.error('Get budget with recurring projection error:', error);
    return null;
  }
};

// →→ Auto Budget Linking →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const autoLinkExpenseToBudget = (
  category: string,
  date: string,
  budgetId?: number
): { budgetCategoryId: number | null; ambiguousCategories?: any[] } => {
  try {
    const database = getDB();
    const expenseDate = new Date(date);
    const year = expenseDate.getFullYear();
    const month = expenseDate.getMonth() + 1;

    let budgetIds: number[];
    if (budgetId) {
      budgetIds = [budgetId];
    } else {
      const activeBudgets = database.getAllSync<any>(
        `SELECT id, name, period FROM budgets 
         WHERE status = 'active' AND year = ? AND (month = ? OR month IS NULL)`,
        [year, month]
      );
      if (activeBudgets.length === 0) return { budgetCategoryId: null };
      budgetIds = activeBudgets.map((b: any) => b.id);
    }

    const placeholders = budgetIds.map(() => '?').join(',');

    const matchingCategories = database.getAllSync<any>(
      `SELECT id, category, plannedAmount, budgetId FROM budget_categories 
       WHERE budgetId IN (${placeholders}) AND LOWER(category) = LOWER(?)`,
      [...budgetIds, category]
    );

    if (matchingCategories.length === 1) {
      return { budgetCategoryId: matchingCategories[0].id };
    }
    if (matchingCategories.length > 1) {
      return { budgetCategoryId: null, ambiguousCategories: matchingCategories };
    }

    const partialMatches = database.getAllSync<any>(
      `SELECT bc.id, bc.category, bc.plannedAmount, b.name as budgetName
       FROM budget_categories bc JOIN budgets b ON bc.budgetId = b.id
       WHERE b.id IN (${placeholders})
         AND (LOWER(bc.category) LIKE LOWER(?) OR LOWER(?) LIKE '%' || LOWER(bc.category) || '%')
       LIMIT 5`,
      [...budgetIds, `%${category}%`, category]
    );

    if (partialMatches.length === 1) {
      return { budgetCategoryId: partialMatches[0].id };
    }

    return { budgetCategoryId: null };
  } catch (error) {
    console.error('Auto-link expense to budget error:', error);
    return { budgetCategoryId: null };
  }
};

export const getBudgetStatusForCategory = (
  category: string,
  date: string
): {
  budgetName: string; budgetCategoryId: number; planned: number;
  spent: number; remaining: number; percentUsed: number; status: string
} | null => {
  try {
    const database = getDB();
    const expenseDate = new Date(date);
    const year = expenseDate.getFullYear();
    const month = expenseDate.getMonth() + 1;
    const yymm = `${year}-${String(month).padStart(2, '0')}`;

    const budget = database.getFirstSync<any>(
      `SELECT b.id as budgetId, b.name as budgetName, bc.id as catId, bc.plannedAmount, bc.category
       FROM budgets b JOIN budget_categories bc ON bc.budgetId = b.id
       WHERE b.status = 'active' AND b.year = ? AND (b.month = ? OR b.month IS NULL)
         AND LOWER(bc.category) = LOWER(?) LIMIT 1`,
      [year, month, category]
    );
    if (!budget) return null;

    const spent = database.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE budgetCategoryId = ? AND strftime('%Y-%m', date) = ?`,
      [budget.catId, yymm]
    );

    const spentAmount = spent?.total || 0;
    const pct = budget.plannedAmount > 0 ? Math.round((spentAmount / budget.plannedAmount) * 100) : 0;

    return {
      budgetName: budget.budgetName,
      budgetCategoryId: budget.catId,
      planned: budget.plannedAmount,
      spent: spentAmount,
      remaining: budget.plannedAmount - spentAmount,
      percentUsed: pct,
      status: pct >= 100 ? 'exceeded' : pct >= 90 ? 'critical' : pct >= 80 ? 'warning' : 'ok',
    };
  } catch (error) {
    console.error('Get budget status for category error:', error);
    return null;
  }
};

export const getCategoryExpenses = (budgetCategoryId: number, limit: number = 100) => {
  try {
    const database = getDB();
    return database.getAllSync(
      'SELECT * FROM expenses WHERE budgetCategoryId = ? ORDER BY date DESC LIMIT ?',
      [budgetCategoryId, limit]
    );
  } catch (error) {
    console.error('Get category expenses error:', error);
    return [];
  }
};

export const getBudgetThresholdNotifications = (threshold: number = 80) => {
  try {
    const database = getDB();
    const now = new Date();
    const yymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return database.getAllSync<any>(
      `SELECT bc.id, bc.category, bc.plannedAmount, b.name as budgetName,
              COALESCE(SUM(e.amount), 0) as spent
       FROM budget_categories bc
       JOIN budgets b ON bc.budgetId = b.id
       LEFT JOIN expenses e ON e.budgetCategoryId = bc.id
         AND strftime('%Y-%m', e.date) = ?
       WHERE b.status = 'active'
         AND bc.plannedAmount > 0
       GROUP BY bc.id
       HAVING (CAST(SUM(e.amount) AS REAL) / bc.plannedAmount) >= CAST(? AS REAL) / 100.0`,
      [yymm, threshold]
    );
  } catch (error) {
    console.error('Get budget threshold notifications error:', error);
    return [];
  }
};

// →→ Subscription Functions →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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

export const updateSubscriptionPlan = (plan: string, durationMonths: number, price: number): boolean => {
  try {
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

export const isPremiumFeatureUnlocked = (feature: string): boolean => {
  try {
    const sub = checkAndExpireSubscription();
    if (!sub) return false;
    if (sub.status === 'trial') return true;
    if (sub.status !== 'active') return false;
    return sub.plan === 'premium';
  } catch (error) {
    console.error('Is premium feature unlocked error:', error);
    return false;
  }
};