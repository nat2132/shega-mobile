import { 
  getDB, 
  insertCategory, 
  insertItem,
  insertSale,
  insertExpense,
  insertAdjustment,
  insertPack,
  insertReturn
} from './db';

// Helper utilities
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number, decimals = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const randomDateInRange = (startYear: number, endYear: number) => {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
};
const fmtDate = (d: Date) => d.toISOString().split('T')[0];
const fmtDateTime = (d: Date) => d.toISOString();

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
  { name: 'Cement (50KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 550, cost: 480, isPack: false },
  { name: 'Nail (5mm)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 25, cost: 18, isPack: false },
  { name: 'Nail (10mm)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 35, cost: 25, isPack: false },
  { name: 'Paint Red (4L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 3, price: 1200, cost: 900, isPack: false },
  { name: 'Paint White (4L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 3, price: 1100, cost: 820, isPack: false },
  { name: 'PVC Pipe 1"', unit: 'm', baseUnit: 'm', categoryIdx: 5, price: 150, cost: 110, isPack: false },
  { name: 'PVC Pipe 2"', unit: 'm', baseUnit: 'm', categoryIdx: 5, price: 250, cost: 190, isPack: false },
  { name: 'PVC Elbow 1"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 5, price: 45, cost: 30, isPack: false },
  { name: 'Electrical Wire 1.5mm', unit: 'm', baseUnit: 'm', categoryIdx: 4, price: 85, cost: 60, isPack: false },
  { name: 'Electrical Wire 2.5mm', unit: 'm', baseUnit: 'm', categoryIdx: 4, price: 140, cost: 105, isPack: false },
  { name: 'Light Bulb LED 9W', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 180, cost: 130, isPack: false },
  { name: 'Light Bulb LED 12W', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 220, cost: 165, isPack: false },
  { name: 'Switch Socket', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 90, cost: 60, isPack: false },
  { name: 'Measuring Tape 5m', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 120, cost: 80, isPack: false },
  { name: 'Measuring Tape 10m', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 200, cost: 145, isPack: false },
  { name: 'Spirit Level 60cm', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 350, cost: 250, isPack: false },
  { name: 'Bolt M8', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 8, cost: 5, isPack: false },
  { name: 'Bolt M10', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 12, cost: 7, isPack: false },
  { name: 'Screw 2"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 3, cost: 1.5, isPack: false },
  { name: 'Screw 4"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 5, cost: 3, isPack: false },
  { name: 'Cooking Oil (3L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 10, price: 380, cost: 320, isPack: false },
  { name: 'Milk Powder (400g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 250, cost: 195, isPack: false },
  { name: 'Sugar (50KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 10, price: 2800, cost: 2400, isPack: false },
  { name: 'Rice (10KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 10, price: 650, cost: 520, isPack: false },
  { name: 'Pasta (500g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 45, cost: 32, isPack: false },
  { name: 'Tomato Paste (500g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 85, cost: 60, isPack: false },
  { name: 'Sandpaper Grit 120', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 3, price: 35, cost: 22, isPack: false },
  { name: 'Steel Wire (2mm)', unit: 'm', baseUnit: 'm', categoryIdx: 2, price: 55, cost: 38, isPack: false },
  { name: 'Wood Glue (1L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 2, price: 180, cost: 130, isPack: false },
  { name: 'Masking Tape', unit: 'roll', baseUnit: 'pieces', categoryIdx: 3, price: 65, cost: 42, isPack: false },
  { name: 'Hand Soap (5L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 7, price: 350, cost: 270, isPack: false },
  { name: 'Bleach (1L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 7, price: 80, cost: 55, isPack: false },
  { name: 'Safety Gloves', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 120, cost: 85, isPack: false },
  { name: 'Safety Goggles', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 200, cost: 150, isPack: false },
  { name: 'Hard Hat', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 380, cost: 280, isPack: false },
  { name: 'Bucket 10L', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 150, cost: 100, isPack: false },
  { name: 'Mop', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 95, cost: 65, isPack: false },
  { name: 'Broom', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 70, cost: 45, isPack: false },
  { name: 'Ceramic Tile 30x30', unit: 'sqm', baseUnit: 'sqm', categoryIdx: 9, price: 450, cost: 350, isPack: false },
  { name: 'Ceramic Tile 60x60', unit: 'sqm', baseUnit: 'sqm', categoryIdx: 9, price: 750, cost: 580, isPack: false },
  { name: 'Adhesive Cement', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 180, cost: 130, isPack: false },
  { name: 'Plaster (25KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 220, cost: 165, isPack: false },
  { name: 'Steel Rebar 12mm', unit: 'm', baseUnit: 'm', categoryIdx: 9, price: 320, cost: 250, isPack: false },
  { name: 'Steel Rebar 16mm', unit: 'm', baseUnit: 'm', categoryIdx: 9, price: 450, cost: 360, isPack: false },
  { name: 'Generator 2.5kVA', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 12500, cost: 10000, isPack: false },
  { name: 'Generator 5kVA', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 22000, cost: 18000, isPack: false },
  { name: 'Wheelbarrow', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 1800, cost: 1400, isPack: false },
  { name: 'Shovel', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 350, cost: 250, isPack: false },
  { name: 'Pickaxe', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 500, cost: 380, isPack: false },
];

const CUSTOMER_NAMES = [
  'Abebe Kebede', 'Almaz Mekonnen', 'Biruk Tesfaye', 'Chaltu Wondimu',
  'Daniel Abera', 'Eden Belay', 'Fikadu Demissie', 'Genet Eshetu',
  'Haile Fekadu', 'Iman Getachew', 'Jemal Hailu', 'Kebede Lemma',
  'Lemlem Mengistu', 'Mekdes Nigussie', 'Negasi Shiferaw', 'Oumer Tadesse',
  'Rahel Worku', 'Solomon Zeleke', 'Tigist Amanuel', 'Yonas Birtukan',
];

const EXPENSE_TEMPLATES = [
  { name: 'Monthly Rent', category: 'Rent', amount: 15000 },
  { name: 'Electricity Bill', category: 'Utilities', amount: 3500 },
  { name: 'Water Bill', category: 'Utilities', amount: 800 },
  { name: 'Employee Salary', category: 'Salary', amount: 25000 },
  { name: 'Transport & Logistics', category: 'Transport', amount: 4500 },
  { name: 'Social Media Ads', category: 'Marketing', amount: 2000 },
  { name: 'Shop Maintenance', category: 'Maintenance', amount: 1800 },
  { name: 'Business Insurance', category: 'Insurance', amount: 3000 },
  { name: 'Monthly Tax', category: 'Tax', amount: 5000 },
  { name: 'Office Supplies', category: 'Equipment', amount: 1200 },
];

const ADJUSTMENT_REASONS = [
  'Market price shift',
  'Supplier price update',
  'Seasonal promotion',
  'Minor damage during transport',
  'Expired stock removal',
  'Exchange rate fluctuation',
  'Bulk purchase discount applied',
];

const RETURN_REASONS = [
  'Customer changed mind',
  'Item was damaged',
  'Wrong item delivered',
  'Defective product',
  'Expired product',
];

export interface GenerateTestDataResult {
  success: boolean;
  counts: {
    categories: number;
    items: number;
    sales: number;
    expenses: number;
    adjustments: number;
    returns: number;
    packs: number;
  };
  message: string;
}

export const generateSampleData = (): GenerateTestDataResult => {
  const result: GenerateTestDataResult = {
    success: false,
    counts: { categories: 0, items: 0, sales: 0, expenses: 0, adjustments: 0, returns: 0, packs: 0 },
    message: '',
  };

  try {
    const database = getDB();
    const COUNT = 10;

    // 1. Insert Categories (only if fewer than 10 exist)
    const existingCategories = database.getAllSync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    const existingCatCount = existingCategories?.[0]?.count || 0;
    const categoriesToCreate: number[] = [];
    
    if (existingCatCount < 10) {
      // Use specific categories for test data
      const testCategories = CATEGORIES.slice(0, Math.min(COUNT, 12));
      for (let i = 0; i < testCategories.length; i++) {
        // Check if category name already exists
        const existing = database.getFirstSync<{ id: number }>(
          'SELECT id FROM categories WHERE name = ?', [testCategories[i].name]
        );
        if (existing) {
          categoriesToCreate.push(existing.id);
        } else {
          const id = insertCategory(testCategories[i].name, testCategories[i].icon, false);
          if (id) {
            categoriesToCreate.push(Number(id));
            result.counts.categories++;
          }
        }
      }
    } else {
      // Use existing categories
      const allCats = database.getAllSync<{ id: number }>('SELECT id FROM categories LIMIT 10');
      for (const cat of allCats) {
        categoriesToCreate.push(cat.id);
      }
    }

    if (categoriesToCreate.length === 0) {
      // Fallback: get any available category
      const anyCat = database.getFirstSync<{ id: number }>('SELECT id FROM categories LIMIT 1');
      if (anyCat) {
        for (let i = 0; i < 10; i++) categoriesToCreate.push(anyCat.id);
      } else {
        // Create at least one
        const id = insertCategory('Default', 'box', false);
        if (id) {
          for (let i = 0; i < 10; i++) categoriesToCreate.push(Number(id));
          result.counts.categories = 1;
        }
      }
    }

    // 2. Insert Items (Products) - 10 items
    const itemIds: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      const template = PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length];
      const categoryId = categoriesToCreate[i % categoriesToCreate.length];
      const stockQty = rand(20, 500);
      const unitsPerPack = template.isPack ? rand(6, 50) : 1;
      const createdAt = randomDateInRange(2025, 2026);
      
      const itemId = insertItem({
        name: template.name,
        categoryId,
        companyName: ['', 'Ethio Builders PLC', 'Addis Industrial Supply', 'Habesha Cement S.C.', ''][i % 5],
        purchaseUnit: template.unit,
        baseUnit: template.baseUnit,
        unitsPerPack,
        totalPackQuantity: template.isPack ? Math.floor(stockQty / unitsPerPack) : 0,
        totalBaseQuantity: stockQty,
        packPurchasePrice: template.cost * unitsPerPack,
        basePurchasePrice: template.cost,
        baseSellingPrice: template.price,
        packSellingPrice: template.isPack ? template.price * unitsPerPack : 0,
        allowSellByBaseUnit: !template.isPack,
        allowSellByPackUnit: template.isPack,
        expiryDate: i % 3 === 0 ? new Date(2027, 5, 1).toISOString().split('T')[0] : undefined,
        qualityGrade: ['Grade 1', 'Grade 2', 'Grade 3'][rand(0, 2)],
        notes: '',
        isCredit: false,
        supplierPhone: undefined,
        supplierAccount: undefined,
      });
      
      if (itemId) {
        itemIds.push(Number(itemId));
      }
    }
    result.counts.items = itemIds.length;

    if (itemIds.length === 0) {
      result.message = 'Failed to create items. Aborting.';
      return result;
    }

    // 3. Insert Sales - 10 sales
    const saleIds: number[] = [];
    const paymentMethods = ['Cash', 'Bank', 'Cash', 'Cash', 'Bank', 'Debt', 'Cash', 'Bank', 'Cash', 'Debt'];
    const paymentStatuses = ['Paid', 'Paid', 'Paid', 'Paid', 'Paid', 'Debt', 'Paid', 'Paid', 'Paid', 'Debt'];
    
    for (let i = 0; i < COUNT; i++) {
      const itemId = pick(itemIds);
      const qty = rand(1, 15);
      const unitPrice = PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length].price;
      const totalPrice = qty * unitPrice;
      const isDebt = paymentMethods[i] === 'Debt';
      const createdAt = randomDateInRange(2025, 2026);
      
      try {
        const saleId = insertSale({
          itemId,
          quantity: qty,
          unit: PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length].baseUnit,
          unitType: 'base',
          discount: i % 4 === 0 ? randFloat(10, 100) : 0,
          vat: i % 5 === 0 ? randFloat(5, 15) : 0,
          totalPrice,
          paymentMethod: paymentMethods[i],
          paymentStatus: paymentStatuses[i],
          customerName: isDebt ? CUSTOMER_NAMES[i] : (i % 3 === 0 ? CUSTOMER_NAMES[i] : ''),
          customerPhone: isDebt ? `0911${rand(100000, 999999)}` : '',
        });
        
        if (saleId) {
          saleIds.push(Number(saleId));
        }
      } catch (e) {
        console.warn('Failed to insert test sale:', e);
      }
    }
    result.counts.sales = saleIds.length;

    // 4. Insert Expenses - 10 expenses
    for (let i = 0; i < COUNT; i++) {
      const template = EXPENSE_TEMPLATES[i % EXPENSE_TEMPLATES.length];
      const date = randomDateInRange(2026, 2026);
      
      try {
        insertExpense({
          name: template.name,
          amount: template.amount + rand(-500, 500),
          category: template.category,
          date: fmtDate(date),
          isRecurring: i < 5,
          frequency: i < 5 ? 'monthly' : undefined,
          nextBillingDate: i < 5 ? fmtDate(randomDateInRange(2026, 2026)) : undefined,
          
        });
        result.counts.expenses++;
      } catch (e) {
        console.warn('Failed to insert test expense:', e);
      }
    }

    // 5. Insert Adjustments - 10 adjustments
    const adjTypes = ['price_up', 'price_up', 'price_up', 'price_up', 'price_down', 'price_down', 'price_down', 'damaged', 'damaged', 'damaged'];
    
    for (let i = 0; i < COUNT; i++) {
      const itemId = pick(itemIds);
      const type = adjTypes[i];
      const template = PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length];
      const oldValue = template.price;
      let newValue = oldValue;
      
      if (type === 'price_up') {
        newValue = oldValue + rand(50, 200);
      } else if (type === 'price_down') {
        newValue = Math.max(10, oldValue - rand(20, 100));
      }
      
      const date = randomDateInRange(2026, 2026);
      
      try {
        insertAdjustment({
          itemId,
          type,
          oldValue,
          newValue: type === 'damaged' ? oldValue : newValue,
          quantity: type === 'damaged' ? rand(1, 5) : null,
          unitType: type === 'damaged' ? 'base' : null,
          reason: pick(ADJUSTMENT_REASONS),
          date: fmtDate(date),
          
        });
        result.counts.adjustments++;
      } catch (e) {
        console.warn('Failed to insert test adjustment:', e);
      }
    }

    // 6. Insert Returns - 10 returns (linked to the sales we just created)
    for (let i = 0; i < Math.min(COUNT, saleIds.length); i++) {
      const saleId = saleIds[i];
      if (!saleId) continue;
      const itemId = pick(itemIds);
      const qty = rand(1, 3);
      const date = randomDateInRange(2026, 2026);
      
      try {
        insertReturn({
          saleId,
          itemId,
          quantity: qty,
          unit: 'pcs',
          unitType: 'base',
          totalRefund: qty * PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length].price,
          reason: pick(RETURN_REASONS),
          createdAt: fmtDateTime(new Date()),
        });
        result.counts.returns++;
      } catch (e) {
        console.warn('Failed to insert test return:', e);
      }
    }

    // 7. Insert Item Packs - 10 packs
    for (let i = 0; i < COUNT; i++) {
      const itemId = pick(itemIds);
      const initialQty = rand(20, 100);
      const currentQty = rand(0, initialQty);
      
      try {
        insertPack({
          itemId,
          packNumber: rand(1, 20),
          quantity: currentQty,
          unit: 'pieces',
        });
        result.counts.packs++;
      } catch (e) {
        console.warn('Failed to insert test pack:', e);
      }
    }

    result.success = true;
    result.message = `Test data generated successfully!\n\n` +
      `📦 Categories: ${result.counts.categories}\n` +
      `📦 Items: ${result.counts.items}\n` +
      `💰 Sales: ${result.counts.sales}\n` +
      `💸 Expenses: ${result.counts.expenses}\n` +
      `🔧 Adjustments: ${result.counts.adjustments}\n` +
      `↩️ Returns: ${result.counts.returns}\n` +
      `📋 Packs: ${result.counts.packs}`;

    console.log('[TestData]', result.message);
    return result;
  } catch (error) {
    console.error('[TestData] Error generating sample data:', error);
    result.message = `Error generating test data: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
};

const BULK_CATEGORIES = [
  'Fasteners', 'Measuring & Layout', 'Hardware', 'Paint & Supplies',
  'Electrical', 'Plumbing', 'Packing & Storage', 'Cleaning Supplies',
  'Safety & PPE', 'Building Materials', 'Grocery / Consumables', 'Other'
];

const BULK_PRODUCT_NAMES = [
  'Cement', 'Nail', 'Paint', 'PVC Pipe', 'Electrical Wire', 'Light Bulb',
  'Switch Socket', 'Measuring Tape', 'Spirit Level', 'Bolt', 'Screw',
  'Cooking Oil', 'Milk Powder', 'Sugar', 'Rice', 'Pasta', 'Tomato Paste',
  'Sandpaper', 'Steel Wire', 'Wood Glue', 'Masking Tape', 'Hand Soap',
  'Bleach', 'Safety Gloves', 'Safety Goggles', 'Hard Hat', 'Bucket',
  'Mop', 'Broom', 'Ceramic Tile', 'Adhesive Cement', 'Plaster',
  'Steel Rebar', 'Generator', 'Wheelbarrow', 'Shovel', 'Pickaxe',
  'Lubricant Oil', 'Paint Brush', 'Roller Cover', 'Caulk Gun',
  'Hacksaw Blade', 'Chisel', 'Clamp', 'Level Tool', 'Utility Knife',
  'Extension Cord', 'Power Strip', 'Battery Pack', 'Flashlight'
];

const BULK_UNITS = ['pieces', 'kg', 'litre', 'm', 'sqm', 'roll'];
const BULK_PAYMENT_METHODS = ['Cash', 'Bank', 'Debt'];
const BULK_EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salary', 'Transport', 'Marketing', 'Maintenance', 'Insurance', 'Tax', 'Equipment', 'Supplies'];
const BULK_EXPENSE_NAMES = [
  'Monthly Rent', 'Electricity Bill', 'Water Bill', 'Employee Salary',
  'Transport & Logistics', 'Social Media Ads', 'Shop Maintenance',
  'Business Insurance', 'Monthly Tax', 'Office Supplies',
  'Internet Bill', 'Phone Bill', 'Cleaning Service', 'Security Service',
  'Stationery', 'Software License', 'Fuel', 'Parking Fee',
  'Legal Fees', 'Consulting Fee'
];
const BULK_CUSTOMER_NAMES = [
  'Abebe Kebede', 'Almaz Mekonnen', 'Biruk Tesfaye', 'Chaltu Wondimu',
  'Daniel Abera', 'Eden Belay', 'Fikadu Demissie', 'Genet Eshetu',
  'Haile Fekadu', 'Iman Getachew', 'Jemal Hailu', 'Kebede Lemma',
  'Lemlem Mengistu', 'Mekdes Nigussie', 'Negasi Shiferaw', 'Oumer Tadesse',
  'Rahel Worku', 'Solomon Zeleke', 'Tigist Amanuel', 'Yonas Birtukan',
  'Bontu Mamo', 'Chala Teshome', 'Desta Hailu', 'Eyerusalem Wondimu',
  'Frehiwot Ayele', 'Girma Tadesse', 'Hana Abate', 'Isayas Tekle',
  'Kalkidan Mulugeta', 'Liya Girma', 'Mahlet Desta', 'Nardos Hailu',
  'Rediet Eshetu', 'Saron Tesfaye', 'Tsion Mekonnen', 'Winta Abebe',
  'Yared Negash', 'Zeritu Alemu', 'Amanuel Berhe', 'Beki Ayele'
];
const BULK_ADJ_REASONS = [
  'Market price shift', 'Supplier price update', 'Seasonal promotion',
  'Minor damage during transport', 'Expired stock removal',
  'Exchange rate fluctuation', 'Bulk purchase discount applied',
  'Manufacturer price increase', 'Competitor pricing', 'Inventory write-off'
];

const pickUnit = () => BULK_UNITS[rand(0, BULK_UNITS.length - 1)];
const randomName = () => BULK_PRODUCT_NAMES[rand(0, BULK_PRODUCT_NAMES.length - 1)];
const randomCustomer = () => BULK_CUSTOMER_NAMES[rand(0, BULK_CUSTOMER_NAMES.length - 1)];
const randomPhone = () => `09${rand(10, 99)}${rand(100000, 999999)}`;

export const generateBulkTestData = (count: number): GenerateTestDataResult => {
  const result: GenerateTestDataResult = {
    success: false,
    counts: { categories: 0, items: 0, sales: 0, expenses: 0, adjustments: 0, returns: 0, packs: 0 },
    message: '',
  };

  try {
    const db = getDB();

    // Ensure categories exist
    const existingCats = db.getAllSync<{ id: number }>('SELECT id FROM categories');
    let catIds = existingCats.map(c => c.id);

    if (catIds.length === 0) {
      for (const name of BULK_CATEGORIES) {
        const id = insertCategory(name, 'box', false);
        if (id) catIds.push(Number(id));
      }
      result.counts.categories = catIds.length;
    }

    if (catIds.length === 0) {
      result.message = 'No categories available. Aborting.';
      return result;
    }

    // Ensure a warehouse exists
    const existingWarehouses = db.getAllSync<{ id: number }>('SELECT id FROM warehouses LIMIT 1');
    let warehouseId: number | null = existingWarehouses.length > 0 ? existingWarehouses[0].id : null;
    if (!warehouseId) {
      db.runSync("INSERT INTO warehouses (name, location) VALUES ('Main Warehouse', 'Default')");
      const w = db.getFirstSync<{ id: number }>('SELECT id FROM warehouses LIMIT 1');
      warehouseId = w?.id ?? null;
    }

      const batchSize = 500;
      const ITEM_COLS = 'name,categoryId,companyName,purchaseUnit,baseUnit,unitsPerPack,totalPackQuantity,totalBaseQuantity,packPurchasePrice,basePurchasePrice,baseSellingPrice,packSellingPrice,allowSellByBaseUnit,allowSellByPackUnit,expiryDate,qualityGrade,notes,isCredit,supplierPhone,supplierAccount,supplierId,warehouseId,dueDate,createdAt';
      const ITEM_COLS_COUNT = ITEM_COLS.split(',').length;

    // ── Insert Items ──────────────────────────────────────────────
    const itemIds: number[] = [];
    for (let b = 0; b < Math.ceil(count / batchSize); b++) {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, count);
      const values: string[] = [];
      const params: any[] = [];

      for (let i = start; i < end; i++) {
        const name = `${randomName()} #${i + 1}`;
        const catId = catIds[i % catIds.length];
        const unit = pickUnit();
        const basePrice = randFloat(10, 5000);
        const sellPrice = basePrice * randFloat(1.1, 1.5);
        const stockQty = rand(10, 1000);
        const qualityGrade = ['Grade 1', 'Grade 2', 'Grade 3'][rand(0, 2)];
        const expiryDate = i % 5 === 0 ? `202${rand(6, 8)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}` : null;
        const createdAt = fmtDateTime(randomDateInRange(2024, 2026));

        values.push(`(${Array(ITEM_COLS_COUNT).fill('?').join(',')})`);
        params.push(
          name, catId, '', unit, unit, 1, 0, stockQty,
          basePrice, basePrice, sellPrice, sellPrice,
          1, 0, expiryDate, qualityGrade, '', 0, null, null, null, warehouseId, null, createdAt
        );
      }

      // Build batch insert
      const batchSQL = `INSERT INTO items (${ITEM_COLS}) VALUES ${values.join(',')}`;
      db.runSync(batchSQL, ...params);

      // Fetch inserted IDs
      const inserted = db.getAllSync<{ id: number }>(
        `SELECT id FROM items ORDER BY id DESC LIMIT ${end - start}`
      );
      for (const row of inserted.reverse()) itemIds.push(row.id);
    }
    result.counts.items = itemIds.length;

    if (itemIds.length === 0) {
      result.message = 'Failed to create items.';
      return result;
    }

    // ── Insert Sales (up to count) ────────────────────────────────
    const SALE_COLS = 'itemId,quantity,unit,unitType,discount,vat,totalPrice,paymentMethod,paymentStatus,customerName,customerPhone,packId,dueDate,paidAmount,createdAt';
    const SALE_COLS_COUNT = SALE_COLS.split(',').length;
    let saleCount = 0;
    for (let b = 0; b < Math.ceil(count / batchSize); b++) {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, count);
      const values: string[] = [];
      const params: any[] = [];

      for (let i = start; i < end; i++) {
        const itemId = pick(itemIds);
        const qty = rand(1, 20);
        const unit = pickUnit();
        const unitPrice = randFloat(20, 5000);
        const totalPrice = qty * unitPrice;
        const discount = i % 4 === 0 ? randFloat(0, totalPrice * 0.15) : 0;
        const vat = i % 5 === 0 ? randFloat(5, 15) : 0;
        const method = pick(BULK_PAYMENT_METHODS);
        const isDebt = method === 'Debt';
        const custName = isDebt || i % 3 === 0 ? randomCustomer() : '';
        const custPhone = custName ? randomPhone() : '';
        const paidAmount = isDebt ? randFloat(0, totalPrice * 0.3) : totalPrice;
        const dueDate = isDebt ? fmtDate(randomDateInRange(2026, 2027)) : null;
        const createdAt = fmtDateTime(randomDateInRange(2024, 2026));

        values.push(`(${Array(SALE_COLS_COUNT).fill('?').join(',')})`);
        params.push(
          itemId, qty, unit, 'base', discount, vat, totalPrice,
          method, isDebt ? 'Debt' : 'Paid', custName, custPhone,
          null, dueDate, paidAmount, createdAt
        );
        saleCount++;
      }

      const sql = `INSERT INTO sales (${SALE_COLS}) VALUES ${values.join(',')}`;
      db.runSync(sql, ...params);
    }
    result.counts.sales = saleCount;

    // ── Insert Expenses (up to count) ─────────────────────────────
    const EXPENSE_COLS = 'name,amount,category,date,isRecurring,frequency,nextBillingDate,isOverdue,overdueDays,lastNotified,paymentStatus';
    const EXPENSE_COLS_COUNT = EXPENSE_COLS.split(',').length;
    let expCount = 0;
    for (let b = 0; b < Math.ceil(count / batchSize); b++) {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, count);
      const values: string[] = [];
      const params: any[] = [];

      for (let i = start; i < end; i++) {
        const name = pick(BULK_EXPENSE_NAMES);
        const category = pick(BULK_EXPENSE_CATEGORIES);
        const amount = randFloat(100, 50000);
        const date = fmtDate(randomDateInRange(2024, 2026));
        const isRecurring = i % 7 === 0 ? 1 : 0;
        const frequency = isRecurring ? 'monthly' : null;
        const nextBillingDate = isRecurring ? fmtDate(randomDateInRange(2026, 2027)) : null;

        values.push(`(${Array(EXPENSE_COLS_COUNT).fill('?').join(',')})`);
        params.push(name, amount, category, date, isRecurring, frequency, nextBillingDate, 0, 0, null, 'paid');
        expCount++;
      }

      const sql = `INSERT INTO expenses (${EXPENSE_COLS}) VALUES ${values.join(',')}`;
      db.runSync(sql, ...params);
    }
    result.counts.expenses = expCount;

    // ── Insert Adjustments (up to count / 2) ──────────────────────
    const ADJ_COLS = 'itemId,type,oldValue,newValue,quantity,unitType,reason,date,createdAt';
    const ADJ_COLS_COUNT = ADJ_COLS.split(',').length;
    let adjCount = 0;
    const adjTypes = ['price_up', 'price_down', 'damaged'];
    for (let b = 0; b < Math.ceil(count / 2 / batchSize); b++) {
      const total = Math.min(count / 2, 10000);
      const start = b * batchSize;
      const end = Math.min(start + batchSize, total);
      const values: string[] = [];
      const params: any[] = [];

      for (let i = start; i < end; i++) {
        const itemId = pick(itemIds);
        const type = pick(adjTypes);
        const oldValue = randFloat(10, 5000);
        const newValue = type === 'price_up' ? oldValue * randFloat(1.05, 1.3)
          : type === 'price_down' ? oldValue * randFloat(0.5, 0.95)
          : oldValue;
        const qty = type === 'damaged' ? rand(1, 10) : null;
        const reason = pick(BULK_ADJ_REASONS);
        const date = fmtDate(randomDateInRange(2024, 2026));

        values.push(`(${Array(ADJ_COLS_COUNT).fill('?').join(',')})`);
        params.push(itemId, type, oldValue, newValue, qty, 'base', reason, date, fmtDateTime(new Date()));
        adjCount++;
      }

      const sql = `INSERT INTO adjustments (${ADJ_COLS}) VALUES ${values.join(',')}`;
      db.runSync(sql, ...params);
    }
    result.counts.adjustments = adjCount;

    // ── Insert Contacts (customers / suppliers, at most count / 3) ─
    const CONTACT_COLS = 'fullName,category,subCategory,phone,alternatePhone,accountNumber,notes,createdAt';
    const CONTACT_COLS_COUNT = CONTACT_COLS.split(',').length;
    let contactCount = 0;
    const contactCategories = ['Customer', 'Supplier', 'Both'];
    for (let b = 0; b < Math.ceil(count / 3 / batchSize); b++) {
      const total = Math.min(count / 3, 10000);
      const start = b * batchSize;
      const end = Math.min(start + batchSize, total);
      const values: string[] = [];
      const params: any[] = [];

      for (let i = start; i < end; i++) {
        const fullName = randomCustomer();
        const category = pick(contactCategories);
        const phone = randomPhone();
        const alternatePhone = i % 4 === 0 ? randomPhone() : null;
        const accountNumber = i % 3 === 0 ? `ACC-${rand(10000, 99999)}` : null;

        values.push(`(${Array(CONTACT_COLS_COUNT).fill('?').join(',')})`);
        params.push(fullName, category, null, phone, alternatePhone, accountNumber, null, fmtDateTime(randomDateInRange(2024, 2026)));
        contactCount++;
      }

      const sql = `INSERT INTO contacts (${CONTACT_COLS}) VALUES ${values.join(',')}`;
      db.runSync(sql, ...params);
    }
    result.counts.returns = contactCount; // reuse field for contacts count

    // ── Insert Item Packs (at most count / 2) ─────────────────────
    const PACK_COLS = 'itemId,packNumber,initialQuantity,currentQuantity,unit,status';
    const PACK_COLS_COUNT = PACK_COLS.split(',').length;
    let packCount = 0;
    for (let b = 0; b < Math.ceil(count / 2 / batchSize); b++) {
      const total = Math.min(count / 2, 10000);
      const start = b * batchSize;
      const end = Math.min(start + batchSize, total);
      const values: string[] = [];
      const params: any[] = [];

      for (let i = start; i < end; i++) {
        const itemId = pick(itemIds);
        const initialQty = rand(10, 200);
        const currentQty = rand(0, initialQty);

        values.push(`(${Array(PACK_COLS_COUNT).fill('?').join(',')})`);
        params.push(itemId, rand(1, 50), initialQty, currentQty, 'pieces', currentQty > 0 ? 'Not Opened' : 'Empty');
        packCount++;
      }

      const sql = `INSERT INTO item_packs (${PACK_COLS}) VALUES ${values.join(',')}`;
      db.runSync(sql, ...params);
    }
    result.counts.packs = packCount;

    result.success = true;
    result.message =
      `✅ Generated ${count} records:\n` +
      `📦 Items: ${result.counts.items}\n` +
      `💰 Sales: ${result.counts.sales}\n` +
      `💸 Expenses: ${result.counts.expenses}\n` +
      `🔧 Adjustments: ${result.counts.adjustments}\n` +
      `👤 Contacts: ${result.counts.returns}\n` +
      `📋 Packs: ${result.counts.packs}\n` +
      `🏷️ Categories: ${result.counts.categories || 'existing'}`;

    console.log('[BulkTestData]', result.message);
    return result;
  } catch (error) {
    console.error('[BulkTestData] Error:', error);
    result.message = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
};
