#!/usr/bin/env python3
"""
Shega Mobile - Test Database Setup Script
=========================================
Creates the shegabe.db database with full schema and test data,
then runs the QA test suite.

Usage:
    python __tests__/qa/setup_database.py [scale]
    scale: 100, 1000, 10000 (default: 1000)
"""

import sqlite3
import os
import sys
import random
import json
from datetime import datetime, timedelta

SCALE = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DB_PATH = os.path.join(DB_DIR, 'shegabe.db')

# Delete existing DB if present
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
    print(f"   Removed existing database")

print(f"\n{'='*60}")
print(f" Creating Shega Test Database")
print(f" Path: {DB_PATH}")
print(f" Scale: {SCALE}")
print(f" {'='*60}\n")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA foreign_keys=OFF")  # Match app behavior

# ==================== CREATE SCHEMA ====================
print("Creating schema...")

conn.executescript("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        isCustom INTEGER NOT NULL DEFAULT 0
    );

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
        dueDate TEXT,
        paidAmount REAL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (itemId) REFERENCES items(id),
        FOREIGN KEY (packId) REFERENCES item_packs(id)
    );

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

    CREATE TABLE IF NOT EXISTS adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemId INTEGER NOT NULL,
        type TEXT NOT NULL,
        oldValue REAL,
        newValue REAL,
        quantity REAL,
        unitType TEXT,
        reason TEXT,
        date TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (itemId) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId INTEGER NOT NULL,
        itemId INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        unitType TEXT DEFAULT 'base',
        totalRefund REAL NOT NULL DEFAULT 0,
        reason TEXT,
        returnDate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (saleId) REFERENCES sales(id),
        FOREIGN KEY (itemId) REFERENCES items(id)
    );
""")

print("   Schema created successfully (7 tables)")

# ==================== SEED CATEGORIES ====================
categories = [
    ('Fasteners', 'screw', 0),
    ('Measuring & Layout', 'ruler', 0),
    ('Hardware', 'tool', 0),
    ('Paint & Supplies', 'paint', 0),
    ('Electrical', 'zap', 0),
    ('Plumbing', 'pipe', 0),
    ('Packing & Storage', 'box', 0),
    ('Cleaning Supplies', 'spray', 0),
    ('Safety & PPE', 'shield', 0),
    ('Building Materials', 'brick', 0),
    ('Grocery / Consumables', 'shopping', 0),
    ('Other', 'more', 0),
]
conn.executemany("INSERT INTO categories (name, icon, isCustom) VALUES (?, ?, ?)", categories)
cat_ids = list(range(1, len(categories) + 1))
print(f"   Inserted {len(categories)} categories")

# ==================== GENERATE ITEMS ====================
print(f"\nGenerating {min(SCALE, 5000)} items...")

product_templates = [
    ('Cement (50KG)', 'kg', 'kg', 10, 550, 480),
    ('Nail (5mm)', 'pcs', 'pcs', 1, 25, 18),
    ('Nail (10mm)', 'pcs', 'pcs', 1, 35, 25),
    ('Paint Red (4L)', 'litre', 'litre', 4, 1200, 900),
    ('Paint White (4L)', 'litre', 'litre', 4, 1100, 820),
    ('PVC Pipe 1"', 'm', 'm', 5, 150, 110),
    ('PVC Pipe 2"', 'm', 'm', 5, 250, 190),
    ('PVC Elbow 1"', 'pcs', 'pcs', 1, 45, 30),
    ('Electrical Wire 1.5mm', 'm', 'm', 3, 85, 60),
    ('Light Bulb LED 9W', 'pcs', 'pcs', 1, 180, 130),
    ('Switch Socket', 'pcs', 'pcs', 1, 90, 60),
    ('Measuring Tape 5m', 'pcs', 'pcs', 1, 120, 80),
    ('Spirit Level 60cm', 'pcs', 'pcs', 1, 350, 250),
    ('Bolt M10', 'pcs', 'pcs', 1, 12, 7),
    ('Cooking Oil (3L)', 'litre', 'litre', 3, 380, 320),
    ('Sugar (50KG)', 'kg', 'kg', 50, 2800, 2400),
    ('Rice (10KG)', 'kg', 'kg', 10, 650, 520),
    ('Pasta (500g)', 'pcs', 'pcs', 1, 45, 32),
    ('Safety Gloves', 'pcs', 'pcs', 1, 120, 85),
    ('Hard Hat', 'pcs', 'pcs', 1, 380, 280),
    ('Bucket 10L', 'pcs', 'pcs', 1, 150, 100),
    ('Ceramic Tile 30x30', 'sqm', 'sqm', 3, 450, 350),
    ('Steel Rebar 12mm', 'm', 'm', 3, 320, 250),
    ('Generator 2.5kVA', 'pcs', 'pcs', 1, 12500, 10000),
    ('Wheelbarrow', 'pcs', 'pcs', 1, 1800, 1400),
    ('Shovel', 'pcs', 'pcs', 1, 350, 250),
    ('Milk Powder (400g)', 'pcs', 'pcs', 1, 250, 195),
    ('Tomato Paste (500g)', 'pcs', 'pcs', 1, 85, 60),
    ('Masking Tape', 'roll', 'pcs', 1, 65, 42),
    ('Bleach (1L)', 'litre', 'litre', 1, 80, 55),
]

suppliers = ['', 'Ethio Builders PLC', 'Addis Industrial Supply', 'Habesha Cement', 'National Oil Ethiopia', 'Mohammed International']

item_count = min(SCALE, 5000)
items_data = []

for i in range(item_count):
    tmpl = product_templates[i % len(product_templates)]
    cat_id = tmpl[3]
    if i > len(product_templates):
        cat_id = random.choice(cat_ids)
    cat_id = tmpl[3] if i < len(product_templates) else random.choice(cat_ids)
    name = tmpl[0] if i < len(product_templates) else f"{random.choice(['Premium','Standard','Economy','Pro','Deluxe'])} {product_templates[i % len(product_templates)][0]} {random.randint(1,999)}"
    
    # Edge cases for specific indices
    notes = None
    expiry = None
    is_credit = 0
    base_price = tmpl[4] + random.randint(-10, 30)
    stock = random.randint(0, 200)
    
    if i == 0:
        stock = 0  # Zero stock
        notes = "Out of stock test"
    elif i == 1:
        base_price = -50  # Negative price
        notes = "Edge: negative price test"
    elif i == 5:
        stock = 999999  # Huge quantity
        notes = "Edge: extreme quantity"
    elif i == 6:
        expiry = "2020-01-01"  # Already expired
        notes = "Edge: expired item"
    elif i == 7:
        is_credit = 1  # Supplier credit
    
    supplier = random.choice(suppliers) if i % 3 == 0 else ''
    base_unit = tmpl[2]
    purchase_unit = tmpl[1]
    units_per_pack = random.randint(5, 50) if i % 4 == 0 else 1
    cost = tmpl[5] + random.randint(-5, 20)
    sell_price = abs(base_price)
    pack_price = sell_price * units_per_pack
    pack_qty = stock // units_per_pack if units_per_pack > 0 else 0
    created_at = datetime.now() - timedelta(days=random.randint(0, 730))
    
    items_data.append((
        name, cat_id, supplier, purchase_unit, base_unit, units_per_pack,
        float(pack_qty), float(stock),
        float(cost * units_per_pack), float(cost),
        float(sell_price), float(pack_price),
        1 if units_per_pack == 1 else 0, 1 if i % 4 == 0 else 0,
        expiry, 'Grade 1', notes, is_credit, None, None,
        created_at.strftime('%Y-%m-%d %H:%M:%S')
    ))

conn.executemany("""
    INSERT INTO items (name, categoryId, companyName, purchaseUnit, baseUnit, unitsPerPack,
    totalPackQuantity, totalBaseQuantity, packPurchasePrice, basePurchasePrice,
    baseSellingPrice, packSellingPrice, allowSellByBaseUnit, allowSellByPackUnit,
    expiryDate, qualityGrade, notes, isCredit, supplierPhone, supplierAccount, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", items_data)

print(f"   Inserted {item_count} items")

# ==================== GENERATE SALES ====================
sale_count = min(int(SCALE * 2.5), 10000)
print(f"Generating {sale_count} sales...")

customers = ['Abebe Kebede', 'Almaz Tesfaye', 'Biruk Mekonnen', 'Chaltu', 'Daniel', 'Eden Wondimu',
             'Fikadu', 'Genet', 'Haile', 'Iman', 'Jemal', 'Kebede', 'Lemlem', 'Mekdes',
             'Negasi', 'Rahel', 'Solomon', 'Tigist', 'Samuel', 'Tsion', 'Worku', 'Yonas', 'Zewditu']
phones = [f'091{random.randint(0,9)}{random.randint(100000,999999)}' for _ in range(20)]

sales_data = []
sale_ids = []

for i in range(sale_count):
    item_id = random.randint(1, item_count)
    is_pack = i % 10 == 0
    qty = random.randint(1, is_pack and 5 or 50)
    unit_price = random.uniform(10, 500)
    discount = random.uniform(0, 50) if i % 5 != 0 else 0
    total = max(0, qty * unit_price - discount)
    is_debt = i % 8 == 0
    customer = random.choice(customers) if is_debt or i % 5 == 0 else ''
    phone = random.choice(phones) if customer else ''
    created = datetime.now() - timedelta(days=random.randint(0, 730), hours=random.randint(0, 23))
    
    sales_data.append((
        item_id, float(qty), is_pack and 'pack' or 'pcs', is_pack and 'pack' or 'base',
        float(discount), 0.0, float(total),
        random.choice(['Cash', 'Bank', 'Debt']), is_debt and 'Debt' or 'Paid',
        customer, phone, None,
        is_debt and (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d') or None,
        float(is_debt and random.uniform(0, total/2) or total),
        created.strftime('%Y-%m-%d %H:%M:%S')
    ))
    sale_ids.append(i + 1)

conn.executemany("""
    INSERT INTO sales (itemId, quantity, unit, unitType, discount, vat, totalPrice,
    paymentMethod, paymentStatus, customerName, customerPhone, packId, dueDate, paidAmount, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", sales_data)

print(f"   Inserted {sale_count} sales")

# ==================== GENERATE EXPENSES ====================
expense_count = min(int(SCALE * 0.75), 5000)
print(f"Generating {expense_count} expenses...")

exp_cats = ['Rent', 'Utilities', 'Salary', 'Transport', 'Marketing', 'Equipment', 'Maintenance', 'Insurance', 'Tax', 'Miscellaneous']
expenses_data = []

for i in range(expense_count):
    cat = random.choice(exp_cats)
    date = datetime.now() - timedelta(days=random.randint(0, 730))
    is_rec = 1 if i % 10 == 0 else 0
    
    expenses_data.append((
        f"{cat} #{i+1}", random.uniform(50, 50000), cat,
        date.strftime('%Y-%m-%d'), is_rec,
        is_rec and random.choice(['daily', 'weekly', 'monthly']) or None,
        is_rec and (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d') or None,
        date.strftime('%Y-%m-%d %H:%M:%S')
    ))

conn.executemany("""
    INSERT INTO expenses (name, amount, category, date, isRecurring, frequency, nextBillingDate, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", expenses_data)

print(f"   Inserted {expense_count} expenses")

# ==================== GENERATE ADJUSTMENTS ====================
adj_count = min(int(SCALE * 0.5), 3000)
print(f"Generating {adj_count} adjustments...")

types = ['price_up', 'price_down', 'damaged']
reasons = ['Market Shift', 'Supplier Update', 'Broken', 'Expired', 'Defective', 'Water Damage', 'Manual Correction']

adj_data = []
for i in range(adj_count):
    adj_type = random.choice(types)
    item_id = random.randint(1, item_count)
    old_val = random.uniform(50, 1000)
    new_val = old_val * (random.uniform(1.1, 1.5) if adj_type == 'price_up' else random.uniform(0.5, 0.95))
    qty = random.randint(1, 10) if adj_type == 'damaged' else None
    date = datetime.now() - timedelta(days=random.randint(0, 730))
    
    adj_data.append((
        item_id, adj_type, old_val, new_val,
        qty, qty and 'base' or None,
        random.choice(reasons),
        date.strftime('%Y-%m-%d'), date.strftime('%Y-%m-%d %H:%M:%S')
    ))

conn.executemany("""
    INSERT INTO adjustments (itemId, type, oldValue, newValue, quantity, unitType, reason, date, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
""", adj_data)

print(f"   Inserted {adj_count} adjustments")

# ==================== GENERATE RETURNS ====================
ret_count = min(int(SCALE * 0.2), 1000)
print(f"Generating {ret_count} returns...")

ret_reasons = ['Customer request', 'Damaged', 'Wrong item', 'Expired', 'Defective']
ret_data = []

for i in range(ret_count):
    sale_id = random.choice(sale_ids) if sale_ids else 1
    item_id = random.randint(1, item_count)
    qty = random.randint(1, 5)
    date = datetime.now() - timedelta(days=random.randint(0, 365))
    
    ret_data.append((
        sale_id, item_id, float(qty), 'pcs', 'base',
        random.uniform(50, 500), random.choice(ret_reasons),
        date.strftime('%Y-%m-%d'), date.strftime('%Y-%m-%d %H:%M:%S')
    ))

conn.executemany("""
    INSERT INTO returns (saleId, itemId, quantity, unit, unitType, totalRefund, reason, returnDate, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
""", ret_data)

print(f"   Inserted {ret_count} returns")

# ==================== GENERATE ITEM PACKS ====================
pack_count = min(int(SCALE * 0.5), 2000)
print(f"Generating {pack_count} item packs...")

packs_data = []
for i in range(pack_count):
    item_id = random.randint(1, item_count)
    initial = random.uniform(10, 200)
    current = random.uniform(0, initial)
    status = current == 0 and 'Depleted' or (current < initial * 0.5 and 'Opened' or 'Not Opened')
    
    packs_data.append((
        item_id, random.randint(1, 50), initial, current,
        random.choice(['pcs', 'kg', 'litre']), status
    ))

conn.executemany("""
    INSERT INTO item_packs (itemId, packNumber, initialQuantity, currentQuantity, unit, status)
    VALUES (?, ?, ?, ?, ?, ?)
""", packs_data)

print(f"   Inserted {pack_count} item packs")

# ==================== VERIFY ====================
conn.commit()

print(f"\n{'='*60}")
print(f" Database Creation Summary")
print(f" {'='*60}")
for table in ['categories', 'items', 'sales', 'expenses', 'adjustments', 'returns', 'item_packs']:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"   {table}: {count:,} records")

conn.close()

print(f"\n Database file: {DB_PATH}")
size = os.path.getsize(DB_PATH)
print(f" File size: {size/1024:.1f} KB")
print(f"\n{'='*60}")
print(f" Setup complete. Ready for QA testing.")
print(f" Run: python __tests__\\qa\\qa_test_runner.py --scale {SCALE}")
print(f" {'='*60}\n")