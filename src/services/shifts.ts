// ============================================
// Shift Management - Mobile
// ============================================

import { getDB } from '../database/db';

export type ShiftStatus = 'open' | 'mid_audit' | 'blind_count' | 'closed';

export interface Shift {
  id: number;
  businessId: number;
  registerId: number;
  cashierId: number;
  openingFloat: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  midAuditAt: string | null;
  blindCountAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftTransaction {
  id: number;
  shiftId: number;
  saleId: number | null;
  paymentMethod: string;
  amount: number;
  createdAt: string;
}

export interface CashDrawerCount {
  denomination: number;
  count: number;
  total: number;
}

export interface ShiftSummary {
  shift: Shift;
  totals: {
    cash: number;
    card: number;
    mobile: number;
    total: number;
  };
  counts: {
    sales: number;
    voids: number;
    refunds: number;
    returns: number;
  };
  cashDrawer: {
    expected: number;
    counted: number;
    variance: number;
    breakdown: CashDrawerCount[];
  };
}

// ============================================
// Shift Operations
// ============================================

export function openShift(
  businessId: number,
  registerId: number,
  cashierId: number,
  openingFloat: number,
  notes?: string
): number {
  const db = getDB();
  const existing = db.getFirstSync(`
    SELECT id FROM shifts 
    WHERE registerId = ? AND status IN ('open', 'mid_audit', 'blind_count')
  `, [registerId]) as any;

  if (existing) {
    throw new Error('Register already has an open shift');
  }

  const now = new Date().toISOString();
  const result = db.runSync(`
    INSERT INTO shifts (businessId, registerId, cashierId, openingFloat, expectedCash, status, openedAt, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
  `, [businessId, registerId, cashierId, openingFloat, openingFloat, now, notes || '', now, now]);

  const shiftId = result.lastInsertRowid;
  
  // Record opening float
  db.runSync(`
    INSERT INTO shift_transactions (shiftId, saleId, paymentMethod, amount, createdAt)
    VALUES (?, NULL, 'float', ?, ?)
  `, [shiftId, openingFloat, new Date().toISOString()]);

  console.log(`[Shift] Opened shift ${shiftId} for register ${registerId} with float ${openingFloat}`);
  return shiftId;
}

export function getOpenShift(registerId: number): Shift | null {
  const db = getDB();
  return db.getFirstSync(`
    SELECT * FROM shifts 
    WHERE registerId = ? AND status IN ('open', 'mid_audit', 'blind_count')
    ORDER BY openedAt DESC LIMIT 1
  `, [registerId]) as Shift | null;
}

export function getShiftById(shiftId: number): Shift | null {
  const db = getDB();
  return db.getFirstSync('SELECT * FROM shifts WHERE id = ?', [shiftId]) as Shift | null;
}

export function recordMidShiftAudit(shiftId: number, countedCash: number, notes?: string): void {
  const db = getDB();
  const shift = getShiftById(shiftId);
  if (!shift) throw new Error('Shift not found');
  if (shift.status !== 'open') throw new Error('Shift is not open');

  const now = new Date().toISOString();
  const variance = countedCash - shift.expectedCash;

  db.runSync(`
    UPDATE shifts 
    SET status = 'mid_audit', 
        countedCash = ?, 
        variance = ?, 
        midAuditAt = ?, 
        notes = COALESCE(notes || '; ', '') || ?,
        updatedAt = ?
    WHERE id = ?
  `, [countedCash, variance, now, notes || '', now, shiftId]);

  console.log(`[Shift] Mid-shift audit for shift ${shiftId}: counted ${countedCash}, variance ${variance}`);
}

export function recordBlindCount(shiftId: number, countedCash: number, notes?: string): void {
  const db = getDB();
  const shift = getShiftById(shiftId);
  if (!shift) throw new Error('Shift not found');
  if (shift.status !== 'open' && shift.status !== 'mid_audit') {
    throw new Error('Shift must be open or in mid-audit for blind count');
  }

  const now = new Date().toISOString();
  const variance = countedCash - shift.expectedCash;

  db.runSync(`
    UPDATE shifts 
    SET status = 'blind_count', 
        countedCash = ?, 
        variance = ?, 
        blindCountAt = ?, 
        notes = COALESCE(notes || '; ', '') || ?,
        updatedAt = ?
    WHERE id = ?
  `, [countedCash, variance, now, notes || '', now, shiftId]);

  console.log(`[Shift] Blind count for shift ${shiftId}: counted ${countedCash}, variance ${variance}`);
}

export function closeShift(
  shiftId: number,
  countedCash: number,
  cashDrawerCounts: { denomination: number; count: number; total: number }[],
  notes?: string
): any {
  const db = getDB();
  const shift = getShiftById(shiftId);
  if (!shift) throw new Error('Shift not found');
  if (shift.status === 'closed') throw new Error('Shift already closed');

  const now = new Date().toISOString();
  const variance = countedCash - shift.expectedCash;

  // Calculate totals
  const totals = calculateShiftTotals(shiftId);

  db.runSync(`
    UPDATE shifts 
    SET status = 'closed', 
        countedCash = ?, 
        variance = ?, 
        closedAt = ?, 
        expectedCash = ?,
        notes = COALESCE(notes || '; ', '') || ?,
        updatedAt = ?
    WHERE id = ?
  `, [countedCash, variance, now, shift.expectedCash, notes || '', now, shiftId]);

  // Record cash drawer breakdown
  for (const count of cashDrawerCounts) {
    db.runSync(`
      INSERT INTO shift_cash_counts (shiftId, denomination, count, total, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [shiftId, count.denomination, count.count, count.total, new Date().toISOString()]);
  }

  const summary = generateShiftSummary(shiftId, countedCash, cashDrawerCounts);
  console.log(`[Shift] Closed shift ${shiftId}: variance ${variance}`);
  return summary;
}

function calculateShiftTotals(shiftId: number): any {
  const db = getDB();
  const sales = db.getAllSync(`
    SELECT paymentMethod, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM shift_transactions
    WHERE shiftId = ? AND saleId IS NOT NULL
    GROUP BY paymentMethod
  `, [shiftId]) as any[];

  const totals = { cash: 0, card: 0, mobile: 0, total: 0 };
  const counts = { sales: 0, voids: 0, refunds: 0, returns: 0 };

  for (const s of sales) {
    const method = s.paymentMethod?.toLowerCase();
    if (method === 'cash') totals.cash = s.total;
    else if (method === 'card') totals.card = s.total;
    else if (method === 'mobile') totals.mobile = s.total;
    totals.total += s.total;
  }

  return { totals, counts };
}

export function generateShiftSummary(shiftId: number, countedCash: number, cashDrawerCounts: { denomination: number; count: number; total: number }[]): any {
  const shift = getShiftById(shiftId)!;
  const totals = calculateShiftTotals(shiftId);
  const expected = shift.expectedCash;
  const variance = countedCash - expected;

  return {
    shift,
    totals: totals.totals,
    counts: totals.counts,
    cashDrawer: {
      expected,
      counted: countedCash,
      variance,
      breakdown: cashDrawerCounts,
    },
  };
}

// ============================================
// Cash Drawer Operations
// ============================================

export function getCashDrawerBreakdown(shiftId: number): { denomination: number; count: number; total: number }[] {
  const db = getDB();
  return db.getAllSync(`
    SELECT denomination, count, total
    FROM shift_cash_counts
    WHERE shiftId = ?
    ORDER BY denomination DESC
  `, [shiftId]) as { denomination: number; count: number; total: number }[];
}

export function calculateExpectedCash(shiftId: number): number {
  const db = getDB();
  const shift = getShiftById(shiftId);
  if (!shift) return 0;
  
  const cashSales = db.getFirstSync(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM shift_transactions
    WHERE shiftId = ? AND paymentMethod = 'cash' AND saleId IS NOT NULL
  `, [shiftId]) as any;

  const cashRefunds = db.getFirstSync(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM shift_transactions st
    JOIN returns r ON st.saleId = r.saleId
    WHERE st.shiftId = ? AND st.paymentMethod = 'cash' AND r.refundAmount > 0
  `, [shiftId]) as any;

  const cashPaidOut = db.getFirstSync(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM shift_transactions
    WHERE shiftId = ? AND paymentMethod = 'cash' AND saleId IS NULL AND amount < 0
  `, [shiftId]) as any;

  return (shift.openingFloat || 0) + (cashSales?.total || 0) - (cashRefunds?.total || 0) + (cashPaidOut?.total || 0);
}

// ============================================
// Shift Transactions
// ============================================

export function addShiftTransaction(
  shiftId: number,
  saleId: number | null,
  paymentMethod: string,
  amount: number
): number {
  const db = getDB();
  const result = db.runSync(`
    INSERT INTO shift_transactions (shiftId, saleId, paymentMethod, amount, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `, [shiftId, saleId, paymentMethod, amount, new Date().toISOString()]);

  const shift = getShiftById(shiftId);
  if (shift && shift.status === 'open') {
    const method = paymentMethod.toLowerCase();
    if (method === 'cash') {
      db.runSync('UPDATE shifts SET expectedCash = expectedCash + ? WHERE id = ?', [amount, shiftId]);
    }
  }

  return result.lastInsertRowid;
}

export function getShiftTransactions(shiftId: number): any[] {
  const db = getDB();
  return db.getAllSync(`
    SELECT st.*, s.customerName, s.totalPrice
    FROM shift_transactions st
    LEFT JOIN sales s ON st.saleId = s.id
    WHERE st.shiftId = ?
    ORDER BY st.createdAt DESC
  `, [shiftId]) as any[];
}

export default {
  openShift,
  getOpenShift,
  getShiftById,
  recordMidShiftAudit,
  recordBlindCount,
  closeShift,
  calculateShiftTotals,
  generateShiftSummary,
  getCashDrawerBreakdown,
  calculateExpectedCash,
  addShiftTransaction,
  getShiftTransactions,
};