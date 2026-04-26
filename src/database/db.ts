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
    console.log('Database initialization complete.');
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
  expiryDate: string | null;
  qualityGrade: string;
  notes: string;
  isCredit: boolean;
  supplierPhone: string | null;
  supplierAccount: string | null;
  createdAt?: string;
}

export const insertItem = (item: InsertItemData) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO items (
        name, categoryId, companyName, purchaseUnit, baseUnit, unitsPerPack,
        totalPackQuantity, totalBaseQuantity, packPurchasePrice, basePurchasePrice,
        baseSellingPrice, packSellingPrice, allowSellByBaseUnit, allowSellByPackUnit,
        expiryDate, qualityGrade, notes, isCredit, supplierPhone, supplierAccount, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);

    const result = statement.executeSync([
      item.name, item.categoryId, item.companyName, item.purchaseUnit, item.baseUnit, item.unitsPerPack,
      item.totalPackQuantity, item.totalBaseQuantity, item.packPurchasePrice, item.basePurchasePrice,
      item.baseSellingPrice, item.packSellingPrice, item.allowSellByBaseUnit ? 1 : 0, item.allowSellByPackUnit ? 1 : 0,
      item.expiryDate, item.qualityGrade, item.notes, item.isCredit ? 1 : 0, item.supplierPhone, item.supplierAccount, item.createdAt || null
    ]);

    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert item error:', error);
    return null;
  }
};

export const getRecentItems = (limit: number = 10) => {
  try {
    const database = getDB();
    const items = database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id
      ORDER BY items.createdAt DESC 
      LIMIT ?
    `, [limit]);
    return items;
  } catch (error) {
    console.error('Get recent items error:', error);
    return [];
  }
};

export const getFilteredItems = (options: FilterOptions) => {
  try {
    const database = getDB();
    let query = `
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id
    `;
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

    if (options.date) {
       conditions.push('date(items.createdAt) = ?');
       params.push(options.date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    let orderBy = 'items.createdAt DESC';
    if (options.sortBy === 'price_desc' || options.sortBy === 'Highest Price') orderBy = 'items.baseSellingPrice DESC';
    else if (options.sortBy === 'price_asc' || options.sortBy === 'Lowest Price') orderBy = 'items.baseSellingPrice ASC';
    else if (options.sortBy === 'qty_desc' || options.sortBy === 'Highest Quantity') orderBy = 'items.totalBaseQuantity DESC';
    else if (options.sortBy === 'name_asc' || options.sortBy === 'Item Name (A-Z)') orderBy = 'items.name ASC';

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

export const searchInventory = (query: string) => {
  try {
    const database = getDB();
    const items = database.getAllSync(`
      SELECT items.*, categories.name as categoryName 
      FROM items 
      LEFT JOIN categories ON items.categoryId = categories.id
      WHERE items.name LIKE ? OR categories.name LIKE ?
      ORDER BY items.name ASC
    `, [`%${query}%`, `%${query}%`]);
    return items;
  } catch (error) {
    console.error('Search inventory error:', error);
    return [];
  }
};

export const insertPack = (pack: { itemId: number, packNumber: number, quantity: number, unit: string }) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO item_packs (itemId, packNumber, initialQuantity, currentQuantity, unit) 
      VALUES (?, ?, ?, ?, ?)
    `);
    statement.executeSync([pack.itemId, pack.packNumber, pack.quantity, pack.quantity, pack.unit]);
    return true;
  } catch (error) {
    console.error('Insert pack error:', error);
    return false;
  }
};

export const getPacksForItem = (itemId: number) => {
  try {
    const database = getDB();
    return database.getAllSync('SELECT * FROM item_packs WHERE itemId = ?', [itemId]);
  } catch (error) {
    console.error('Get packs error:', error);
    return [];
  }
};

export const insertSale = (sale: any) => {
  try {
    const database = getDB();
    
    // 1. Get current item details for conversion
    const item = database.getFirstSync('SELECT * FROM items WHERE id = ?', [sale.itemId]) as any;
    if (!item) throw new Error('Item not found');

    const statement = database.prepareSync(`
      INSERT INTO sales (
        itemId, quantity, unit, unitType, discount, vat, totalPrice, 
        paymentMethod, paymentStatus, customerName, customerPhone, packId, dueDate, paidAmount, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    
    const result = statement.executeSync([
      sale.itemId, sale.quantity, sale.unit, sale.unitType, sale.discount, sale.vat, sale.totalPrice,
      sale.paymentMethod, sale.paymentStatus, sale.customerName, sale.customerPhone, sale.packId, 
      sale.dueDate || null, sale.paidAmount || 0, sale.createdAt || null
    ]);
    
    // 2. Calculate stock deduction
    let baseDeduction = sale.quantity;
    let packDeduction = 0;

    if (sale.unitType === 'pack') {
      baseDeduction = sale.quantity * (item.unitsPerPack || 1);
      packDeduction = sale.quantity;
    } else {
      // Selling base units, calculate fractional pack deduction for consistency
      packDeduction = sale.quantity / (item.unitsPerPack || 1);
    }

    // 3. Update stock in items table
    database.runSync(`
      UPDATE items 
      SET totalBaseQuantity = totalBaseQuantity - ?,
          totalPackQuantity = totalPackQuantity - ?
      WHERE id = ?
    `, [baseDeduction, packDeduction, sale.itemId]);
    
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Insert sale error:', error);
    return null;
  }
};

export const getRecentSales = (limit: number = 10) => {
  try {
    const database = getDB();
    return database.getAllSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit as itemUnit
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

export interface FilterOptions {
  search?: string;
  sortBy?: string;
  category?: string;
  date?: string;
  limit?: number;
}

export const getFilteredSales = (options: FilterOptions) => {
  try {
    const database = getDB();
    let query = `
      SELECT sales.*, items.name as itemName, items.baseUnit as itemUnit, items.categoryId
      FROM sales
      LEFT JOIN items ON sales.itemId = items.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.search) {
      conditions.push('(items.name LIKE ? OR sales.customerName LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.category && options.category !== 'All') {
      // For sales, "category" often matches the item name or unit, but we can match item categoryId if we had it
      // Let's use string match for now since the UI might just pass text.
      conditions.push('items.categoryId IN (SELECT id FROM categories WHERE name = ?)');
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
    if (options.sortBy === 'price_desc' || options.sortBy === 'Highest Price') orderBy = 'sales.totalPrice DESC';
    else if (options.sortBy === 'price_asc' || options.sortBy === 'Lowest Price') orderBy = 'sales.totalPrice ASC';
    else if (options.sortBy === 'qty_desc' || options.sortBy === 'Highest Quantity') orderBy = 'sales.quantity DESC';
    else if (options.sortBy === 'name_asc' || options.sortBy === 'Item Name (A-Z)') orderBy = 'sales.name ASC';

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
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.packPurchasePrice
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
    const params: any[] = [];
    
    let whereClause = '';
    if (options.date) {
      whereClause = `WHERE date(createdAt) = ?`;
      params.push(options.date);
    }

    // Since we are doing a UNION, we wrap it in a subquery to filter easily
    let query = `
      SELECT * FROM (
        SELECT 'sale' as category, s.id, s.itemId as relatedId, s.totalPrice as amount, s.createdAt, s.unitType, s.quantity, NULL as type, i.name as name
        FROM sales s
        LEFT JOIN items i ON s.itemId = i.id
        UNION ALL
        SELECT 'expense' as category, e.id, NULL as relatedId, e.amount, e.createdAt, NULL as unitType, NULL as quantity, NULL as type, e.name as name
        FROM expenses e
        UNION ALL
        SELECT 'adjustment' as category, a.id, a.itemId as relatedId, NULL as amount, a.createdAt, a.unitType, a.quantity, a.type, i.name as name
        FROM adjustments a
        LEFT JOIN items i ON a.itemId = i.id
      )
    `;

    const conditions: string[] = [];
    const conditionParams: any[] = [];

    if (options.date) {
      conditions.push('date(createdAt) = ?');
      conditionParams.push(options.date);
    }

    if (options.search) {
      conditions.push('name LIKE ?');
      conditionParams.push(`%${options.search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY createdAt DESC LIMIT ?`;
    conditionParams.push(limit);

    return database.getAllSync(query, conditionParams);
  } catch (error) {
    console.error('Get activity feed error:', error);
    return [];
  }
};

export const getSaleById = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync(`
      SELECT sales.*, items.name as itemName, items.baseUnit as itemUnit, items.categoryId
      FROM sales
      LEFT JOIN items ON sales.itemId = items.id
      WHERE sales.id = ?
    `, [id]);
  } catch (error) {
    console.error('getSaleById error:', error);
    return null;
  }
};

export const getExpenseById = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync('SELECT * FROM expenses WHERE id = ?', [id]);
  } catch (error) {
    console.error('getExpenseById error:', error);
    return null;
  }
};

export const getAdjustmentById = (id: number) => {
  try {
    const database = getDB();
    return database.getFirstSync(`
      SELECT adjustments.*, items.name as itemName, items.baseUnit, items.basePurchasePrice, items.packPurchasePrice
      FROM adjustments 
      LEFT JOIN items ON adjustments.itemId = items.id
      WHERE adjustments.id = ?
    `, [id]);
  } catch (error) {
    console.error('getAdjustmentById error:', error);
    return null;
  }
};

export const insertExpense = (expense: any) => {
  try {
    const database = getDB();
    const statement = database.prepareSync(`
      INSERT INTO expenses (name, amount, category, date, isRecurring, frequency, nextBillingDate, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    const result = statement.executeSync([
      expense.name, expense.amount, expense.category, expense.date,
      expense.isRecurring ? 1 : 0, expense.frequency, expense.nextBillingDate, expense.createdAt || null
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
    const results = database.getAllSync(`
      SELECT items.*, SUM(sales.quantity) as totalQty, SUM(sales.totalPrice) as totalRevenue, categories.name as categoryName
      FROM sales 
      JOIN items ON sales.itemId = items.id
      LEFT JOIN categories ON items.categoryId = categories.id
      GROUP BY items.id
      ORDER BY totalQty DESC
      LIMIT ?
    `, [limit]);
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

    // Profit Calculation (Today)
    const profitData = database.getFirstSync<{ gross: number }>(`
      SELECT SUM(s.totalPrice - (s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END))) as gross
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) = ?
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

export const getInventorySummary = () => {
  try {
    const database = getDB();
    
    // Total Inventory Value and Item Count
    const totals = database.getFirstSync<{ value: number, count: number }>(`
      SELECT SUM(totalBaseQuantity * basePurchasePrice) as value, COUNT(*) as count FROM items
    `);

    // Low Stock Count
    const lowStock = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM items WHERE totalBaseQuantity < 10
    `);

    // Highest Value Item
    const highValue = database.getFirstSync<{ name: string, value: number }>(`
      SELECT name, (totalBaseQuantity * basePurchasePrice) as value 
      FROM items 
      ORDER BY value DESC 
      LIMIT 1
    `);

    // Category Distribution
    const categories = database.getAllSync<{ name: string, count: number, value: number }>(`
      SELECT c.name, COUNT(i.id) as count, SUM(i.totalBaseQuantity * i.basePurchasePrice) as value
      FROM categories c
      JOIN items i ON i.categoryId = c.id
      GROUP BY c.id
    `);

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

export const getInventoryStats = () => {
  try {
    const database = getDB();
    
    // Total Inventory Value
    const totalValue = database.getFirstSync<{ value: number }>(`
      SELECT SUM(totalBaseQuantity * basePurchasePrice) as value FROM items
    `);

    // Low Stock Count
    const lowStock = database.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) as count FROM items WHERE totalBaseQuantity < 10
    `);

    // Category Distribution
    const categories = database.getAllSync<{ name: string, count: number }>(`
      SELECT c.name, COUNT(i.id) as count 
      FROM categories c
      JOIN items i ON i.categoryId = c.id
      GROUP BY c.id
    `);

    // Moving Items Count (Sold > 0 in last 30 days)
    const movingData = database.getFirstSync<{ fast: number, slow: number }>(`
       SELECT 
          COUNT(DISTINCT CASE WHEN total_qty > 5 THEN itemId END) as fast,
          COUNT(DISTINCT CASE WHEN total_qty <= 5 THEN itemId END) as slow
       FROM (
         SELECT itemId, SUM(quantity) as total_qty 
         FROM sales 
         WHERE createdAt >= date('now', '-30 days')
         GROUP BY itemId
       )
    `);

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

export const processDebtPayment = (customerName: string, amount: number, type: 'full' | 'partial') => {
  try {
    const database = getDB();
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
    return true;
  } catch (error) {
    console.error('Process debt payment error:', error);
    return false;
  }
};

export const markDebtAsLoss = (customerName: string) => {
  try {
    const database = getDB();
    database.runSync(
      "UPDATE sales SET paymentStatus = 'Loss' WHERE customerName = ? AND paymentStatus = 'Debt'",
      [customerName]
    );
    return true;
  } catch (error) {
    console.error('Mark debt as loss error:', error);
    return false;
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
    let query = '';

    if (period === 'W') {
      // Offset by weeks (offset * 7 days)
      const dayOffset = offset * 7;
      query = `
        SELECT 
          strftime('%w', createdAt, '${dayOffset} days') as label,
          SUM(totalPrice) as value
        FROM sales 
        WHERE date(createdAt) >= date('now', '-6 days', '${dayOffset} days') 
          AND date(createdAt) <= date('now', '${dayOffset} days')
        GROUP BY label
        ORDER BY date(createdAt)
      `;
    } else if (period === 'M') {
      // Offset by months
      query = `
        SELECT 'Week ' || ((strftime('%d', createdAt) - 1) / 7 + 1) as label, SUM(totalPrice) as value
        FROM sales
        WHERE strftime('%m', createdAt) = strftime('%m', 'now', '${offset} months') 
          AND strftime('%Y', createdAt) = strftime('%Y', 'now', '${offset} months')
        GROUP BY label
        ORDER BY label
      `;
    } else {
      // Offset by years
      query = `
        SELECT 
          CASE strftime('%m', createdAt)
            WHEN '01' THEN 'Jan' WHEN '02' THEN 'Feb' WHEN '03' THEN 'Mar' WHEN '04' THEN 'Apr'
            WHEN '05' THEN 'May' WHEN '06' THEN 'Jun' WHEN '07' THEN 'Jul' WHEN '08' THEN 'Aug'
            WHEN '09' THEN 'Sep' WHEN '10' THEN 'Oct' WHEN '11' THEN 'Nov' WHEN '12' THEN 'Dec'
          END as label,
          SUM(totalPrice) as value
        FROM sales
        WHERE strftime('%Y', createdAt) = strftime('%Y', 'now', '${offset} years')
        GROUP BY strftime('%m', createdAt)
        ORDER BY strftime('%m', createdAt)
      `;
    }

    return database.getAllSync<{ label: string, value: number }>(query);
  } catch (error) {
    console.error('Get sales chart data error:', error);
    return [];
  }
};

export const getExpenseChartData = (period: 'W' | 'M' | 'Y', targetDate?: string) => {
  try {
    const database = getDB();
    let query = '';
    const dateModifier = targetDate ? `date('${targetDate}')` : `date('now')`;

    if (period === 'W') {
      query = `
        SELECT 
          CASE strftime('%w', date)
            WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue' WHEN '3' THEN 'Wed' 
            WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri' WHEN '6' THEN 'Sat'
          END as label,
          SUM(amount) as value
        FROM expenses 
        WHERE date >= date(${dateModifier}, '-6 days') AND date <= ${dateModifier}
        GROUP BY strftime('%w', date)
        ORDER BY date(date)
      `;
    } else if (period === 'M') {
      query = `
        SELECT 'Week ' || ((strftime('%d', date) - 1) / 7 + 1) as label, SUM(amount) as value
        FROM expenses
        WHERE strftime('%m', date) = strftime('%m', ${dateModifier}) 
          AND strftime('%Y', date) = strftime('%Y', ${dateModifier})
        GROUP BY label
        ORDER BY label
      `;
    } else {
      query = `
        SELECT 
          CASE strftime('%m', date)
            WHEN '01' THEN 'Jan' WHEN '02' THEN 'Feb' WHEN '03' THEN 'Mar' WHEN '04' THEN 'Apr'
            WHEN '05' THEN 'May' WHEN '06' THEN 'Jun' WHEN '07' THEN 'Jul' WHEN '08' THEN 'Aug'
            WHEN '09' THEN 'Sep' WHEN '10' THEN 'Oct' WHEN '11' THEN 'Nov' WHEN '12' THEN 'Dec'
          END as label,
          SUM(amount) as value
        FROM expenses
        WHERE date >= date(${dateModifier}, '-1 year') AND date <= ${dateModifier}
        GROUP BY strftime('%m', date)
        ORDER BY strftime('%m', date)
      `;
    }

    return database.getAllSync<{ label: string, value: number }>(query);
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
    // Might also need to clean up sales or adjustments referencing this item,
    // but SQLite without PRAGMA foreign_keys = ON might orphan rows. Keep it simple.
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
      // Rollback inventory quantities based on the unitType sold
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

export const getCapitalSummary = (targetDate?: string) => {
  try {
    const database = getDB();
    const d = targetDate ? new Date(targetDate.replace(/-/g, '/')) : new Date();
    const currentMonthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    // 1. Total Disbursement this month
    const currentTotal = database.getFirstSync<{ total: number }>(
      'SELECT SUM(amount) as total FROM expenses WHERE date LIKE ?',
      [`${currentMonthPrefix}%`]
    );

    // 2. Top Category
    const topCategory = database.getFirstSync<{ name: string, total: number }>(`
      SELECT category as name, SUM(amount) as total 
      FROM expenses 
      WHERE date LIKE ? 
      GROUP BY category 
      ORDER BY total DESC 
      LIMIT 1
    `, [`${currentMonthPrefix}%`]);

    // 3. Category Distribution
    const categories = database.getAllSync<{ name: string, total: number }>(`
      SELECT category as name, SUM(amount) as total 
      FROM expenses 
      WHERE date LIKE ? 
      GROUP BY category 
      ORDER BY total DESC
    `, [`${currentMonthPrefix}%`]);

    // 4. Budget (Mocked for now: 1.2x last month or fixed 50k)
    const budget = 50000; 

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
      'supplierPhone', 'supplierAccount', 'createdAt'
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
    
    database.execSync(`UPDATE items SET ${setQuery} WHERE id = ?`, [...values, id] as any);
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
    
    // Filter updates to only inclusion valid columns and defined values
    const filteredUpdates = Object.keys(updates)
      .filter(key => validColumns.includes(key) && updates[key] !== undefined)
      .reduce((obj: any, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) return true;

    const setQuery = Object.keys(filteredUpdates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredUpdates);
    
    database.execSync(`UPDATE sales SET ${setQuery} WHERE id = ?`, [...values, id] as any);
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
    
    database.execSync(`UPDATE expenses SET ${setQuery} WHERE id = ?`, [...values, id] as any);
    return true;
  } catch (error) {
    console.error('Update expense error:', error);
    return false;
  }
};

export const clearDatabase = () => {
  try {
    const database = getDB();
    database.execSync('DELETE FROM adjustments;');
    database.execSync('DELETE FROM sales;');
    database.execSync('DELETE FROM item_packs;');
    database.execSync('DELETE FROM items;');
    database.execSync('DELETE FROM expenses;');
    database.execSync('DELETE FROM categories;');
    // Reset autoincrement counters
    database.execSync("DELETE FROM sqlite_sequence WHERE name IN ('adjustments','sales','item_packs','items','expenses','categories');");
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

    // 1. Monthly Records Count
    const totalRecords = database.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM adjustments WHERE createdAt LIKE ?',
      [`${currentMonthPrefix}%`]
    );

    // 2. Capital Leakage (Value of Damaged + Price Decreases)
    // Note: This requires joining with items to get the value, but adjustments stores newValue/oldValue for prices.
    // For damaged items, we usually store the quantity.
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

    // 3. Top Adjusted Item
    const topAdjusted = database.getFirstSync<{ name: string, count: number }>(`
      SELECT i.name, COUNT(a.id) as count 
      FROM adjustments a
      JOIN items i ON a.itemId = i.id
      WHERE a.createdAt LIKE ?
      GROUP BY a.itemId 
      ORDER BY count DESC 
      LIMIT 1
    `, [`${currentMonthPrefix}%`]);

    // 4. Type Distribution
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
    
    // 1. Top Sales Item (Today)
    const topItem = database.getFirstSync<{ name: string, quantity: number }>(`
      SELECT i.name, SUM(s.quantity) as quantity
      FROM sales s
      JOIN items i ON s.itemId = i.id
      WHERE date(s.createdAt) = ?
      GROUP BY s.itemId
      ORDER BY quantity DESC
      LIMIT 1
    `, [today]);

    // 2. Health Score Calculation (Profit/Revenue Ratio vs Expenses)
    const stats = getDashboardStats(targetDate);
    let healthScore = 100;
    if (stats) {
      const revenue = stats.today.revenue;
      const expenses = stats.today.expenses;
      const profit = stats.today.grossProfit;
      
      if (revenue > 0) {
        const profitMargin = (profit / revenue) * 100;
        const opexRatio = (expenses / revenue) * 100;
        // Simple heuristic: Margin should be > 20%, Opex should be < 30%
        healthScore = Math.min(Math.max(profitMargin * 2 - opexRatio, 0), 100);
      } else if (expenses > 0) {
        healthScore = 0;
      }
    }

    // 3. Peak Hour (If timestamps were more granular, but date(createdAt) is usually used)
    // We'll skip peak hour for now as the schema uses YYYY-MM-DD usually, or check if it has time.
    
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