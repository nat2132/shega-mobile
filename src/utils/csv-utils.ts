import { getCategories, getContacts, getItems, insertAdjustment, insertCategory, insertContact, insertItem, insertSale, getDB } from '@/database/db';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// â”€â”€â”€ CSV Column Definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CSVColumn {
  key: string;          // database field name
  label: string;        // human-readable header
  required: boolean;
  type: 'string' | 'number' | 'date' | 'boolean';
  defaultValue?: any;
  validate?: (value: any) => string | null;  // returns error message or null
  aliases?: string[];                            // alternate header names that should map here
}

export interface CSVModuleSpec {
  name: string;
  description: string;
  columns: CSVColumn[];
  requiredColumns: string[];
}

// ——— Module Specs ————————————————————————————————————————————————————

export const CSV_SPECS: Record<string, CSVModuleSpec> = {
  items: {
    name: 'Inventory Items',
    description: 'Products, materials, and stock items',
    columns: [
      { key: 'name', label: 'Name', required: true, type: 'string', aliases: ['item name', 'item', 'product', 'productname', 'sku'] },
      { key: 'categoryName', label: 'Category', required: false, type: 'string', defaultValue: '' },
      { key: 'companyName', label: 'Brand/Company', required: false, type: 'string', defaultValue: '', aliases: ['brand', 'brand/company', 'company', 'manufacturer'] },
      { key: 'purchaseUnit', label: 'Purchase Unit', required: false, type: 'string', defaultValue: 'pcs' },
      { key: 'baseUnit', label: 'Base Unit', required: false, type: 'string', defaultValue: 'pcs' },
      { key: 'unitsPerPack', label: 'Units Per Pack', required: false, type: 'number', defaultValue: 1, aliases: ['per pack', 'pack size', 'unitsperpack'] },
      { key: 'totalPackQuantity', label: 'Pack Quantity', required: false, type: 'number', defaultValue: 0, aliases: ['pack qty', 'packquantity', 'packs'] },
      { key: 'totalBaseQuantity', label: 'Stock Quantity', required: true, type: 'number', aliases: ['stock', 'stockqty', 'openingstock', 'closingstock', 'quantityonhand', 'onhand', 'currentstock', 'openingbalance', 'available'] },
      { key: 'packPurchasePrice', label: 'Pack Cost', required: false, type: 'number', defaultValue: 0, aliases: ['packcost', 'pack purchase price', 'packcostprice'] },
      { key: 'basePurchasePrice', label: 'Unit Cost', required: true, type: 'number', aliases: ['unitcost', 'costprice', 'purchaseprice', 'buycost', 'vendorcost', 'vendorprice', 'cost', 'purchase rate', 'purchasedprice'] },
      { key: 'baseSellingPrice', label: 'Unit Selling Price', required: true, type: 'number', aliases: ['unitsellingprice', 'saleprice', 'sellingprice', 'retailprice', 'marketprice', 'mrp', 'selling price', 'sale price'] },
      { key: 'packSellingPrice', label: 'Pack Selling Price', required: false, type: 'number', defaultValue: 0, aliases: ['packsp', 'pack selling', 'pack sell price'] },
      { key: 'expiryDate', label: 'Expiry Date', required: false, type: 'date', defaultValue: null },
      { key: 'qualityGrade', label: 'Quality Grade', required: false, type: 'string', defaultValue: 'grade1' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', defaultValue: '' },
      { key: 'supplierPhone', label: 'Supplier Phone', required: false, type: 'string', defaultValue: '' },
      { key: 'supplierAccount', label: 'Supplier Account', required: false, type: 'string', defaultValue: '' },
      { key: 'supplierCallEnabled', label: 'Call Supplier', required: false, type: 'boolean', defaultValue: false },
      { key: 'lastPriceCheckAt', label: 'Last Price Check', required: false, type: 'date', defaultValue: null },
      { key: 'isCredit', label: 'Credit Item', required: false, type: 'boolean', defaultValue: false },
      { key: 'dueDate', label: 'Due Date', required: false, type: 'date', defaultValue: null },
      { key: 'supplierId', label: 'Supplier ID', required: false, type: 'number', defaultValue: null },
      { key: 'warehouseId', label: 'Warehouse ID', required: false, type: 'number', defaultValue: null },
    ],
    requiredColumns: ['name', 'totalBaseQuantity', 'basePurchasePrice', 'baseSellingPrice'],
  },
  sales: {
    name: 'Sales Records',
    description: 'Completed sales transactions',
    columns: [
      { key: 'itemName', label: 'Item Name', required: true, type: 'string' },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
      { key: 'unit', label: 'Unit', required: false, type: 'string', defaultValue: 'pcs' },
      { key: 'unitType', label: 'Unit Type', required: false, type: 'string', defaultValue: 'base' },
      { key: 'discount', label: 'Discount', required: false, type: 'number', defaultValue: 0 },
      { key: 'vat', label: 'VAT %', required: false, type: 'number', defaultValue: 0 },
      { key: 'totalPrice', label: 'Total Price', required: true, type: 'number' },
      { key: 'paymentMethod', label: 'Payment Method', required: false, type: 'string', defaultValue: 'Cash' },
      { key: 'paymentStatus', label: 'Payment Status', required: false, type: 'string', defaultValue: 'Paid' },
      { key: 'customerName', label: 'Customer Name', required: false, type: 'string', defaultValue: '' },
      { key: 'customerPhone', label: 'Customer Phone', required: false, type: 'string', defaultValue: '' },
      { key: 'createdAt', label: 'Date', required: false, type: 'date', defaultValue: null },
      { key: 'batchId', label: 'Batch ID', required: false, type: 'string', defaultValue: '' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', defaultValue: '' },
      { key: 'dueDate', label: 'Due Date', required: false, type: 'date', defaultValue: null },
      { key: 'paidAmount', label: 'Paid Amount', required: false, type: 'number', defaultValue: 0 },
      { key: 'taxType', label: 'Tax Type', required: false, type: 'string', defaultValue: 'VAT' },
      { key: 'orderNumber', label: 'Order Number', required: false, type: 'string', defaultValue: '' },
      { key: 'convertedAt', label: 'Converted At', required: false, type: 'date', defaultValue: null },
      { key: 'cancelledAt', label: 'Cancelled At', required: false, type: 'date', defaultValue: null },
    ],
    requiredColumns: ['itemName', 'quantity', 'totalPrice'],
  },
  categories: {
    name: 'Categories',
    description: 'Product categories',
    columns: [
      { key: 'name', label: 'Category Name', required: true, type: 'string' },
      { key: 'icon', label: 'Icon', required: false, type: 'string', defaultValue: '📦' },
      { key: 'isCustom', label: 'Is Custom', required: false, type: 'boolean', defaultValue: true },
    ],
    requiredColumns: ['name'],
  },
  contacts: {
    name: 'Contacts',
    description: 'Suppliers, customers, and other contacts',
    columns: [
      { key: 'fullName', label: 'Full Name', required: true, type: 'string' },
      { key: 'category', label: 'Category', required: true, type: 'string' },
      { key: 'subCategory', label: 'Sub Category', required: false, type: 'string', defaultValue: '' },
      { key: 'phone', label: 'Phone', required: false, type: 'string', defaultValue: '' },
      { key: 'alternatePhone', label: 'Alternate Phone', required: false, type: 'string', defaultValue: '' },
      { key: 'accountNumber', label: 'Account Number', required: false, type: 'string', defaultValue: '' },
      { key: 'companyName', label: 'Company Name', required: false, type: 'string', defaultValue: '', aliases: ['brand', 'company', 'business'] },
      { key: 'email', label: 'Email', required: false, type: 'string', defaultValue: '' },
      { key: 'address', label: 'Address', required: false, type: 'string', defaultValue: '' },
      { key: 'tin', label: 'TIN', required: false, type: 'string', defaultValue: '' },
      { key: 'supplierCategory', label: 'Supplier Category', required: false, type: 'string', defaultValue: '' },
      { key: 'paymentType', label: 'Payment Type', required: false, type: 'string', defaultValue: 'cash', aliases: ['payment'] },
      { key: 'isActive', label: 'Active', required: false, type: 'boolean', defaultValue: true },
      { key: 'notes', label: 'Notes', required: false, type: 'string', defaultValue: '' },
    ],
    requiredColumns: ['fullName', 'category'],
  },
  adjustments: {
    name: 'Adjustments',
    description: 'Price and inventory adjustments',
    columns: [
      { key: 'itemName', label: 'Item Name', required: true, type: 'string' },
      { key: 'type', label: 'Type', required: true, type: 'string' },
      { key: 'quantity', label: 'Quantity', required: false, type: 'number', defaultValue: 0 },
      { key: 'oldValue', label: 'Old Value', required: false, type: 'number', defaultValue: 0 },
      { key: 'newValue', label: 'New Value', required: false, type: 'number', defaultValue: 0 },
      { key: 'unitType', label: 'Unit Type', required: false, type: 'string', defaultValue: 'base' },
      { key: 'reason', label: 'Reason', required: false, type: 'string', defaultValue: '' },
      { key: 'date', label: 'Date', required: false, type: 'date', defaultValue: null },
    ],
    requiredColumns: ['itemName', 'type'],
  },
  warehouses: {
    name: 'Warehouses',
    description: 'Inventory storage locations',
    columns: [
      { key: 'name', label: 'Name', required: true, type: 'string' },
      { key: 'location', label: 'Location', required: false, type: 'string', defaultValue: '' },
      { key: 'contactPerson', label: 'Contact Person', required: false, type: 'string', defaultValue: '' },
      { key: 'phone', label: 'Phone', required: false, type: 'string', defaultValue: '' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', defaultValue: '' },
    ],
    requiredColumns: ['name'],
  },
  debt_payments: {
    name: 'Debt Payments',
    description: 'Customer debt payment history',
    columns: [
      { key: 'saleId', label: 'Sale ID', required: false, type: 'number', defaultValue: null },
      { key: 'customerName', label: 'Customer Name', required: true, type: 'string' },
      { key: 'customerPhone', label: 'Customer Phone', required: false, type: 'string', defaultValue: '' },
      { key: 'amount', label: 'Amount', required: true, type: 'number' },
      { key: 'type', label: 'Type', required: true, type: 'string', defaultValue: 'full' },
      { key: 'note', label: 'Note', required: false, type: 'string', defaultValue: '' },
    ],
    requiredColumns: ['customerName', 'amount', 'type'],
  },
  returns: {
    name: 'Returns',
    description: 'Item returns and refunds',
    columns: [
      { key: 'saleId', label: 'Sale ID', required: false, type: 'number', defaultValue: null },
      { key: 'itemName', label: 'Item Name', required: true, type: 'string' },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
      { key: 'unit', label: 'Unit', required: false, type: 'string', defaultValue: 'pcs' },
      { key: 'unitType', label: 'Unit Type', required: false, type: 'string', defaultValue: 'base' },
      { key: 'totalRefund', label: 'Total Refund', required: true, type: 'number' },
      { key: 'reason', label: 'Reason', required: false, type: 'string', defaultValue: '' },
      { key: 'itemCondition', label: 'Item Condition', required: false, type: 'string', defaultValue: 'Resellable' },
      { key: 'refundType', label: 'Refund Type', required: false, type: 'string', defaultValue: 'Full Refund' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', defaultValue: '' },
      { key: 'returnDate', label: 'Return Date', required: false, type: 'date', defaultValue: null },
    ],
    requiredColumns: ['itemName', 'quantity', 'totalRefund'],
  },
};


// â”€â”€â”€ CSV Parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Parse a CSV string into an array of objects.
 * Handles quoted fields, commas inside quotes, escaped quotes.
 */
export function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      lines.push(current);
      current = '';
      if (ch === '\r' && content[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  // Group into rows by header count
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let val = '';
    let inQ = false;
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQ && line[j + 1] === '"') { val += '"'; j++; }
        else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) {
        values.push(val);
        val = '';
      } else {
        val += ch;
      }
    }
    values.push(val);

    if (values.some(v => v.trim() !== '')) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim().replace(/^"|"$/g, ''); });
      rows.push(row);
    }
  }

  return { headers, rows };
}

// â”€â”€â”€ Column Mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface MappingResult {
  mappings: { csvColumn: string; dbField: string }[];
  unmappedCSV: string[];
  missingRequired: string[];
  missingRequiredLabels: string[];
}

/**
 * Normalize a header/alias token for comparison: lower-case, collapse
 * whitespace/_/-/ and strip every non-alphanumeric character. This means
 * "Unit Selling Price", "unit_selling_price" and "Unit-Selling Price" all
 * normalize to the same token.
 */
function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Look up the human-readable label for a database field key in a spec. */
export function getColumnLabel(spec: CSVModuleSpec, key: string): string {
  return spec.columns.find((c) => c.key === key)?.label ?? key;
}

/**
 * Auto-map CSV headers to database fields using fuzzy matching.
 *
 * A CSV header matches a column if, after normalization, it equals the
 * column's key, its label, or any declared alias; or if it is a substring
 * of / contained by the (label, key) token (additive, never stricter than
 * the original behaviour).
 */
export function autoMapColumns(csvHeaders: string[], spec: CSVModuleSpec): MappingResult {
  const mappings: { csvColumn: string; dbField: string }[] = [];
  const unmappedCSV: string[] = [];
  const mappedDB = new Set<string>();

  for (const csvCol of csvHeaders) {
    const normalized = normalizeToken(csvCol);
    let matched = false;

    for (const col of spec.columns) {
      const colNorm = normalizeToken(col.key);
      const labelNorm = normalizeToken(col.label);
      const aliasNorms = (col.aliases ?? []).map(normalizeToken);

      const exactMatch =
        normalized === colNorm ||
        normalized === labelNorm ||
        aliasNorms.includes(normalized);
      const containsMatch =
        normalized.includes(colNorm) ||
        colNorm.includes(normalized) ||
        normalized.includes(labelNorm) ||
        labelNorm.includes(normalized);

      if (exactMatch || containsMatch) {
        mappings.push({ csvColumn: csvCol, dbField: col.key });
        mappedDB.add(col.key);
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmappedCSV.push(csvCol);
    }
  }

  const missingRequired = spec.requiredColumns.filter((c) => !mappedDB.has(c));
  const missingRequiredLabels = missingRequired.map((k) => getColumnLabel(spec, k));

  return { mappings, unmappedCSV, missingRequired, missingRequiredLabels };
}

// â”€â”€â”€ Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export function validateRows(
  rows: Record<string, string>[],
  mappings: { csvColumn: string; dbField: string }[],
  spec: CSVModuleSpec
): ValidationError[] {
  const errors: ValidationError[] = [];
  const colDefs = new Map(spec.columns.map(c => [c.key, c]));

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2 for 1-indexed + header row

    for (const { csvColumn, dbField } of mappings) {
      const colDef = colDefs.get(dbField);
      if (!colDef) continue;

      const rawValue = row[csvColumn];
      const value = rawValue?.trim();

      // Required check
      if (colDef.required && (!value || value === '')) {
        errors.push({ row: rowNum, field: dbField, message: `Row ${rowNum}: ${colDef.label} is required` });
        continue;
      }

      if (!value || value === '') continue;

      // Type validation
      if (colDef.type === 'number') {
        if (!/^-?\d+(\.\d+)?$/.test(value)) {
          errors.push({ row: rowNum, field: dbField, message: `Row ${rowNum}: ${colDef.label} must be a number, got "${value}"` });
        } else {
          const num = Number(value);
          if (num < 0 && dbField !== 'discount' && dbField !== 'vat') {
            errors.push({ row: rowNum, field: dbField, message: `Row ${rowNum}: ${colDef.label} cannot be negative` });
          }
        }
      } else if (colDef.type === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push({ row: rowNum, field: dbField, message: `Row ${rowNum}: ${colDef.label} must be a valid date (YYYY-MM-DD), got "${value}"` });
          }
        }
      } else if (colDef.type === 'boolean') {
        const lower = value.toLowerCase();
        if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
          errors.push({ row: rowNum, field: dbField, message: `Row ${rowNum}: ${colDef.label} must be true/false/1/0/yes/no, got "${value}"` });
        }
      }

      // Custom validation
      if (colDef.validate) {
        const err = colDef.validate(value);
        if (err) errors.push({ row: rowNum, field: dbField, message: `Row ${rowNum}: ${err}` });
      }
    }

    // Cross-field validation for sales
    if (spec === CSV_SPECS.sales) {
      const qty = Number(row[Object.keys(row).find(k => k.toLowerCase().includes('quantity')) || ''] || 0);
      const total = Number(row[Object.keys(row).find(k => k.toLowerCase().includes('total')) || ''] || 0);
      if (qty > 0 && total <= 0) {
        errors.push({ row: rowNum, field: 'totalPrice', message: `Row ${rowNum}: Total price must be positive when quantity > 0` });
      }
      const itemName = row[Object.keys(row).find(k => k.toLowerCase().includes('item')) || ''];
      if (!itemName || itemName.trim() === '') {
        errors.push({ row: rowNum, field: 'itemName', message: `Row ${rowNum}: Item Name is required` });
      }
    }
  });

  return errors;
}

// â”€â”€â”€ Data Transformation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseBool(val: string): boolean {
  return ['true', '1', 'yes'].includes(val?.toLowerCase?.() || '');
}

function parseNumber(val: string, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function parseDate(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Convert validated CSV rows to database-ready objects.
 */
export function transformRows(
  rows: Record<string, string>[],
  mappings: { csvColumn: string; dbField: string }[],
  spec: CSVModuleSpec
): any[] {
  return rows.map(row => {
    const obj: Record<string, any> = {};

    for (const { csvColumn, dbField } of mappings) {
      const colDef = spec.columns.find(c => c.key === dbField);
      const rawValue = row[csvColumn]?.trim();
      const value = rawValue || '';

      if (!value && colDef?.defaultValue !== undefined) {
        obj[dbField] = colDef.defaultValue;
        continue;
      }

      switch (colDef?.type) {
        case 'number':
          obj[dbField] = parseNumber(value, colDef.defaultValue ?? 0);
          break;
        case 'boolean':
          obj[dbField] = parseBool(value);
          break;
        case 'date':
          obj[dbField] = parseDate(value);
          break;
        default:
          obj[dbField] = value;
      }
    }

    // Apply defaults for unmapped fields
    for (const col of spec.columns) {
      if (!(col.key in obj) && col.defaultValue !== undefined) {
        obj[col.key] = col.defaultValue;
      }
    }

    return obj;
  });
}

// â”€â”€â”€ Duplicate Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function findDuplicates(
  data: any[],
  spec: CSVModuleSpec,
  existingRecords: any[]
): { index: number; field: string; existingId: number }[] {
  const dupes: { index: number; field: string; existingId: number }[] = [];

  for (let i = 0; i < data.length; i++) {
    const record = data[i];

    for (const existing of existingRecords) {
      // Items: match on name + category
      if (spec === CSV_SPECS.items) {
        if (record.name && existing.name &&
            record.name.toLowerCase() === existing.name.toLowerCase()) {
          dupes.push({ index: i, field: 'name', existingId: existing.id });
        }
      }
      // Categories: match on name
      if (spec === CSV_SPECS.categories) {
        if (record.name && existing.name &&
            record.name.toLowerCase() === existing.name.toLowerCase()) {
          dupes.push({ index: i, field: 'name', existingId: existing.id });
        }
      }
    }
  }

  return dupes;
}

// â”€â”€â”€ Import Execution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importItems(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const existingItems = getItems() as any[];
  const existingCategories = getCategories() as any[];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      if (!row.name || row.name.trim() === '') {
        result.errors.push(`Row ${rowNum}: Name is required`);
        result.skipped++;
        continue;
      }

      // Resolve category
      let categoryId = 0;
      if (row.categoryName) {
        const existing = existingCategories.find((c: any) => c.name?.toLowerCase() === row.categoryName.toLowerCase());
        if (existing) {
          categoryId = existing.id;
        } else {
          const newId = await insertCategory(row.categoryName, 'ðŸ“¦', true);
          if (newId) {
            categoryId = Number(newId);
            existingCategories.push({ id: categoryId, name: row.categoryName });
          }
        }
      }

      // Check duplicate
      const isDupe = existingItems.some((item: any) => item.name?.toLowerCase() === row.name?.toLowerCase());
      if (isDupe) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: "${row.name}" already exists (skipped)`);
        continue;
      }

      const qty = Number(row.totalBaseQuantity) || 0;
      const unitsPerPack = Number(row.unitsPerPack) || 1;
      const packQty = Number(row.totalPackQuantity) || (qty > 0 && unitsPerPack > 0 ? Math.ceil(qty / unitsPerPack) : 0);

      const insertData: any = {
        name: row.name.trim(),
        categoryId,
        companyName: row.companyName || '',
        purchaseUnit: row.purchaseUnit || 'pcs',
        baseUnit: row.baseUnit || 'pcs',
        unitsPerPack,
        totalPackQuantity: packQty,
        totalBaseQuantity: qty,
        packPurchasePrice: Number(row.packPurchasePrice) || 0,
        basePurchasePrice: Number(row.basePurchasePrice) || 0,
        baseSellingPrice: Number(row.baseSellingPrice) || 0,
        packSellingPrice: Number(row.packSellingPrice) || 0,
        allowSellByBaseUnit: true,
        allowSellByPackUnit: unitsPerPack > 1,
        expiryDate: row.expiryDate === '' ? null : (row.expiryDate || null),
        qualityGrade: row.qualityGrade === '' ? 'grade1' : (row.qualityGrade || 'grade1'),
        notes: row.notes === '' ? '' : (row.notes || ''),
        isCredit: row.isCredit === true || row.isCredit === 'true' || row.isCredit === '1',
        supplierPhone: row.supplierPhone === '' ? null : (row.supplierPhone || null),
        supplierAccount: row.supplierAccount === '' ? null : (row.supplierAccount || null),
        supplierCallEnabled: row.supplierCallEnabled === true || row.supplierCallEnabled === 'true' || row.supplierCallEnabled === '1',
        lastPriceCheckAt: row.lastPriceCheckAt === '' ? null : (row.lastPriceCheckAt || null),
        dueDate: row.dueDate === '' ? null : (row.dueDate || null),
        supplierId: row.supplierId ? Number(row.supplierId) : null,
        warehouseId: row.warehouseId ? Number(row.warehouseId) : null,
      };

      const id = await insertItem(insertData);
      if (id) {
        result.imported++;
        existingItems.push({ ...insertData, id } as any);
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert "${row.name}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

export function importSales(data: any[]): ImportResult {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const items = getItems() as any[];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      // Validate required fields
      if (!row.itemName || row.itemName.trim() === '') {
        result.errors.push(`Row ${rowNum}: Item Name is required`);
        result.skipped++;
        continue;
      }

      const qty = Number(row.quantity) || 1;
      const total = Number(row.totalPrice) || 0;

      if (qty <= 0) {
        result.errors.push(`Row ${rowNum}: Quantity must be greater than 0`);
        result.skipped++;
        continue;
      }

      // Resolve item
      const matchedItem = items.find((item: any) =>
        item.name?.toLowerCase() === row.itemName?.toLowerCase()
      );
      if (!matchedItem) {
        result.errors.push(`Row ${rowNum}: Item "${row.itemName}" not found in inventory (skipped)`);
        result.skipped++;
        continue;
      }

      const saleId = insertSale({
        itemId: matchedItem.id,
        quantity: qty,
        unit: row.unit || matchedItem.baseUnit || 'pcs',
        unitType: row.unitType || 'base',
        discount: Number(row.discount) || 0,
        vat: Number(row.vat) || 0,
        totalPrice: total,
        paymentMethod: row.paymentMethod || 'Cash',
        paymentStatus: row.paymentStatus || 'Paid',
        customerName: row.customerName || null,
        customerPhone: row.customerPhone || null,
        batchId: row.batchId || null,
        notes: row.notes || null,
        dueDate: row.dueDate || null,
        paidAmount: row.paidAmount !== undefined && row.paidAmount !== '' ? Number(row.paidAmount) : undefined,
        taxType: row.taxType || 'VAT',
        orderNumber: row.orderNumber || null,
        convertedAt: row.convertedAt || null,
        cancelledAt: row.cancelledAt || null,
        createdAt: row.createdAt || null,
      });

      if (saleId) {
        result.imported++;
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert sale for "${row.itemName}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

export function importCategories(data: any[]): ImportResult {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const existingCats = getCategories() as any[];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      if (!row.name || row.name.trim() === '') {
        result.errors.push(`Row ${rowNum}: Category Name is required`);
        result.skipped++;
        continue;
      }

      const isDupe = existingCats.some((c: any) => c.name?.toLowerCase() === row.name?.toLowerCase());
      if (isDupe) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Category "${row.name}" already exists (skipped)`);
        continue;
      }

      const isCustom = row.isCustom === true || row.isCustom === 'true' || row.isCustom === '1' || row.isCustom === 'custom';
      const id = insertCategory(row.name.trim(), row.icon || 'ðŸ“¦', isCustom);
      if (id) {
        result.imported++;
        existingCats.push({ id: id as number, name: row.name.trim() });
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert category "${row.name}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

export async function executeImport(
  data: any[],
  moduleKey: string
): Promise<ImportResult> {
  switch (moduleKey) {
    case 'items': return importItems(data);
    case 'sales': return importSales(data);
    case 'categories': return importCategories(data);
    case 'contacts': return importContacts(data);
    case 'adjustments': return importAdjustments(data);
    case 'warehouses': return importWarehouses(data);
    case 'debt_payments': return importDebtPayments(data);
    case 'returns': return importReturns(data);
    default:
      return { success: false, imported: 0, skipped: 0, errors: [`Unknown module: ${moduleKey}`] };
  }
}

export function importContacts(data: any[]): ImportResult {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const existing = getContacts() as any[];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      if (!row.fullName || row.fullName.trim() === '') {
        result.errors.push(`Row ${rowNum}: Full Name is required`);
        result.skipped++;
        continue;
      }
      if (!row.category || row.category.trim() === '') {
        result.errors.push(`Row ${rowNum}: Category is required`);
        result.skipped++;
        continue;
      }

      // Check duplicate by name + phone
      const isDupe = existing.some((c: any) =>
        c.fullName?.toLowerCase() === row.fullName?.toLowerCase() &&
        c.phone === row.phone
      );
      if (isDupe) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Contact "${row.fullName}" with same phone already exists (skipped)`);
        continue;
      }

      const id = insertContact({
        fullName: row.fullName.trim(),
        category: row.category.trim(),
        subCategory: row.subCategory === '' ? null : (row.subCategory || null),
        phone: row.phone === '' ? null : (row.phone || null),
        alternatePhone: row.alternatePhone === '' ? null : (row.alternatePhone || null),
        accountNumber: row.accountNumber === '' ? null : (row.accountNumber || null),
        notes: row.notes === '' ? null : (row.notes || null),
        companyName: row.companyName === '' ? null : (row.companyName || null),
        email: row.email === '' ? null : (row.email || null),
        address: row.address === '' ? null : (row.address || null),
        tin: row.tin === '' ? null : (row.tin || null),
        supplierCategory: row.supplierCategory === '' ? null : (row.supplierCategory || null),
        paymentType: row.paymentType === '' ? 'cash' : (row.paymentType || 'cash'),
        isActive: row.isActive === '' ? true : (row.isActive === true || row.isActive === 'true' || row.isActive === '1'),
      });

      if (id) {
        result.imported++;
        existing.push({ id: id as number, fullName: row.fullName.trim() });
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert contact "${row.fullName}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

export function importAdjustments(data: any[]): ImportResult {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const items = getItems() as any[];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      if (!row.itemName || row.itemName.trim() === '') {
        result.errors.push(`Row ${rowNum}: Item Name is required`);
        result.skipped++;
        continue;
      }

      if (!row.type || !['price_up', 'price_down', 'damaged'].includes(row.type.toLowerCase())) {
        result.errors.push(`Row ${rowNum}: Type must be price_up, price_down, or damaged, got "${row.type}"`);
        result.skipped++;
        continue;
      }

      // Resolve item
      const matchedItem = items.find((item: any) =>
        item.name?.toLowerCase() === row.itemName?.toLowerCase()
      );
      if (!matchedItem) {
        result.errors.push(`Row ${rowNum}: Item "${row.itemName}" not found (skipped)`);
        result.skipped++;
        continue;
      }

      const adjData: any = {
        itemId: matchedItem.id,
        type: row.type.toLowerCase(),
        date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      };

      if (row.quantity) adjData.quantity = Number(row.quantity);
      if (row.oldValue) adjData.oldValue = Number(row.oldValue);
      if (row.newValue) adjData.newValue = Number(row.newValue);
      if (row.unitType) adjData.unitType = row.unitType;
      if (row.reason) adjData.reason = row.reason;

      const id = insertAdjustment(adjData);
      if (id) {
        result.imported++;
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert adjustment for "${row.itemName}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

export function importWarehouses(data: any[]): ImportResult {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const database = getDB();
  const existingWarehouses = database.getAllSync('SELECT * FROM warehouses') as any[];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      if (!row.name || row.name.trim() === '') {
        result.errors.push(`Row ${rowNum}: Warehouse Name is required`);
        result.skipped++;
        continue;
      }

      const isDupe = existingWarehouses.some((w: any) => w.name?.toLowerCase() === row.name?.toLowerCase());
      if (isDupe) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Warehouse "${row.name}" already exists (skipped)`);
        continue;
      }

      const statement = database.prepareSync('INSERT INTO warehouses (name, location, contactPerson, phone, notes) VALUES (?, ?, ?, ?, ?)');
      const res = statement.executeSync([
        row.name.trim(),
        row.location || null,
        row.contactPerson || null,
        row.phone || null,
        row.notes || null,
      ]);

      if (res.lastInsertRowId) {
        result.imported++;
        existingWarehouses.push({ id: res.lastInsertRowId, name: row.name.trim() });
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert warehouse "${row.name}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

export function importDebtPayments(data: any[]): ImportResult {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const database = getDB();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      if (!row.customerName || row.customerName.trim() === '') {
        result.errors.push(`Row ${rowNum}: Customer Name is required`);
        result.skipped++;
        continue;
      }
      
      const amount = Number(row.amount);
      if (isNaN(amount) || amount <= 0) {
        result.errors.push(`Row ${rowNum}: Amount must be a positive number`);
        result.skipped++;
        continue;
      }

      const statement = database.prepareSync('INSERT INTO debt_payments (saleId, customerName, customerPhone, amount, type, note) VALUES (?, ?, ?, ?, ?, ?)');
      const res = statement.executeSync([
        row.saleId ? Number(row.saleId) : null,
        row.customerName.trim(),
        row.customerPhone || null,
        amount,
        row.type || 'full',
        row.note || null,
      ]);

      if (res.lastInsertRowId) {
        result.imported++;
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert debt payment for "${row.customerName}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

export function importReturns(data: any[]): ImportResult {
  const result: ImportResult = { success: true, imported: 0, skipped: 0, errors: [] };
  const database = getDB();
  const items = getItems() as any[];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    try {
      if (!row.itemName || row.itemName.trim() === '') {
        result.errors.push(`Row ${rowNum}: Item Name is required`);
        result.skipped++;
        continue;
      }

      const quantity = Number(row.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        result.errors.push(`Row ${rowNum}: Quantity must be a positive number`);
        result.skipped++;
        continue;
      }

      const matchedItem = items.find((item: any) =>
        item.name?.toLowerCase() === row.itemName?.toLowerCase()
      );
      if (!matchedItem) {
        result.errors.push(`Row ${rowNum}: Item "${row.itemName}" not found in inventory (skipped)`);
        result.skipped++;
        continue;
      }

      const statement = database.prepareSync('INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, itemCondition, refundType, notes, returnDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const res = statement.executeSync([
        row.saleId ? Number(row.saleId) : null,
        matchedItem.id,
        quantity,
        row.unit || 'pcs',
        row.unitType || 'base',
        Number(row.totalRefund) || 0,
        row.reason || null,
        row.itemCondition || 'Resellable',
        row.refundType || 'Full Refund',
        row.notes || null,
        row.returnDate || null,
      ]);

      if (res.lastInsertRowId) {
        result.imported++;
      } else {
        result.errors.push(`Row ${rowNum}: Failed to insert return for "${row.itemName}"`);
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      result.skipped++;
    }
  }

  return result;
}

// â”€â”€â”€ CSV Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(columns: CSVColumn[], sampleData?: any[]): string {
  const header = columns.map(c => escapeCSVField(c.label)).join(',');
  const rows = [header];

  if (sampleData && sampleData.length > 0) {
    for (const item of sampleData) {
      const row = columns.map(c => escapeCSVField(item[c.key] ?? c.defaultValue ?? '')).join(',');
      rows.push(row);
    }
  } else {
    // Generate empty template with example values
    const exampleRow = columns.map(c => {
      switch (c.type) {
        case 'number': return escapeCSVField(c.key.includes('price') ? '0.00' : c.key.includes('quantity') || c.key.includes('id') ? '0' : '0');
        case 'date': return escapeCSVField('YYYY-MM-DD');
        case 'boolean': return escapeCSVField('true');
        default: return escapeCSVField(c.key === 'name' || c.key.includes('Name') ? 'Example Item' : c.defaultValue || '');
      }
    }).join(',');
    rows.push(exampleRow);
  }

  return rows.join('\n');
}

// â”€â”€â”€ File I/O â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function readCSVFile(uri: string): Promise<string> {
  try {
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return content;
  } catch {
    throw new Error('Failed to read CSV file');
  }
}

export async function downloadCSVTemplate(moduleKey: string): Promise<boolean> {
  const spec = CSV_SPECS[moduleKey];
  if (!spec) return false;

  const csv = generateCSV(spec.columns);
  const filename = `${spec.name.replace(/\s+/g, '_')}_Template.csv`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: `Download ${spec.name} Template`,
    });
    return true;
  }
  return false;
}

export async function exportToCSV(data: any[], moduleKey: string): Promise<boolean> {
  const spec = CSV_SPECS[moduleKey];
  if (!spec) return false;

  const csv = generateCSV(spec.columns, data);
  const filename = `${spec.name.replace(/\s+/g, '_')}_Export_${new Date().toISOString().split('T')[0]}.csv`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${spec.name}`,
    });
    return true;
  }
  return false;
}

// â”€â”€â”€ Preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PreviewData {
  headers: string[];
  mappedHeaders: { csv: string; db: string }[];
  rows: Record<string, string>[];
  totalRows: number;
  sampleRows: Record<string, string>[];
}

export function generatePreview(
  csvContent: string,
  moduleKey: string
): { preview: PreviewData; mapping: MappingResult } | null {
  const spec = CSV_SPECS[moduleKey];
  if (!spec) return null;

  const { headers, rows } = parseCSV(csvContent);
  if (headers.length === 0 || rows.length === 0) return null;

  const mapping = autoMapColumns(headers, spec);

  const mappedHeaders = mapping.mappings.map(m => ({ csv: m.csvColumn, db: m.dbField }));

  return {
    preview: {
      headers,
      mappedHeaders,
      rows,
      totalRows: rows.length,
      sampleRows: rows.slice(0, 5),
    },
    mapping,
  };
}