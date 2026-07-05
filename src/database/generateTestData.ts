import {
  getDB,
  insertCategory,
  insertItem,
  insertSale,
  insertExpense,
  insertAdjustment,
  insertPack,
  insertReturn,
  insertContact,
  insertWarehouse,
  insertBudget,
  insertBudgetCategory,
  insertRecurringTemplate,
} from './db';
import { createNotification, createReminder, updateReminderStatus, setPreference } from './notifications';

// Helper utilities
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number, decimals = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
};
const randomDateInRange = (startYear: number, endYear: number) => {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
};
const fmtDate = (d: Date) => d.toISOString().split('T')[0];
const fmtDateTime = (d: Date) => d.toISOString();
const randomPhone = () => `09${rand(10, 99)}${rand(100000, 999999)}`;
const randomAccount = () => `ACC-${rand(10000, 99999)}`;

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

interface ProductTemplate {
  name: string; unit: string; baseUnit: string; categoryIdx: number;
  price: number; cost: number; isPack: boolean; hasExpiry: boolean;
  supplierCallEnabled?: boolean; isCredit?: boolean;
}
const PRODUCT_TEMPLATES: ProductTemplate[] = [
  { name: 'Cement (50KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 550, cost: 480, isPack: false, hasExpiry: true },
  { name: 'Nail (5mm)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 25, cost: 18, isPack: false, hasExpiry: false },
  { name: 'Nail (10mm)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 35, cost: 25, isPack: false, hasExpiry: false },
  { name: 'Paint Red (4L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 3, price: 1200, cost: 900, isPack: false, hasExpiry: true },
  { name: 'Paint White (4L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 3, price: 1100, cost: 820, isPack: false, hasExpiry: true },
  { name: 'PVC Pipe 1"', unit: 'm', baseUnit: 'm', categoryIdx: 5, price: 150, cost: 110, isPack: false, hasExpiry: false },
  { name: 'PVC Pipe 2"', unit: 'm', baseUnit: 'm', categoryIdx: 5, price: 250, cost: 190, isPack: false, hasExpiry: false },
  { name: 'PVC Elbow 1"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 5, price: 45, cost: 30, isPack: false, hasExpiry: false },
  { name: 'Electrical Wire 1.5mm', unit: 'm', baseUnit: 'm', categoryIdx: 4, price: 85, cost: 60, isPack: false, hasExpiry: false },
  { name: 'Electrical Wire 2.5mm', unit: 'm', baseUnit: 'm', categoryIdx: 4, price: 140, cost: 105, isPack: false, hasExpiry: false },
  { name: 'Light Bulb LED 9W', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 180, cost: 130, isPack: false, hasExpiry: false },
  { name: 'Light Bulb LED 12W', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 220, cost: 165, isPack: false, hasExpiry: false },
  { name: 'Switch Socket', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 90, cost: 60, isPack: false, hasExpiry: false },
  { name: 'Measuring Tape 5m', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 120, cost: 80, isPack: false, hasExpiry: false },
  { name: 'Measuring Tape 10m', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 200, cost: 145, isPack: false, hasExpiry: false },
  { name: 'Spirit Level 60cm', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 1, price: 350, cost: 250, isPack: false, hasExpiry: false },
  { name: 'Bolt M8', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 8, cost: 5, isPack: false, hasExpiry: false },
  { name: 'Bolt M10', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 12, cost: 7, isPack: false, hasExpiry: false },
  { name: 'Screw 2"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 3, cost: 1.5, isPack: false, hasExpiry: false },
  { name: 'Screw 4"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 0, price: 5, cost: 3, isPack: false, hasExpiry: false },
  { name: 'Cooking Oil (3L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 10, price: 380, cost: 320, isPack: false, hasExpiry: true },
  { name: 'Milk Powder (400g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 250, cost: 195, isPack: false, hasExpiry: true },
  { name: 'Sugar (50KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 10, price: 2800, cost: 2400, isPack: false, hasExpiry: false },
  { name: 'Rice (10KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 10, price: 650, cost: 520, isPack: false, hasExpiry: false },
  { name: 'Pasta (500g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 45, cost: 32, isPack: false, hasExpiry: true },
  { name: 'Tomato Paste (500g)', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 10, price: 85, cost: 60, isPack: false, hasExpiry: true },
  { name: 'Sandpaper Grit 120', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 3, price: 35, cost: 22, isPack: false, hasExpiry: false },
  { name: 'Steel Wire (2mm)', unit: 'm', baseUnit: 'm', categoryIdx: 2, price: 55, cost: 38, isPack: false, hasExpiry: false },
  { name: 'Wood Glue (1L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 2, price: 180, cost: 130, isPack: false, hasExpiry: true },
  { name: 'Masking Tape', unit: 'roll', baseUnit: 'pieces', categoryIdx: 3, price: 65, cost: 42, isPack: false, hasExpiry: false },
  { name: 'Hand Soap (5L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 7, price: 350, cost: 270, isPack: false, hasExpiry: false },
  { name: 'Bleach (1L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 7, price: 80, cost: 55, isPack: false, hasExpiry: false },
  { name: 'Safety Gloves', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 120, cost: 85, isPack: false, hasExpiry: false },
  { name: 'Safety Goggles', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 200, cost: 150, isPack: false, hasExpiry: false },
  { name: 'Hard Hat', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 8, price: 380, cost: 280, isPack: false, hasExpiry: false },
  { name: 'Bucket 10L', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 150, cost: 100, isPack: false, hasExpiry: false },
  { name: 'Mop', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 95, cost: 65, isPack: false, hasExpiry: false },
  { name: 'Broom', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 7, price: 70, cost: 45, isPack: false, hasExpiry: false },
  { name: 'Ceramic Tile 30x30', unit: 'sqm', baseUnit: 'sqm', categoryIdx: 9, price: 450, cost: 350, isPack: false, hasExpiry: false },
  { name: 'Ceramic Tile 60x60', unit: 'sqm', baseUnit: 'sqm', categoryIdx: 9, price: 750, cost: 580, isPack: false, hasExpiry: false },
  { name: 'Adhesive Cement', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 180, cost: 130, isPack: false, hasExpiry: true },
  { name: 'Plaster (25KG)', unit: 'kg', baseUnit: 'kg', categoryIdx: 9, price: 220, cost: 165, isPack: false, hasExpiry: true },
  { name: 'Steel Rebar 12mm', unit: 'm', baseUnit: 'm', categoryIdx: 9, price: 320, cost: 250, isPack: false, hasExpiry: false },
  { name: 'Steel Rebar 16mm', unit: 'm', baseUnit: 'm', categoryIdx: 9, price: 450, cost: 360, isPack: false, hasExpiry: false },
  { name: 'Generator 2.5kVA', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 12500, cost: 10000, isPack: false, hasExpiry: false, isCredit: true },
  { name: 'Generator 5kVA', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 22000, cost: 18000, isPack: false, hasExpiry: false, isCredit: true },
  { name: 'Wheelbarrow', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 1800, cost: 1400, isPack: false, hasExpiry: false },
  { name: 'Shovel', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 350, cost: 250, isPack: false, hasExpiry: false },
  { name: 'Pickaxe', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 500, cost: 380, isPack: false, hasExpiry: false },
  { name: 'Lubricant Oil (5L)', unit: 'litre', baseUnit: 'litre', categoryIdx: 2, price: 450, cost: 360, isPack: false, hasExpiry: true },
  { name: 'Paint Brush 2"', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 3, price: 85, cost: 55, isPack: false, hasExpiry: false },
  { name: 'Roller Cover', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 3, price: 120, cost: 80, isPack: false, hasExpiry: false },
  { name: 'Caulk Gun', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 3, price: 160, cost: 110, isPack: false, hasExpiry: false },
  { name: 'Hacksaw Blade', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 45, cost: 28, isPack: false, hasExpiry: false },
  { name: 'Chisel', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 180, cost: 120, isPack: false, hasExpiry: false },
  { name: 'Utility Knife', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 2, price: 95, cost: 65, isPack: false, hasExpiry: false },
  { name: 'Extension Cord 10m', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 280, cost: 200, isPack: false, hasExpiry: false },
  { name: 'Power Strip 6-outlet', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 350, cost: 260, isPack: false, hasExpiry: false },
  { name: 'Battery Pack 12V', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 850, cost: 650, isPack: false, hasExpiry: true },
  { name: 'Flashlight LED', unit: 'pieces', baseUnit: 'pieces', categoryIdx: 4, price: 220, cost: 160, isPack: false, hasExpiry: false },
];

const CUSTOMER_NAMES = [
  'Abebe Kebede', 'Almaz Mekonnen', 'Biruk Tesfaye', 'Chaltu Wondimu',
  'Daniel Abera', 'Eden Belay', 'Fikadu Demissie', 'Genet Eshetu',
  'Haile Fekadu', 'Iman Getachew', 'Jemal Hailu', 'Kebede Lemma',
  'Lemlem Mengistu', 'Mekdes Nigussie', 'Negasi Shiferaw', 'Oumer Tadesse',
  'Rahel Worku', 'Solomon Zeleke', 'Tigist Amanuel', 'Yonas Birtukan',
  'Bontu Mamo', 'Chala Teshome', 'Desta Hailu', 'Eyerusalem Wondimu',
  'Frehiwot Ayele', 'Girma Tadesse', 'Hana Abate', 'Isayas Tekle',
  'Kalkidan Mulugeta', 'Liya Girma', 'Mahlet Desta', 'Nardos Hailu',
  'Rediet Eshetu', 'Saron Tesfaye', 'Tsion Mekonnen', 'Winta Abebe',
  'Yared Negash', 'Zeritu Alemu', 'Amanuel Berhe', 'Beki Ayele',
];

const SUPPLIER_NAMES = [
  'Ethio Builders PLC', 'Addis Industrial Supply', 'Habesha Cement S.C.',
  'Sheba Paints Factory', 'Mekelle Steel Works', 'Bahir Dar Plastics',
  'Dire Dawa Hardware', 'Jimma Agrovet PLC', 'Gondar Tools MFG',
  'Awash Electrical Supply', 'Oromia Packaging Co.', 'Somali Trading Group',
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
  { name: 'Internet Bill', category: 'Utilities', amount: 2500 },
  { name: 'Phone Bill', category: 'Utilities', amount: 900 },
  { name: 'Fuel', category: 'Transport', amount: 6000 },
  { name: 'Security Service', category: 'Services', amount: 3500 },
  { name: 'Cleaning Service', category: 'Services', amount: 1500 },
];

const ADJUSTMENT_REASONS = [
  'Market price shift', 'Supplier price update', 'Seasonal promotion',
  'Minor damage during transport', 'Expired stock removal',
  'Exchange rate fluctuation', 'Bulk purchase discount applied',
  'Manufacturer price increase', 'Competitor pricing', 'Inventory write-off',
];

const RETURN_REASONS = [
  'Customer changed mind', 'Item was damaged', 'Wrong item delivered',
  'Defective product', 'Expired product', 'Over-ordering',
];

const NOTIFICATION_TYPES: { key: string; type: string; category: string; icon: string; title: string; message: string }[] = [
  { key: 'stock', type: 'low_stock', category: 'inventory', icon: 'package', title: 'Low Stock Alert', message: '{item} is running low ({qty} remaining)' },
  { key: 'expiration', type: 'expiring_soon', category: 'inventory', icon: 'clock', title: 'Expiration Warning', message: '{item} expires on {date}' },
  { key: 'daily', type: 'daily_summary', category: 'general', icon: 'info', title: 'Daily Summary', message: 'Today: {sales} sales, {expenses} expenses' },
  { key: 'credit', type: 'credit_due', category: 'customer', icon: 'handshake', title: 'Credit Due Reminder', message: 'Credit payment due for {customer} ({amount})' },
  { key: 'debt', type: 'debt_overdue', category: 'customer', icon: 'alert-triangle', title: 'Debt Overdue', message: '{customer} overdue by {amount}' },
  { key: 'budget', type: 'budget_alert', category: 'budget', icon: 'trending-up', title: 'Budget Alert', message: '{category} at {percentage}% of budget' },
  { key: 'budgetStatus', type: 'budget_status', category: 'budget', icon: 'check-circle', title: 'Budget Status', message: '{budget}: {spent}/{planned}' },
  { key: 'expense', type: 'expense_recorded', category: 'expense', icon: 'wallet', title: 'Expense Recorded', message: '{name}: {amount}' },
  { key: 'largeExpense', type: 'large_expense', category: 'expense', icon: 'alert-triangle', title: 'Large Expense', message: 'Large expense of {amount} recorded' },
  { key: 'recurring', type: 'recurring_due', category: 'recurring', icon: 'repeat', title: 'Recurring Due', message: '{name} recurring payment due' },
  { key: 'weeklySummary', type: 'weekly_report', category: 'report', icon: 'receipt', title: 'Weekly Report', message: 'Weekly: revenue {revenue}, expenses {expenses}' },
  { key: 'monthlySummary', type: 'monthly_report', category: 'report', icon: 'trending-up', title: 'Monthly Report', message: 'Monthly: profit {profit}, growth {growth}%' },
  { key: 'supplier_check', type: 'supplier_price_change', category: 'supplier', icon: 'truck', title: 'Supplier Price Change', message: '{supplier} changed price for {item}' },
];

const PAYMENT_METHODS = ['Cash', 'Bank', 'Telebirr', 'CPE'];

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
    contacts: number;
    warehouses: number;
    budgets: number;
    budgetCategories: number;
    recurringTemplates: number;
    notifications: number;
    reminders: number;
    notificationPreferences: number;
    orders: number;
  };
  message: string;
}

export const generateSampleData = (): GenerateTestDataResult => {
  const result: GenerateTestDataResult = {
    success: false,
    counts: {
      categories: 0, items: 0, sales: 0, expenses: 0, adjustments: 0,
      returns: 0, packs: 0, contacts: 0, warehouses: 0, budgets: 0,
      budgetCategories: 0, recurringTemplates: 0, notifications: 0,
      reminders: 0, notificationPreferences: 0, orders: 0,
    },
    message: '',
  };

  try {
    const database = getDB();
    const COUNT = 50;

    // ── 1. Categories ──────────────────────────────────────────────
    const catIds: number[] = [];
    for (const cat of CATEGORIES) {
      const existing = database.getFirstSync<{ id: number }>(
        'SELECT id FROM categories WHERE name = ?', [cat.name]
      );
      if (existing) {
        catIds.push(existing.id);
      } else {
        const id = insertCategory(cat.name, cat.icon, false);
        if (id) { catIds.push(Number(id)); result.counts.categories++; }
      }
    }

    if (catIds.length === 0) {
      result.message = 'No categories available. Aborting.';
      return result;
    }

    // ── 2. Warehouses ─────────────────────────────────────────────
    const warehouseNames = ['Main Warehouse', 'North Branch', 'South Depot', 'Central Storage'];
    const warehouseIds: number[] = [];
    for (const name of warehouseNames) {
      const existing = database.getFirstSync<{ id: number }>(
        'SELECT id FROM warehouses WHERE name = ?', [name]
      );
      if (existing) {
        warehouseIds.push(existing.id);
      } else {
        const id = insertWarehouse({ name, location: `${name} Location`, contactPerson: pick(CUSTOMER_NAMES), phone: randomPhone() });
        if (id) { warehouseIds.push(Number(id)); result.counts.warehouses++; }
      }
    }

    // ── 3. Contacts (Suppliers + Customers) ──────────────────────
    const contactIds: number[] = [];
    const supplierContactIds: number[] = [];
    const customerNames: string[] = [];

    // Suppliers
    for (const name of SUPPLIER_NAMES) {
      const id = insertContact({
        fullName: name, category: 'Supplier',
        subCategory: pick(['Wholesale', 'Manufacturer', 'Distributor', 'Importer']),
        phone: randomPhone(), alternatePhone: randomPhone(),
        accountNumber: randomAccount(), notes: `Primary contact for ${name}`,
      });
      if (id) { contactIds.push(Number(id)); supplierContactIds.push(Number(id)); result.counts.contacts++; }
    }

    // Customers
    for (let i = 0; i < 24; i++) {
      const name = CUSTOMER_NAMES[i];
      customerNames.push(name);
      const id = insertContact({
        fullName: name, category: 'Customer',
        subCategory: pick(['Regular', 'Wholesale', 'Contractor', 'Retail']),
        phone: randomPhone(), alternatePhone: i % 3 === 0 ? randomPhone() : undefined,
        accountNumber: i % 2 === 0 ? randomAccount() : undefined,
        notes: i % 4 === 0 ? `VIP customer since 2024` : undefined,
      });
      if (id) { contactIds.push(Number(id)); result.counts.contacts++; }
    }

    // Mixed (Both)
    for (let i = 0; i < 4; i++) {
      const id = insertContact({
        fullName: CUSTOMER_NAMES[24 + i], category: 'Both',
        subCategory: 'Wholesale', phone: randomPhone(),
        accountNumber: randomAccount(),
      });
      if (id) { contactIds.push(Number(id)); result.counts.contacts++; }
    }

    // ── 4. Items ──────────────────────────────────────────────────
    const itemIds: number[] = [];
    const itemTemplateMap = new Map<number, ProductTemplate>();

    for (let i = 0; i < Math.min(COUNT, PRODUCT_TEMPLATES.length); i++) {
      const template = PRODUCT_TEMPLATES[i];
      const categoryId = catIds[template.categoryIdx % catIds.length];
      const unitsPerPack = template.isPack ? rand(6, 50) : 1;
      const stockQty = rand(20, 500);

      const itemId = insertItem({
        name: template.name,
        categoryId,
        companyName: pick(['', 'Ethio Builders PLC', 'Addis Industrial Supply', 'Habesha Cement S.C.', 'Sheba Paints']),
        purchaseUnit: template.unit,
        baseUnit: template.baseUnit,
        unitsPerPack,
        totalPackQuantity: template.isPack ? Math.floor(stockQty / unitsPerPack) : 0,
        totalBaseQuantity: stockQty,
        packPurchasePrice: template.cost * unitsPerPack,
        basePurchasePrice: template.cost,
        baseSellingPrice: template.price,
        packSellingPrice: template.isPack ? template.price * unitsPerPack : 0,
        allowSellByBaseUnit: true,
        allowSellByPackUnit: template.isPack,
        expiryDate: template.hasExpiry && i % 2 === 0
          ? fmtDate(new Date(2027, rand(0, 11), rand(1, 28)))
          : undefined,
        qualityGrade: ['Grade 1', 'Grade 2', 'Grade 3'][rand(0, 2)],
        notes: '',
        isCredit: template.isCredit || false,
        supplierPhone: i % 5 === 0 ? randomPhone() : undefined,
        supplierAccount: i % 4 === 0 ? randomAccount() : undefined,
        supplierCallEnabled: i % 6 === 0,
      });

      if (itemId) {
        itemIds.push(Number(itemId));
        itemTemplateMap.set(Number(itemId), template);
      }
    }
    result.counts.items = itemIds.length;

    if (itemIds.length === 0) {
      result.message = 'Failed to create items. Aborting.';
      return result;
    }

    // ── 5. Sales (including batch sales, debt, due dates) ────────
    const saleIds: number[] = [];
    const debtSaleCustomerMap = new Map<string, number[]>();

    for (let i = 0; i < COUNT * 2; i++) {
      const itemId = pick(itemIds);
      const template = itemTemplateMap.get(itemId)!;
      const qty = rand(1, 20);
      const unitPrice = template.price + rand(-50, 100);
      const totalPrice = Math.max(1, qty * unitPrice);
      const method = pick(PAYMENT_METHODS);
      const isDebt = method === 'Debt' || (method === 'CPE' && i % 3 === 0);
      const custName = isDebt || i % 3 === 0 ? pick(CUSTOMER_NAMES) : '';
      const custPhone = custName ? randomPhone() : '';

      try {
        const saleId = insertSale({
          itemId, quantity: qty,
          unit: template.baseUnit, unitType: 'base',
          discount: i % 5 === 0 ? randFloat(10, totalPrice * 0.1) : 0,
          vat: i % 7 === 0 ? randFloat(5, 15) : 0,
          totalPrice,
          paymentMethod: method,
          paymentStatus: isDebt ? 'Debt' : 'Paid',
          customerName: custName,
          customerPhone: custPhone,
        });

        if (saleId) {
          const sid = Number(saleId);
          saleIds.push(sid);
          if (isDebt && custName) {
            if (!debtSaleCustomerMap.has(custName)) debtSaleCustomerMap.set(custName, []);
            debtSaleCustomerMap.get(custName)!.push(sid);
          }
        }
      } catch (e) {
        console.warn('Failed to insert test sale:', e);
      }
    }
    result.counts.sales = saleIds.length;

    // ── 6. Debt Payments ──────────────────────────────────────────
    for (const [customerName, customerSaleIds] of debtSaleCustomerMap) {
      const payments = rand(1, 3);
      for (let p = 0; p < payments; p++) {
        const amount = randFloat(500, 5000);
        const saleId = pick(customerSaleIds);
        const type = pick(['full', 'partial', 'full', 'partial']);
        try {
          database.runSync(
            `INSERT INTO debt_payments (saleId, customerName, customerPhone, amount, type, note, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            saleId, customerName, randomPhone(), amount, type,
            type === 'full' ? 'Full settlement' : `Partial payment #${p + 1}`,
            fmtDateTime(randomDateInRange(2025, 2026)),
          );
        } catch (e) {
          console.warn('Failed to insert debt payment:', e);
        }
      }
    }

    // ── 7. Returns (linked to sales) ──────────────────────────────
    for (let i = 0; i < Math.min(COUNT, saleIds.length); i++) {
      const saleId = saleIds[i];
      if (!saleId) continue;
      const itemId = pick(itemIds);
      const qty = rand(1, 3);
      const template = itemTemplateMap.get(itemId)!;

      try {
        insertReturn({
          saleId, itemId, quantity: qty,
          unit: template.baseUnit, unitType: 'base',
          totalRefund: qty * template.price,
          reason: pick(RETURN_REASONS),
          createdAt: fmtDateTime(randomDateInRange(2025, 2026)),
        });
        result.counts.returns++;
      } catch (e) {
        console.warn('Failed to insert test return:', e);
      }
    }

    // ── 8. Adjustments (price_up, price_down, damaged) ──────────
    for (let i = 0; i < COUNT; i++) {
      const itemId = pick(itemIds);
      const template = itemTemplateMap.get(itemId)!;
      const type = pick(['price_up', 'price_down', 'damaged', 'price_up', 'price_down']);
      const oldValue = template.price;
      let newValue = oldValue;
      if (type === 'price_up') newValue = oldValue + rand(50, 300);
      else if (type === 'price_down') newValue = Math.max(10, oldValue - rand(20, 150));

      try {
        insertAdjustment({
          itemId, type,
          oldValue, newValue: type === 'damaged' ? oldValue : newValue,
          quantity: type === 'damaged' ? rand(1, 8) : null,
          unitType: type === 'damaged' ? 'base' : null,
          reason: pick(ADJUSTMENT_REASONS),
          date: fmtDate(randomDateInRange(2025, 2026)),
        });
        result.counts.adjustments++;
      } catch (e) {
        console.warn('Failed to insert test adjustment:', e);
      }
    }

    // ── 9. Item Packs ─────────────────────────────────────────────
    for (let i = 0; i < COUNT; i++) {
      const itemId = pick(itemIds);
      const initialQty = rand(20, 200);
      const currentQty = rand(0, initialQty);

      try {
        insertPack({
          itemId, packNumber: rand(1, 50),
          quantity: currentQty, unit: 'pieces',
        });
        result.counts.packs++;
      } catch (e) {
        console.warn('Failed to insert test pack:', e);
      }

      // Also insert packs via raw SQL to set initialQuantity/currentQuantity/status
      try {
        database.runSync(
          `INSERT INTO item_packs (itemId, packNumber, initialQuantity, currentQuantity, unit, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          itemId, rand(51, 99), initialQty, currentQty, 'pieces',
          currentQty > 0 ? (currentQty < initialQty * 0.3 ? 'Opened' : 'Not Opened') : 'Empty',
        );
        result.counts.packs++;
      } catch (e) {
        // Some item_packs may already exist; skip silently
      }
    }

    // ── 10. Expenses ─────────────────────────────────────────────
    for (let i = 0; i < COUNT; i++) {
      const template = pick(EXPENSE_TEMPLATES);
      const date = randomDateInRange(2025, 2026);

      try {
        insertExpense({
          name: template.name,
          amount: template.amount + rand(-500, 500),
          category: template.category,
          date: fmtDate(date),
          isRecurring: i < 6,
          frequency: i < 6 ? pick(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']) : undefined,
          nextBillingDate: i < 6 ? fmtDate(randomDateInRange(2026, 2027)) : undefined,
        });
        result.counts.expenses++;
      } catch (e) {
        console.warn('Failed to insert test expense:', e);
      }
    }

    // ── 11. Recurring Expense Templates ──────────────────────────
    const recurringTemplates = [
      { name: 'Monthly Rent', category: 'Rent', amount: 15000, frequency: 'Monthly' as const, startDate: '2024-01-01' },
      { name: 'Electricity Bill', category: 'Utilities', amount: 3500, frequency: 'Monthly' as const, startDate: '2024-01-01' },
      { name: 'Water Bill', category: 'Utilities', amount: 800, frequency: 'Monthly' as const, startDate: '2024-01-01' },
      { name: 'Employee Salaries', category: 'Salary', amount: 25000, frequency: 'Monthly' as const, startDate: '2024-01-01' },
      { name: 'Transport & Logistics', category: 'Transport', amount: 4500, frequency: 'Weekly' as const, startDate: '2024-01-06' },
      { name: 'Internet Service', category: 'Utilities', amount: 2500, frequency: 'Monthly' as const, startDate: '2024-02-01' },
      { name: 'Insurance Premium', category: 'Insurance', amount: 3000, frequency: 'Monthly' as const, startDate: '2024-03-01' },
    ];
    for (const tpl of recurringTemplates) {
      try {
        insertRecurringTemplate(tpl as any);
        result.counts.recurringTemplates++;
      } catch (e) {
        console.warn('Failed to insert recurring template:', e);
      }
    }

    // ── 12. Budgets + Budget Categories ──────────────────────────
    const budgetTypes = ['business', 'department', 'project', 'branch'] as const;
    const budgetPeriods = ['monthly', 'quarterly', 'yearly'] as const;

    // Create a budget for each type
    for (let i = 0; i < 4; i++) {
      const budgetType = budgetTypes[i % budgetTypes.length];
      const period = budgetPeriods[i % budgetPeriods.length] as any;
      const year = 2026;

      const budgetId = insertBudget({
        name: `${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} Budget ${year}`,
        type: budgetType,
        period,
        year,
        month: period === 'monthly' ? rand(1, 12) : undefined,
        quarter: period === 'quarterly' ? rand(1, 4) : undefined,
        notes: `Planned ${budgetType} budget for ${year}`,
      });

      if (budgetId) {
        result.counts.budgets++;

        // Add budget categories
        const budgetCatNames = [
          'employee_salaries_labor', 'rent', 'utilities_electricity_water_internet',
          'inventory_purchases', 'marketing_advertising', 'maintenance_repairs',
          'transport_logistics', 'taxes_licenses', 'insurance', 'miscellaneous',
        ];

        for (let c = 0; c < rand(4, 8); c++) {
          const bcName = budgetCatNames[c % budgetCatNames.length];
          const catId = insertBudgetCategory(Number(budgetId), {
            category: bcName,
            plannedAmount: randFloat(1000, 50000),
            notes: rand(0, 1) ? `Allocated for ${bcName.replace(/_/g, ' ')}` : undefined,
          });
          if (catId) {
            result.counts.budgetCategories++;

            // Optionally add a budget adjustment for some categories
            if (c % 3 === 0) {
              try {
                database.runSync(
                  `INSERT INTO budget_adjustments (budgetCategoryId, previousAmount, newAmount, reason, status, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  Number(catId), randFloat(500, 40000), randFloat(1000, 50000),
                  pick(['Reallocation', 'Emergency fund', 'Cost overrun', 'Savings identified']),
                  pick(['pending', 'approved', 'approved', 'rejected']),
                  fmtDateTime(randomDateInRange(2026, 2026)),
                );
              } catch (e) {
                console.warn('Failed to insert budget adjustment:', e);
              }
            }
          }
        }
      }
    }

    // ── 13. Notification Preferences ─────────────────────────────
    const notifKeys = [
      'stock', 'expiration', 'daily', 'credit', 'debt', 'budget', 'budgetStatus',
      'expense', 'largeExpense', 'recurring', 'weeklySummary', 'monthlySummary',
    ];
    for (const key of notifKeys) {
      try {
        setPreference({
          key,
          enabled: Math.random() > 0.15,
          quietStart: Math.random() > 0.5 ? '22:00' : undefined,
          quietEnd: Math.random() > 0.5 ? '07:00' : undefined,
          sound: pick(['default', 'bell', 'chime', 'alert']),
          vibration: Math.random() > 0.2,
        });
        result.counts.notificationPreferences++;
      } catch (e) {
        console.warn('Failed to set notification preference:', e);
      }
    }

    // ── 14. Notifications (in-app notification center) ──────────
    for (let i = 0; i < COUNT / 2; i++) {
      const notifDef = pick(NOTIFICATION_TYPES);
      const items = ['Cement', 'Nail', 'Paint', 'Steel', 'Pipe', 'Light Bulb', 'Generator'];
      const isRead = Math.random() > 0.4;
      const isDismissed = !isRead && Math.random() > 0.7;
      const isResolved = isRead && Math.random() > 0.6;

      try {
        const notif = createNotification({
          type: notifDef.type,
          category: notifDef.category as any,
          priority: pick(['low', 'normal', 'high', 'critical']),
          title: notifDef.title,
          message: notifDef.message
            .replace('{item}', pick(items))
            .replace('{qty}', String(rand(2, 20)))
            .replace('{date}', fmtDate(randomDateInRange(2026, 2027)))
            .replace('{sales}', String(rand(5, 50)))
            .replace('{expenses}', String(rand(1000, 10000)))
            .replace('{customer}', pick(CUSTOMER_NAMES))
            .replace('{amount}', String(randFloat(500, 10000)))
            .replace('{percentage}', String(rand(70, 120)))
            .replace('{supplier}', pick(SUPPLIER_NAMES)),
          icon: notifDef.icon as any,
          deepLink: i % 3 === 0 ? `/inventory/${pick(itemIds)}` : undefined,
          data: { source: 'test_data', generatedAt: new Date().toISOString() },
          requiresAction: notifDef.category === 'budget' || notifDef.category === 'customer',
          groupKey: i % 5 === 0 ? `group_${notifDef.type}` : undefined,
          expiresAt: Math.random() > 0.7 ? fmtDateTime(randomDateInRange(2027, 2028)) : undefined,
        });

        if (notif) {
          // Simulate read/dismissed/resolved states after creation
          if (isRead) {
            database.runSync(
              `UPDATE notifications SET isRead = 1, readAt = CURRENT_TIMESTAMP WHERE id = ?`,
              [notif.id],
            );
          }
          if (isDismissed) {
            database.runSync(
              `UPDATE notifications SET isDismissed = 1 WHERE id = ?`,
              [notif.id],
            );
          }
          if (isResolved) {
            database.runSync(
              `UPDATE notifications SET isResolved = 1 WHERE id = ?`,
              [notif.id],
            );
          }
          result.counts.notifications++;
        }
      } catch (e) {
        console.warn('Failed to create test notification:', e);
      }
    }

    // ── 15. Scheduled Reminders ──────────────────────────────────
    const reminderDefs = [
      { type: 'low_stock_check', title: 'Check Low Stock Items', body: 'Review items that need restocking' },
      { type: 'supplier_call', title: 'Call Suppliers', body: 'Weekly supplier price check reminder' },
      { type: 'debt_collection', title: 'Follow Up on Debts', body: 'Contact customers with overdue payments' },
      { type: 'expense_review', title: 'Review Expenses', body: 'Weekly expense review' },
      { type: 'inventory_count', title: 'Monthly Inventory Count', body: 'Schedule inventory count for end of month' },
      { type: 'budget_review', title: 'Budget Review', body: 'Review budget vs actual spending' },
    ];
    for (let i = 0; i < reminderDefs.length; i++) {
      const def = reminderDefs[i];
      const triggerDate = randomDateInRange(2026, 2026);
      try {
        const reminder = createReminder({
          type: def.type as any,
          refId: i < 2 ? pick(itemIds) : undefined,
          title: def.title,
          body: def.body,
          triggerAt: fmtDateTime(triggerDate),
          repeatInterval: i % 2 === 0 ? pick(['daily', 'weekly', 'monthly', 'yearly']) : undefined,
        });
        if (reminder) {
          result.counts.reminders++;

          // Set some to fired/completed status
          if (i % 3 === 0) {
            updateReminderStatus(reminder.id, 'fired');
          } else if (i % 5 === 0) {
            updateReminderStatus(reminder.id, 'completed');
          } else if (i % 7 === 0) {
            updateReminderStatus(reminder.id, 'cancelled');
          }
        }
      } catch (e) {
        console.warn('Failed to create reminder:', e);
      }
    }

    // ── 16. Orders ───────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const customerName = pick(CUSTOMER_NAMES);
      const orderItems = pickN(itemIds, rand(1, 4));
      const items = orderItems.map((id) => {
        const tpl = itemTemplateMap.get(id);
        return {
          itemId: id,
          itemName: tpl?.name || 'Unknown',
          quantity: rand(1, 10),
          unitType: 'base' as const,
          unit: tpl?.baseUnit || 'pcs',
          price: (tpl?.price || 100) + rand(-20, 50),
        };
      });

      try {
        const batchId = database.runSync(
          `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, taxType, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, orderNumber, notes, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          items[0].itemId, items[0].quantity, items[0].unit || 'pcs', 'base',
          0, 0, 'VAT', items[0].quantity * items[0].price,
          'Order', 'Order', customerName, randomPhone(),
          `ORD_${Date.now()}_${i}`, `ORD-${String(i + 1).padStart(4, '0')}`,
          `Order from ${customerName}`, fmtDateTime(randomDateInRange(2026, 2026)),
        );
        
        // Insert remaining items under same batchId
        for (let j = 1; j < items.length; j++) {
          database.runSync(
            `INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, taxType, totalPrice, paymentMethod, paymentStatus, customerName, customerPhone, batchId, orderNumber, notes, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            items[j].itemId, items[j].quantity, items[j].unit || 'pcs', 'base',
            0, 0, 'VAT', items[j].quantity * items[j].price,
            'Order', 'Order', customerName, randomPhone(),
            `ORD_${Date.now()}_${i}`, `ORD-${String(i + 1).padStart(4, '0')}`,
            `Order from ${customerName}`, fmtDateTime(randomDateInRange(2026, 2026)),
          );
        }

        result.counts.orders++;

        // Convert some orders to paid or debt
        if (i % 3 === 0) {
          database.runSync(
            `UPDATE sales SET paymentStatus = 'Paid', convertedAt = ? WHERE batchId = ? AND paymentStatus = 'Order'`,
            [fmtDateTime(new Date()), `ORD_${Date.now()}_${i}`],
          );
        } else if (i % 5 === 0) {
          database.runSync(
            `UPDATE sales SET paymentStatus = 'Debt', convertedAt = ?, dueDate = ? WHERE batchId = ? AND paymentStatus = 'Order'`,
            [fmtDateTime(new Date()), fmtDate(randomDateInRange(2026, 2027)), `ORD_${Date.now()}_${i}`],
          );
        }
      } catch (e) {
        console.warn('Failed to create order:', e);
      }
    }

    // ── 17. User Profile (into settings or user_profile table) ──
    const existingProfile = database.getFirstSync<{ id: number }>('SELECT id FROM user_profile LIMIT 1');
    if (!existingProfile) {
      try {
        database.runSync(
          `INSERT INTO user_profile (businessName, ownerName, phone, email, address, city, logo, businessType, currency, taxRate, taxId, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          'Shega Hardware Store', 'Natol', '0912345678', 'natol@shega.app',
          'Bole Road, Addis Ababa', 'Addis Ababa', null, 'Retail', 'ETB', 15.0, 'TAX-001-2024',
          fmtDateTime(new Date(2024, 0, 1)),
        );
      } catch (e) {
        console.warn('Failed to insert user_profile:', e);
      }
    }

    result.success = true;
    const lines = [
      'Comprehensive test data generated successfully!',
      `  Categories: ${result.counts.categories}`,
      `  Items: ${result.counts.items}`,
      `  Sales: ${result.counts.sales}`,
      `  Expenses: ${result.counts.expenses}`,
      `  Adjustments: ${result.counts.adjustments}`,
      `  Returns: ${result.counts.returns}`,
      `  Packs: ${result.counts.packs}`,
      `  Contacts: ${result.counts.contacts}`,
      `  Warehouses: ${result.counts.warehouses}`,
      `  Budgets: ${result.counts.budgets}`,
      `  Budget Categories: ${result.counts.budgetCategories}`,
      `  Recurring Templates: ${result.counts.recurringTemplates}`,
      `  Notifications: ${result.counts.notifications}`,
      `  Reminders: ${result.counts.reminders}`,
      `  Notification Prefs: ${result.counts.notificationPreferences}`,
      `  Orders: ${result.counts.orders}`,
    ];
    result.message = lines.join('\n');

    console.log('[TestData]', result.message);
    return result;
  } catch (error) {
    console.error('[TestData] Error generating sample data:', error);
    result.message = `Error generating test data: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
};

// ═══ Bulk Generator ═══════════════════════════════════════════════════════════

const BULK_CATEGORIES = [
  'Fasteners', 'Measuring & Layout', 'Hardware', 'Paint & Supplies',
  'Electrical', 'Plumbing', 'Packing & Storage', 'Cleaning Supplies',
  'Safety & PPE', 'Building Materials', 'Grocery / Consumables', 'Other',
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
  'Extension Cord', 'Power Strip', 'Battery Pack', 'Flashlight',
];

const BULK_UNITS = ['pieces', 'kg', 'litre', 'm', 'sqm', 'roll'];
const BULK_PAYMENT_METHODS = ['Cash', 'Bank', 'Debt', 'Telebirr'];
const BULK_EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salary', 'Transport', 'Marketing', 'Maintenance', 'Insurance', 'Tax', 'Equipment', 'Supplies', 'Services'];
const BULK_EXPENSE_NAMES = [
  'Monthly Rent', 'Electricity Bill', 'Water Bill', 'Employee Salary',
  'Transport & Logistics', 'Social Media Ads', 'Shop Maintenance',
  'Business Insurance', 'Monthly Tax', 'Office Supplies',
  'Internet Bill', 'Phone Bill', 'Cleaning Service', 'Security Service',
  'Stationery', 'Software License', 'Fuel', 'Parking Fee',
  'Legal Fees', 'Consulting Fee',
];
const BULK_CUSTOMER_NAMES = [...CUSTOMER_NAMES];
const BULK_ADJ_REASONS = [
  'Market price shift', 'Supplier price update', 'Seasonal promotion',
  'Minor damage during transport', 'Expired stock removal',
  'Exchange rate fluctuation', 'Bulk purchase discount applied',
  'Manufacturer price increase', 'Competitor pricing', 'Inventory write-off',
];

const pickUnit = () => BULK_UNITS[rand(0, BULK_UNITS.length - 1)];
const randomName = () => BULK_PRODUCT_NAMES[rand(0, BULK_PRODUCT_NAMES.length - 1)];
const randomCustomer = () => BULK_CUSTOMER_NAMES[rand(0, BULK_CUSTOMER_NAMES.length - 1)];

const BULK_COLS_ITEM = 'name,categoryId,companyName,purchaseUnit,baseUnit,unitsPerPack,totalPackQuantity,totalBaseQuantity,packPurchasePrice,basePurchasePrice,baseSellingPrice,packSellingPrice,allowSellByBaseUnit,allowSellByPackUnit,expiryDate,qualityGrade,notes,isCredit,supplierPhone,supplierAccount,supplierId,warehouseId,dueDate,createdAt';
const BULK_COLS_ITEM_COUNT = BULK_COLS_ITEM.split(',').length;
const BULK_COLS_SALE = 'itemId,quantity,unit,unitType,discount,vat,taxType,totalPrice,paymentMethod,paymentStatus,customerName,customerPhone,packId,dueDate,paidAmount,createdAt,batchId,orderNumber,notes';
const BULK_COLS_SALE_COUNT = BULK_COLS_SALE.split(',').length;
const BULK_COLS_EXPENSE = 'name,amount,category,date,isRecurring,frequency,nextBillingDate,isOverdue,overdueDays,lastNotified,paymentStatus,budgetCategoryId';
const BULK_COLS_EXPENSE_COUNT = BULK_COLS_EXPENSE.split(',').length;
const BULK_COLS_ADJ = 'itemId,type,oldValue,newValue,quantity,unitType,reason,date,createdAt';
const BULK_COLS_ADJ_COUNT = BULK_COLS_ADJ.split(',').length;
const BULK_COLS_CONTACT = 'fullName,category,subCategory,phone,alternatePhone,accountNumber,notes,createdAt';
const BULK_COLS_CONTACT_COUNT = BULK_COLS_CONTACT.split(',').length;
const BULK_COLS_PACK = 'itemId,packNumber,initialQuantity,currentQuantity,unit,status';
const BULK_COLS_PACK_COUNT = BULK_COLS_PACK.split(',').length;

export const generateBulkTestData = (count: number): GenerateTestDataResult => {
  const result: GenerateTestDataResult = {
    success: false,
    counts: {
      categories: 0, items: 0, sales: 0, expenses: 0, adjustments: 0,
      returns: 0, packs: 0, contacts: 0, warehouses: 0, budgets: 0,
      budgetCategories: 0, recurringTemplates: 0, notifications: 0,
      reminders: 0, notificationPreferences: 0, orders: 0,
    },
    message: '',
  };

  try {
    const db = getDB();
    const batchSize = 500;

    // ── Categories ────────────────────────────────────────────────
    const existingCats = db.getAllSync<{ id: number }>('SELECT id FROM categories');
    let catIds = existingCats.map((c) => c.id);
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

    // ── Warehouses ────────────────────────────────────────────────
    const existingWarehouses = db.getAllSync<{ id: number }>('SELECT id FROM warehouses LIMIT 1');
    let warehouseId: number | null = existingWarehouses.length > 0 ? existingWarehouses[0].id : null;
    if (!warehouseId) {
      db.runSync("INSERT INTO warehouses (name, location) VALUES ('Main Warehouse', 'Default')");
      const w = db.getFirstSync<{ id: number }>('SELECT id FROM warehouses LIMIT 1');
      warehouseId = w?.id ?? null;
    }
    if (warehouseId) result.counts.warehouses = 1;

    // ── Items (bulk) ──────────────────────────────────────────────
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
        const expiryDate = i % 5 === 0
          ? `202${rand(6, 8)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`
          : null;
        const createdAt = fmtDateTime(randomDateInRange(2024, 2026));

        values.push(`(${Array(BULK_COLS_ITEM_COUNT).fill('?').join(',')})`);
        params.push(
          name, catId, '', unit, unit, 1, 0, stockQty,
          basePrice, basePrice, sellPrice, sellPrice,
          1, 0, expiryDate, qualityGrade, '', 0, null, null, null, warehouseId, null, createdAt,
        );
      }

      db.runSync(`INSERT INTO items (${BULK_COLS_ITEM}) VALUES ${values.join(',')}`, ...params);
      const inserted = db.getAllSync<{ id: number }>(
        `SELECT id FROM items ORDER BY id DESC LIMIT ${end - start}`,
      );
      for (const row of inserted.reverse()) itemIds.push(row.id);
    }
    result.counts.items = itemIds.length;

    if (itemIds.length === 0) {
      result.message = 'Failed to create items.';
      return result;
    }

    // ── Sales (bulk) ────────────────────────────────────────────────
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

        values.push(`(${Array(BULK_COLS_SALE_COUNT).fill('?').join(',')})`);
        const taxType = 'VAT';
        params.push(
          itemId, qty, unit, 'base', discount, vat, taxType, totalPrice,
          method, isDebt ? 'Debt' : 'Paid', custName, custPhone,
          null, dueDate, paidAmount, createdAt, null, null, null,
        );
        saleCount++;
      }

      db.runSync(`INSERT INTO sales (${BULK_COLS_SALE}) VALUES ${values.join(',')}`, ...params);
    }
    result.counts.sales = saleCount;

    // ── Debt Payments (follow-up to sales above) ──────────────────
    const debtCustomers = db.getAllSync<{ customerName: string }>(
      `SELECT DISTINCT customerName FROM sales WHERE paymentStatus = 'Debt' LIMIT 20`,
    );
    for (const dc of debtCustomers) {
      const amount = randFloat(500, 10000);
      db.runSync(
        `INSERT INTO debt_payments (saleId, customerName, customerPhone, amount, type, note, createdAt)
         VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
        dc.customerName, randomPhone(), amount,
        pick(['full', 'partial']), 'Bulk generated payment',
        fmtDateTime(randomDateInRange(2025, 2026)),
      );
    }

    // ── Expenses (bulk) ────────────────────────────────────────────
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

        values.push(`(${Array(BULK_COLS_EXPENSE_COUNT).fill('?').join(',')})`);
        params.push(name, amount, category, date, isRecurring, frequency, nextBillingDate, 0, 0, null, 'paid', null);
        expCount++;
      }

      db.runSync(`INSERT INTO expenses (${BULK_COLS_EXPENSE}) VALUES ${values.join(',')}`, ...params);
    }
    result.counts.expenses = expCount;

    // ── Adjustments (bulk) ─────────────────────────────────────────
    const adjTypes = ['price_up', 'price_down', 'damaged'];
    let adjCount = 0;
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
        const newValue = type === 'price_up'
          ? oldValue * randFloat(1.05, 1.3)
          : type === 'price_down'
            ? oldValue * randFloat(0.5, 0.95)
            : oldValue;
        const qty = type === 'damaged' ? rand(1, 10) : null;
        const reason = pick(BULK_ADJ_REASONS);
        const date = fmtDate(randomDateInRange(2024, 2026));

        values.push(`(${Array(BULK_COLS_ADJ_COUNT).fill('?').join(',')})`);
        params.push(itemId, type, oldValue, newValue, qty, 'base', reason, date, fmtDateTime(new Date()));
        adjCount++;
      }

      db.runSync(`INSERT INTO adjustments (${BULK_COLS_ADJ}) VALUES ${values.join(',')}`, ...params);
    }
    result.counts.adjustments = adjCount;

    // ── Contacts (bulk) ────────────────────────────────────────────
    const contactCategories = ['Customer', 'Supplier', 'Both'];
    let contactCount = 0;
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

        values.push(`(${Array(BULK_COLS_CONTACT_COUNT).fill('?').join(',')})`);
        params.push(fullName, category, null, phone, alternatePhone, accountNumber, null, fmtDateTime(randomDateInRange(2024, 2026)));
        contactCount++;
      }

      db.runSync(`INSERT INTO contacts (${BULK_COLS_CONTACT}) VALUES ${values.join(',')}`, ...params);
    }
    result.counts.contacts = contactCount;

    // ── Returns (bulk) ─────────────────────────────────────────────
    let returnCount = 0;
    const returnSaleIds = db.getAllSync<{ id: number }>('SELECT id FROM sales ORDER BY RANDOM() LIMIT ?', [Math.min(count / 5, 200)]);
    for (const rs of returnSaleIds) {
      const saleDetail = db.getFirstSync<{ itemId: number }>('SELECT itemId FROM sales WHERE id = ?', [rs.id]);
      if (!saleDetail) continue;
      try {
        insertReturn({
          saleId: rs.id, itemId: saleDetail.itemId, quantity: rand(1, 3),
          unit: 'pcs', unitType: 'base',
          totalRefund: randFloat(50, 2000), reason: pick(RETURN_REASONS),
          createdAt: fmtDateTime(randomDateInRange(2025, 2026)),
        });
        returnCount++;
      } catch {
        // skip
      }
    }
    result.counts.returns = returnCount;

    // ── Item Packs (bulk) ──────────────────────────────────────────
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

        values.push(`(${Array(BULK_COLS_PACK_COUNT).fill('?').join(',')})`);
        params.push(itemId, rand(1, 50), initialQty, currentQty, 'pieces',
          currentQty > 0 ? (currentQty < initialQty * 0.3 ? 'Opened' : 'Not Opened') : 'Empty');
        packCount++;
      }

      db.runSync(`INSERT INTO item_packs (${BULK_COLS_PACK}) VALUES ${values.join(',')}`, ...params);
    }
    result.counts.packs = packCount;

    // ── Notification Preferences (bulk) ────────────────────────────
    const bulkNotifKeys = [
      'stock', 'expiration', 'daily', 'credit', 'debt', 'budget', 'budgetStatus',
      'expense', 'largeExpense', 'recurring', 'weeklySummary', 'monthlySummary',
    ];
    for (const key of bulkNotifKeys) {
      try {
        setPreference({
          key, enabled: Math.random() > 0.15,
          quietStart: Math.random() > 0.5 ? '22:00' : undefined,
          quietEnd: Math.random() > 0.5 ? '07:00' : undefined,
          sound: pick(['default', 'bell', 'chime', 'alert']),
          vibration: Math.random() > 0.2,
        });
        result.counts.notificationPreferences++;
      } catch {
        // skip
      }
    }

    result.success = true;
    const lines = [
      `Generated ${count} records:`,
      `  Items: ${result.counts.items}`,
      `  Sales: ${result.counts.sales}`,
      `  Expenses: ${result.counts.expenses}`,
      `  Adjustments: ${result.counts.adjustments}`,
      `  Contacts: ${result.counts.contacts}`,
      `  Packs: ${result.counts.packs}`,
      `  Returns: ${result.counts.returns}`,
      `  Notification Prefs: ${result.counts.notificationPreferences}`,
      `  Categories: ${result.counts.categories || 'existing'}`,
    ];
    result.message = lines.join('\n');

    console.log('[BulkTestData]', result.message);
    return result;
  } catch (error) {
    console.error('[BulkTestData] Error:', error);
    result.message = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
};
