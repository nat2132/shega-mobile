import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = () => {
  if (!db) {
    db = SQLite.openDatabaseSync('shegabe.db');
  }
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
    } catch (e) {
      // Column probably already exists, which is fine
    }
  }

  // Migration for sales table
  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN unitType TEXT DEFAULT 'base';`);
    console.log('Successfully migrated sales table: Added unitType');
  } catch (e) {}

  try {
    database.execSync(`ALTER TABLE sales ADD COLUMN dueDate TEXT;`);
    database.execSync(`ALTER TABLE sales ADD COLUMN paidAmount REAL DEFAULT 0;`);
    console.log('Successfully migrated sales table: Added dueDate and paidAmount');
  } catch (e) {}

  // Migration for items table
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN dueDate TEXT;`);
    console.log('Successfully migrated items table: Added dueDate');
  } catch (e) {}

  // Migration: supplier call toggle + last price-change tracking for weekly supplier check
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN supplierCallEnabled INTEGER DEFAULT 0;`);
    console.log('Successfully migrated items table: Added supplierCallEnabled');
  } catch (e) {}
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN lastPriceCheckAt TEXT;`);
    console.log('Successfully migrated items table: Added lastPriceCheckAt');
  } catch (e) {}
};

export const initDB = () => {
  try {
    const database = getDB();
    database.execSync('PRAGMA foreign_keys = ON');
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
    
    // Perform migration for existing users
    migrateItemsTable(database);
    
    console.log('Table "items" checked/created/migrated.');

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
    } catch (e) {}

  // Migration: Add warehouseId to items table
  try {
    database.execSync(`ALTER TABLE items ADD COLUMN warehouseId INTEGER REFERENCES warehouses(id);`);
    console.log('Successfully migrated items table: Added warehouseId');
  } catch (e) {}

  // Migration: Add recurring expense tracking columns
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN isOverdue INTEGER DEFAULT 0;`);
    console.log('Successfully migrated expenses table: Added isOverdue');
  } catch (e) {}
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN overdueDays INTEGER DEFAULT 0;`);
    console.log('Successfully migrated expenses table: Added overdueDays');
  } catch (e) {}
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN lastNotified TEXT;`);
    console.log('Successfully migrated expenses table: Added lastNotified');
  } catch (e) {}
  try {
    database.execSync(`ALTER TABLE expenses ADD COLUMN paymentStatus TEXT DEFAULT 'pending';`);
    console.log('Successfully migrated expenses table: Added paymentStatus');
  } catch (e) {}

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
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (saleId) REFERENCES sales(id),
      FOREIGN KEY (itemId) REFERENCES items(id)
    );
  `);
  console.log('Table "returns" checked/created.');

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
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(createdAt);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales(paymentStatus);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customerName);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_items_quantity ON items(totalBaseQuantity);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_items_warehouse ON items(warehouseId);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);
  database.execSync(`CREATE INDEX IF NOT EXISTS idx_adjustments_created ON adjustments(createdAt);`);

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
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
  packId?: number;
}) => {
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
    
    // Insert the sale record
    const statement = database.prepareSync(`
      INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, packId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = statement.executeSync([
      saleData.itemId, saleData.quantity, saleData.unit, saleData.unitType,
      saleData.discount || 0, saleData.vat || 0, saleData.totalPrice,
      saleData.paymentMethod || null, saleData.paymentStatus || 'Paid',
      saleData.customerName || null, saleData.customerPhone || null,
      saleData.packId || null
    ]);

    // Update inventory quantities
    const item = database.getFirstSync<{ unitsPerPack: number, totalBaseQuantity: number }>('SELECT unitsPerPack, totalBaseQuantity FROM items WHERE id = ?', [saleData.itemId]);
    if (!item) { database.execSync('ROLLBACK'); return null; }

    let baseQty = saleData.quantity;
    let packQty = 0;
    
    if (saleData.unitType === 'pack' && item?.unitsPerPack) {
      baseQty = saleData.quantity * item.unitsPerPack;
      packQty = saleData.quantity;
    }

    if ((item.totalBaseQuantity || 0) < baseQty) { database.execSync('ROLLBACK'); return null; }

    database.runSync(`
      UPDATE items 
      SET totalBaseQuantity = totalBaseQuantity - ?,
          totalPackQuantity = totalPackQuantity - ?
      WHERE id = ?
    `, [baseQty, packQty, saleData.itemId]);

    database.execSync('COMMIT');
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert sale error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
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
      WHERE date(sales.createdAt) >= ? AND date(sales.createdAt) <= ?
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
  try {
    database.execSync('BEGIN TRANSACTION');
    
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
      database.runSync(`
        UPDATE items 
        SET baseSellingPrice = ? 
        WHERE id = ?
      `, [adj.newValue, adj.itemId]);
      
      // Also update pack price proportionally if unitsPerPack exists
      const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [adj.itemId]) as any;
      if (item && item.unitsPerPack) {
        const newPackPrice = adj.newValue * item.unitsPerPack;
        database.runSync(`UPDATE items SET packSellingPrice = ? WHERE id = ?`, [newPackPrice, adj.itemId]);
      }
    } else if (adj.type === 'damaged') {
      const item = database.getFirstSync('SELECT totalBaseQuantity, unitsPerPack FROM items WHERE id = ?', [adj.itemId]) as any;
      if (item) {
        let baseDeduction = adj.quantity;
        let packDeduction = 0;

        if (adj.unitType === 'pack') {
          baseDeduction = adj.quantity * (item.unitsPerPack || 1);
          packDeduction = adj.quantity;
        } else {
          packDeduction = adj.quantity / (item.unitsPerPack || 1);
        }

        if ((item.totalBaseQuantity || 0) < baseDeduction) { database.execSync('ROLLBACK'); return null; }

        database.runSync(`
          UPDATE items 
          SET totalBaseQuantity = totalBaseQuantity - ?,
              totalPackQuantity = totalPackQuantity - ?
          WHERE id = ?
        `, [baseDeduction, packDeduction, adj.itemId]);
      }
    }

    database.execSync('COMMIT');
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert adjustment error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
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
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
    const adj = database.getFirstSync('SELECT * FROM adjustments WHERE id = ?', [id]) as any;
    if (!adj) { database.execSync('ROLLBACK'); return false; }

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
        database.runSync(`
          UPDATE items 
          SET totalBaseQuantity = totalBaseQuantity + ?,
              totalPackQuantity = totalPackQuantity + ?
          WHERE id = ?
        `, [baseRefund, packRefund, adj.itemId]);
      }
    }
    
    // For price_up/price_down, reverting price is risky if new adjustments exist, so we only delete the log.
    database.runSync('DELETE FROM adjustments WHERE id = ?', id);
    database.execSync('COMMIT');
    return true;
  } catch (error) {
    console.error('Delete adjustment error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
    return false;
  }
};

export const updateAdjustment = (adjId: number, data: { quantity?: number, newValue?: number, reason?: string }) => {
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
    const existing = database.getFirstSync('SELECT * FROM adjustments WHERE id = ?', [adjId]) as any;
    if (!existing) { database.execSync('ROLLBACK'); return false; }

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
            database.runSync(`
              UPDATE items 
              SET totalBaseQuantity = totalBaseQuantity - ?,
                  totalPackQuantity = totalPackQuantity - ?
              WHERE id = ?
            `, [baseDiff, packDiff, existing.itemId]);
          }
        }
      }
    }
    
    if (data.newValue !== undefined) {
      updates.push('newValue = ?');
      params.push(data.newValue);
      
      // Affect the current price
      if (existing.type === 'price_up' || existing.type === 'price_down') {
         database.runSync(`UPDATE items SET baseSellingPrice = ? WHERE id = ?`, [data.newValue, existing.itemId]);
         const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [existing.itemId]) as any;
         if (item && item.unitsPerPack) {
           const newPackPrice = data.newValue * item.unitsPerPack;
           database.runSync(`UPDATE items SET packSellingPrice = ? WHERE id = ?`, [newPackPrice, existing.itemId]);
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
    database.execSync('COMMIT');
    return true;
  } catch (error) {
    console.error('Update adjustment error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
    return false;
  }
};

export const getActivityFeed = (options: { search?: string, date?: string, limit?: number } = {}) => {
  try {
    const database = getDB();
    const limit = options.limit || 50;

    // Sales
    const sales = database.getAllSync(`
      SELECT 'sale' as type, 'sale' as category, s.id, s.totalPrice as value, s.quantity, s.paymentMethod, s.paymentStatus, i.name as label, s.createdAt, s.discount, s.vat
      FROM sales s
      JOIN items i ON s.itemId = i.id
      ${options.date ? 'WHERE date(s.createdAt) = ?' : ''}
      ORDER BY s.createdAt DESC
      LIMIT ?
    `, options.date ? [options.date, limit] : [limit]);

    // Adjustments with type info
    const adjustments = database.getAllSync(`
      SELECT 'adjustment' as type, 'adjustment' as category, a.id, a.newValue as value, a.quantity, a.type as adjType, a.oldValue, COALESCE(i.name, 'Item') as label, a.createdAt, i.basePurchasePrice
      FROM adjustments a
      LEFT JOIN items i ON a.itemId = i.id
      ${options.date ? 'WHERE date(a.createdAt) = ?' : ''}
      ORDER BY a.createdAt DESC
      LIMIT ?
    `, options.date ? [options.date, limit] : [limit]);

    // Expenses
    const expenses = database.getAllSync(`
      SELECT 'expense' as type, 'expense' as category, e.id, e.amount as value, NULL as quantity, e.name as label, e.date as createdAt, e.category as expenseCategory, e.isRecurring
      FROM expenses e
      ${options.date ? 'WHERE date(e.date) = ?' : ''}
      ORDER BY e.date DESC
      LIMIT ?
    `, options.date ? [options.date, limit] : [limit]);

    // Inventory additions
    const inventory = database.getAllSync(`
      SELECT 'inventory' as type, 'inventory' as category, i.id, (i.totalBaseQuantity * i.basePurchasePrice) as value, i.totalBaseQuantity as quantity, i.name as label, i.createdAt, i.companyName
      FROM items i
      ${options.date ? 'WHERE date(i.createdAt) = ?' : ''}
      ORDER BY i.createdAt DESC
      LIMIT ?
    `, options.date ? [options.date, limit] : [limit]);

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

export const insertExpense = (expense: { name: string; amount: number; category: string; date?: string; isRecurring?: boolean; frequency?: string; nextBillingDate?: string }) => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
    const statement = database.prepareSync(`
      INSERT INTO expenses (name, amount, category, date, isRecurring, frequency, nextBillingDate, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      expense.name, expense.amount, expense.category || 'General', expense.date || today,
      expense.isRecurring ? 1 : 0, expense.frequency || null, expense.nextBillingDate || null, null
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

// ── Recurring Expense Reminder Functions ──────────────────────────────────────

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

export const getUpcomingRecurringExpenses = (limit: number = 5) => {
  try {
    const database = getDB();
    const today = new Date().toISOString().split('T')[0];
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
    
    // Average sale value today
    const avgSale = database.getFirstSync<{ avg: number }>(`
      SELECT AVG(totalPrice) as avg FROM sales WHERE date(createdAt) = ?
    `, [today]);

    // Total volume (units) today
    const totalUnits = database.getFirstSync<{ volume: number }>(`
      SELECT SUM(quantity) as volume FROM sales WHERE date(createdAt) = ?
    `, [today]);

    // Best hour of the day
    const bestHour = database.getFirstSync<{ hour: string }>(`
      SELECT strftime('%H', createdAt) as hour, COUNT(*) as count 
      FROM sales 
      GROUP BY hour 
      ORDER BY count DESC 
      LIMIT 1
    `);

    // Payment method distribution
    const paymentDist = database.getAllSync<{ method: string, count: number }>(`
      SELECT paymentMethod as method, COUNT(*) as count 
      FROM sales 
      GROUP BY method
    `);

    return {
      avgSaleValue: avgSale?.avg || 0,
      totalVolume: totalUnits?.volume || 0,
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
      SELECT items.*, SUM(sales.quantity) as totalQty, SUM(sales.totalPrice) as totalRevenue, categories.name as categoryName
      FROM sales 
      JOIN items ON sales.itemId = items.id
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE date(sales.createdAt) = ?
      GROUP BY items.id
      ORDER BY totalQty DESC
      LIMIT ?
    `, [today, limit]);
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
      SELECT SUM(totalPrice) as revenue, COUNT(*) as count FROM sales WHERE date(createdAt) = ?
    `, [today]);

    const todayExpenses = database.getFirstSync<{ total: number }>(`
      SELECT SUM(amount) as total FROM expenses WHERE date(date) = ?
    `, [today]);

    const todayDebt = database.getFirstSync<{ total: number }>(`
      SELECT SUM(totalPrice) as total FROM sales WHERE date(createdAt) = ? AND paymentStatus = 'Debt'
    `, [today]);

    // Yesterday's Stats for comparison
    const yesterdaySales = database.getFirstSync<{ revenue: number, count: number }>(`
      SELECT SUM(totalPrice) as revenue, COUNT(*) as count FROM sales WHERE date(createdAt) = ?
    `, [yesterday]);

    const yesterdayExpenses = database.getFirstSync<{ total: number }>(`
      SELECT SUM(amount) as total FROM expenses WHERE date(date) = ?
    `, [yesterday]);

    const yesterdayProfitData = database.getFirstSync<{ gross: number }>(`
      SELECT SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))) as gross
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) = ?
    `, [yesterday]);

    // Profit Calculation (Today) - EXCLUDING debt (not realized until paid)
    const profitData = database.getFirstSync<{ gross: number }>(`
      SELECT SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))) as gross
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) = ? AND s.paymentStatus != 'Debt'
    `, [today]);

    return {
      today: {
        revenue: todaySales?.revenue || 0,
        salesCount: todaySales?.count || 0,
        expenses: todayExpenses?.total || 0,
        debt: todayDebt?.total || 0,
        grossProfit: profitData?.gross || 0,
      },
      yesterday: {
        revenue: yesterdaySales?.revenue || 0,
        salesCount: yesterdaySales?.count || 0,
        expenses: yesterdayExpenses?.total || 0,
        grossProfit: yesterdayProfitData?.gross || 0,
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
  options?: { customerPhone?: string; saleId?: number; note?: string },
) => {
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
    if (type === 'full') {
      database.runSync(
        "UPDATE sales SET paymentStatus = 'Paid', paidAmount = totalPrice WHERE customerName = ? AND paymentStatus = 'Debt'",
        [customerName]
      );
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
    database.execSync('COMMIT');
    return true;
  } catch (error) {
    console.error('Process debt payment error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
    return false;
  }
};

export const markDebtAsLoss = (customerName: string, options?: { customerPhone?: string; note?: string }) => {
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
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
    database.execSync('COMMIT');
    return true;
  } catch (error) {
    console.error('Mark debt as loss error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
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

export const getSalesChartData = (period: 'W' | 'M' | 'Y', offset: number = 0) => {
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
        WHERE date(createdAt) >= ? AND date(createdAt) <= ?
        GROUP BY label
        ORDER BY label
      `, [startStr, endStr]);

      // Fill in missing days with 0
      const fullWeek: { label: string, value: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const dayLabel = String(i);
        const existing = results.find(r => r.label === dayLabel);
        fullWeek.push({ label: dayLabel, value: existing ? existing.value : 0 });
      }
      return fullWeek;
    } else if (period === 'M') {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = monthDate.getFullYear();
      const m = String(monthDate.getMonth() + 1).padStart(2, '0');

      results = database.getAllSync<{ label: string, value: number }>(`
        SELECT ((CAST(strftime('%d', createdAt) AS INTEGER) - 1) / 7 + 1) as label, SUM(totalPrice) as value
        FROM sales
        WHERE strftime('%Y-%m', createdAt) = ?
        GROUP BY label
        ORDER BY label
      `, [`${y}-${m}`]);

      // Fill in missing weeks with 0 (up to 5 weeks in a month)
      const fullMonth: { label: string, value: number }[] = [];
      // Determine how many weeks in this month
      const lastDay = new Date(y, monthDate.getMonth() + 1, 0).getDate();
      const numWeeks = Math.ceil(lastDay / 7);
      for (let i = 1; i <= numWeeks; i++) {
        const existing = results.find(r => Number(r.label) === i);
        fullMonth.push({ label: String(i), value: existing ? existing.value : 0 });
      }
      return fullMonth;
    } else {
      const yr = now.getFullYear() + offset;
      results = database.getAllSync<{ label: string, value: number }>(`
        SELECT CAST(strftime('%m', createdAt) AS INTEGER) as label, SUM(totalPrice) as value
        FROM sales
        WHERE strftime('%Y', createdAt) = ?
        GROUP BY label
        ORDER BY label
      `, [String(yr)]);

      // Fill in missing months with 0
      const fullYear: { label: string, value: number }[] = [];
      for (let i = 1; i <= 12; i++) {
        const monthLabel = String(i);
        const existing = results.find(r => Number(r.label) === i);
        fullYear.push({ label: monthLabel, value: existing ? existing.value : 0 });
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
  am_days: ['እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ'],
  om_days: ['Dil', 'Wii', 'Qib', 'Roob', 'Kam', 'Jum', 'San'],
  ti_days: ['ሰንበት', 'ሰኑይ', 'ሰሉስ', 'ረቡዕ', 'ሓሙስ', 'ዓርቢ', 'ቀዳም'],
  en_months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  am_months: ['ጥር', 'ለካ', 'መጋ', 'ሚያ', 'ግን', 'ሰነ', 'ሐም', 'ነሐ', 'ጥቅ', 'ህዳ', 'ታህ', 'አርብ'],
  om_months: ['Ama', 'Gur', 'Bit', 'Ebl', 'Caa', 'Wax', 'Ado', 'Hag', 'Ful', 'Onk', 'Sad', 'Mud'],
  ti_months: ['ጥሪ', 'ለካ', 'መጋ', 'ሚያ', 'ግን', 'ሰነ', 'ሓም', 'ነሓ', 'ጥቅ', 'ሕዳ', 'ታሕ', 'አርብ'],
  en_hours: ['3 AM', '6 AM', '9 AM', '12 PM', '3 PM'],
  am_hours: ['3:00 ቀን', '6:00 ቀን', '9:00 ቀን', '12:00 ማታ', '3:00 ማታ'],
  om_hours: ['3 AA', '6 AA', '9 AA', '12 WB', '3 WB'],
  ti_hours: ['3:00 ንጉሆ', '6:00 ንጉሆ', '9:00 ንጉሆ', '12:00 ምሸት', '3:00 ምሸት'],
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
          // Shift to Ethiopian clock (hr − 6) when the user has
          // selected the Ethiopian time system. This re-buckets
          // expenses into Ethiopian hours so the chart shows
          // "9:00 ቀን" instead of "3:00 AM" etc.
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

      const weekPrefix: Record<string, string> = { en: 'Week', am: 'ሳምንት', om: 'Torban', ti: 'ሰሙን' };
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
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
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

      database.runSync(`
        UPDATE items 
        SET totalBaseQuantity = totalBaseQuantity + ?,
            totalPackQuantity = totalPackQuantity + ?
        WHERE id = ?
      `, [baseRefund, packRefund, sale.itemId]);
    }

    database.runSync('DELETE FROM sales WHERE id = ?', [id]);
    database.execSync('COMMIT');
    return true;
  } catch (error) {
    console.error('Delete sale error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
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

    // 4. Budget from user_version
    const userVersion = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    let monthlyBudget = userVersion?.user_version || 50000;
    if (monthlyBudget <= 0) monthlyBudget = 50000;

    let budget = monthlyBudget;
    if (period === 'today' || period === 'yesterday') {
      budget = Math.round(monthlyBudget / 30);
    } else if (period === 'this_week') {
      budget = Math.round(monthlyBudget / 4);
    } else if (period === 'this_year') {
      budget = monthlyBudget * 12;
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
      'itemId', 'quantity', 'unit', 'unitType', 'discount', 'vat', 
      'totalPrice', 'paymentMethod', 'paymentStatus', 
      'customerName', 'customerPhone', 'packId', 'createdAt'
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

export const updateExpense = (id: number, updates: any) => {
  try {
    const database = getDB();
    const validColumns = [
      'name', 'amount', 'category', 'date', 
      'isRecurring', 'frequency', 'nextBillingDate', 'createdAt'
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
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
    database.execSync('DELETE FROM adjustments;');
    database.execSync('DELETE FROM sales;');
    database.execSync('DELETE FROM returns;');
    database.execSync('DELETE FROM debt_payments;');
    database.execSync('DELETE FROM notifications;');
    database.execSync('DELETE FROM item_packs;');
    database.execSync('DELETE FROM items;');
    database.execSync('DELETE FROM expenses;');
    database.execSync('DELETE FROM categories;');
    database.execSync('DELETE FROM contacts;');
    database.execSync('DELETE FROM warehouses;');
    database.execSync("DELETE FROM sqlite_sequence WHERE name IN ('adjustments','sales','returns','debt_payments','notifications','item_packs','items','expenses','categories','contacts','warehouses');");
    database.execSync('COMMIT');
    console.log('Database cleared successfully.');
    return true;
  } catch (error) {
    console.error('Clear database error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
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
    const params: any[] = [];

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
        WHERE 1=1 ${dateCondition}
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
      WHERE 1=1 ${dateCondition}
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
      WHERE date(createdAt) >= ? AND date(createdAt) <= ?
    `, [startDate, endDate]);

    // Sales (Items count)
    const salesItems = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM sales 
      WHERE date(createdAt) >= ? AND date(createdAt) <= ?
    `, [startDate, endDate]);

    // Profit (Gross Profit = Revenue - COGS)
    const profitData = database.getFirstSync<{ total: number }>(`
      SELECT COALESCE(SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))), 0) as total
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ?
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
    const damageLossVal = damageLoss?.total || 0;
    const priceChangesVal = priceChanges?.total || 0;
    const otherLossesVal = otherLosses?.total || 0;

    // Net Profit = Sales Profit + Price Change Gains - Expenses - Damage Losses - Other Losses
    const netProfit = profitVal + (priceChangesVal > 0 ? priceChangesVal : 0) - expensesVal - damageLossVal - otherLossesVal;

    // Performance Rating
    let performanceRating: 'Excellent' | 'Good' | 'Average' | 'Poor' = 'Poor';
    if (salesCashVal > 0) {
      const profitRatio = netProfit / salesCashVal;
      if (profitRatio > 0.7) performanceRating = 'Excellent';
      else if (profitRatio > 0.5) performanceRating = 'Good';
      else if (profitRatio > 0.2) performanceRating = 'Average';
      else performanceRating = 'Poor';
    } else if (netProfit > 0) {
      performanceRating = 'Average';
    }

    return {
      salesCash: salesCashVal,
      salesItems: salesItemsVal,
      profit: profitVal,
      expenses: expensesVal,
      debt: debtVal,
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
      WHERE customerName IS NOT NULL AND customerName != ''
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
    let query = `SELECT paymentMethod, COUNT(*) as count, SUM(totalPrice) as total FROM sales`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (startDate) {
      conditions.push('date(createdAt) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date(createdAt) <= ?');
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY paymentMethod';
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
    let query = `SELECT strftime('%H', createdAt) as hour, COUNT(*) as count, SUM(quantity) as totalQty FROM sales WHERE date(createdAt) = ?`;
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

export const processIndividualPayment = (saleId: number, amount: number) => {
  try {
    const database = getDB();
    const sale = database.getFirstSync<{ totalPrice: number, paidAmount: number }>(
      'SELECT totalPrice, paidAmount FROM sales WHERE id = ?', [saleId]
    );
    if (!sale) return false;

    const newPaid = (sale.paidAmount || 0) + amount;
    const newStatus = newPaid >= sale.totalPrice ? 'Paid' : 'Debt';

    database.runSync(
      'UPDATE sales SET paidAmount = ?, paymentStatus = ? WHERE id = ?',
      [newPaid, newStatus, saleId]
    );
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

const getMovingItemsWithFiltersFix = getMovingItemsWithFilters;

// ── getSalesGroupedByDateRange ──────────────────────────────────────────────
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

    return database.getAllSync(`
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
  } catch (error) {
    console.error('getSalesGroupedByDateRange error:', error);
    return [];
  }
};

// ── getPaidOutstandingSummary ───────────────────────────────────────────────
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
      INSERT INTO item_packs (itemId, packNumber, quantity, unit)
      VALUES (?, ?, ?, ?)
    `).executeSync([data.itemId, data.packNumber, data.quantity, data.unit]) as any;
  } catch (error) {
    console.error('Insert pack error:', error);
    return null;
  }
};;

export const insertReturn = (data: { saleId: number; itemId: number; quantity: number; unit: string; unitType: string; totalRefund: number; reason: string; createdAt: string }) => {
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
    const item = database.getFirstSync<{ unitsPerPack: number }>('SELECT unitsPerPack FROM items WHERE id = ?', [data.itemId]);

    let baseRefund = data.quantity;
    let packRefund = 0;

    if (data.unitType === 'pack' && item?.unitsPerPack) {
      baseRefund = data.quantity * item.unitsPerPack;
      packRefund = data.quantity;
    } else if (item?.unitsPerPack) {
      packRefund = data.quantity / item.unitsPerPack;
    }

    database.runSync(`
      UPDATE items
      SET totalBaseQuantity = totalBaseQuantity + ?,
          totalPackQuantity = totalPackQuantity + ?
      WHERE id = ?
    `, [baseRefund, packRefund, data.itemId]);

    const result = database.prepareSync(`
      INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).executeSync([data.saleId, data.itemId, data.quantity, data.unit, data.unitType, data.totalRefund, data.reason, data.createdAt]);
    database.execSync('COMMIT');
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert return error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
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

export const getReorderSuggestions = () => {
  try {
    const database = getDB();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    return database.getAllSync(`
      SELECT
        i.id, i.name, i.totalBaseQuantity, i.baseUnit, i.baseSellingPrice,
        i.packSellingPrice, i.warehouseId, i.unitsPerPack,
        COALESCE(s.sales30d, 0) as sales30d,
        CASE
          WHEN COALESCE(s.sales30d, 0) > 0
          THEN MAX(10, CAST(ROUND(COALESCE(s.sales30d, 0) * 2 - i.totalBaseQuantity) AS INTEGER))
          ELSE MAX(10, CAST(ROUND(10 - i.totalBaseQuantity) AS INTEGER))
        END as suggestedQty
      FROM items i
      LEFT JOIN (
        SELECT s.itemId,
          SUM(CASE WHEN s.unitType = 'pack' THEN s.quantity * COALESCE(i2.unitsPerPack, 1) ELSE s.quantity END) as sales30d
        FROM sales s
        LEFT JOIN items i2 ON s.itemId = i2.id
        WHERE s.createdAt >= ?
        GROUP BY s.itemId
      ) s ON i.id = s.itemId
      WHERE i.totalBaseQuantity < 10
         OR (COALESCE(s.sales30d, 0) > 0 AND i.totalBaseQuantity < COALESCE(s.sales30d, 0) * 0.5)
      ORDER BY i.totalBaseQuantity ASC, s.sales30d DESC
    `, [thirtyDaysAgo]);
  } catch (error) {
    console.error('Get reorder suggestions error:', error);
    return [];
  }
};

export const transferStock = (
  fromWarehouseId: number,
  toWarehouseId: number,
  transfers: { itemId: number; quantity: number }[]
) => {
  const database = getDB();
  try {
    database.execSync('BEGIN TRANSACTION');
    for (const t of transfers) {
      const source = database.getFirstSync<{
        name: string; totalBaseQuantity: number; totalPackQuantity: number;
        unitsPerPack: number; baseUnit: string; purchaseUnit: string;
        basePurchasePrice: number; packPurchasePrice: number;
        baseSellingPrice: number; packSellingPrice: number;
        categoryId: number | null; companyName: string;
        expiryDate: string | null; qualityGrade: string; notes: string;
        isCredit: number; supplierPhone: string | null; supplierAccount: string | null;
        allowSellByBaseUnit: number; allowSellByPackUnit: number
      }>(
        'SELECT * FROM items WHERE id = ? AND warehouseId = ?', [t.itemId, fromWarehouseId]
      );
      if (!source) { database.execSync('ROLLBACK'); return false; }
      if (source.totalBaseQuantity < t.quantity) { database.execSync('ROLLBACK'); return false; }

      const packQty = source.unitsPerPack > 0 ? t.quantity / source.unitsPerPack : 0;
      database.runSync(
        'UPDATE items SET totalBaseQuantity = totalBaseQuantity - ?, totalPackQuantity = MAX(0, totalPackQuantity - ?) WHERE id = ?',
        [t.quantity, packQty, t.itemId]
      );

      const dest = database.getFirstSync<{ id: number }>(
        'SELECT id FROM items WHERE name = ? AND warehouseId = ?', [source.name, toWarehouseId]
      );

      if (dest) {
        database.runSync(
          'UPDATE items SET totalBaseQuantity = totalBaseQuantity + ?, totalPackQuantity = totalPackQuantity + ? WHERE id = ?',
          [t.quantity, packQty, dest.id]
        );
      } else {
        database.runSync(
          `INSERT INTO items (name, categoryId, companyName, purchaseUnit, baseUnit, unitsPerPack, totalPackQuantity, totalBaseQuantity, packPurchasePrice, basePurchasePrice, baseSellingPrice, packSellingPrice, allowSellByBaseUnit, allowSellByPackUnit, expiryDate, qualityGrade, notes, isCredit, supplierPhone, supplierAccount, warehouseId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [source.name, source.categoryId, source.companyName, source.purchaseUnit, source.baseUnit, source.unitsPerPack, packQty, t.quantity, source.packPurchasePrice, source.basePurchasePrice, source.baseSellingPrice, source.packSellingPrice, source.allowSellByBaseUnit, source.allowSellByPackUnit, source.expiryDate, source.qualityGrade, source.notes, source.isCredit, source.supplierPhone, source.supplierAccount, toWarehouseId]
        );
      }
    }
    database.execSync('COMMIT');
    return true;
  } catch (error) {
    console.error('Transfer stock error:', error);
    try { database?.execSync('ROLLBACK'); } catch (_) {}
    return false;
  }
};
