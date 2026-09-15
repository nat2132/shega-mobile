import { getDB, getScopedBusinessId, getAppSetting, setComplianceSetting } from '@/database/db';
import { createReminder, getActiveReminders } from '@/database/notifications';
import {
  classifyTaxpayer,
  defaultTaxProfile,
  buildTaxObligations,
  mergePaymentStatus,
  nextDueObligations,
  type TaxProfile,
  type TaxObligationWithStatus,
} from '@shega/shared';

const PROFILE_KEY = 'tax_profile';
const PAYMENTS_KEY = 'tax_payments';
const CREDITS_KEY = 'tax_vat_credits';
const LEGACY_SALE_TAX_CONFIG_KEY = 'sale_tax_config';

// ---------------------------------------------------------------------------
// Per-business tax configuration (stored as JSON on businesses.tax_config)
// ---------------------------------------------------------------------------

export interface TaxTypeConfig {
  id: string;
  name: string;
  rate: number;
  enabled: boolean;
  active: boolean;
}

export interface BusinessTaxConfig {
  enabled: boolean;
  taxTypes: TaxTypeConfig[];
}

/** Read the current business's tax config from businesses.tax_config. */
export const getBusinessTaxConfig = (): BusinessTaxConfig => {
  const db = getDB();
  const bizId = getScopedBusinessId();
  if (!bizId) return { enabled: false, taxTypes: [] };
  try {
    const row = db.getFirstSync<{ tax_config?: string }>(
      'SELECT tax_config FROM businesses WHERE id = ? AND is_deleted = 0',
      [bizId],
    ) as any;
    if (!row?.tax_config) return migrateLegacyTaxConfig(bizId);
    return JSON.parse(row.tax_config) as BusinessTaxConfig;
  } catch {
    return { enabled: false, taxTypes: [] };
  }
};

/** Save the current business's tax config. */
export const saveBusinessTaxConfig = (cfg: BusinessTaxConfig): void => {
  const db = getDB();
  const bizId = getScopedBusinessId();
  if (!bizId) return;
  db.runSync(
    'UPDATE businesses SET tax_config = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [JSON.stringify(cfg), bizId],
  );
};

/** Add a new tax type to the current business. Returns the updated config. */
export const addTaxType = (name: string, rate: number): BusinessTaxConfig => {
  const cfg = getBusinessTaxConfig();
  const id = `tax_${Date.now()}`;
  const isFirst = cfg.taxTypes.length === 0;
  cfg.taxTypes.push({ id, name, rate, enabled: true, active: isFirst });
  saveBusinessTaxConfig(cfg);
  return cfg;
};

/** Update an existing tax type. */
export const updateTaxType = (id: string, updates: Partial<Pick<TaxTypeConfig, 'name' | 'rate' | 'enabled' | 'active'>>): BusinessTaxConfig => {
  const cfg = getBusinessTaxConfig();
  const idx = cfg.taxTypes.findIndex((t) => t.id === id);
  if (idx < 0) return cfg;
  Object.assign(cfg.taxTypes[idx], updates);
  if (updates.active) {
    for (const t of cfg.taxTypes) t.active = t.id !== id ? false : true;
  }
  saveBusinessTaxConfig(cfg);
  return cfg;
};

/** Remove a tax type. */
export const removeTaxType = (id: string): BusinessTaxConfig => {
  const cfg = getBusinessTaxConfig();
  cfg.taxTypes = cfg.taxTypes.filter((t) => t.id !== id);
  if (cfg.taxTypes.length > 0 && !cfg.taxTypes.some((t) => t.active)) {
    cfg.taxTypes[0].active = true;
  }
  saveBusinessTaxConfig(cfg);
  return cfg;
};

/** Toggle the global enabled flag. */
export const toggleBusinessTax = (enabled: boolean): BusinessTaxConfig => {
  const cfg = getBusinessTaxConfig();
  cfg.enabled = enabled;
  saveBusinessTaxConfig(cfg);
  return cfg;
};

/** Set a tax type as the active one (others become inactive). */
export const setActiveTaxType = (id: string): BusinessTaxConfig => {
  return updateTaxType(id, { active: true });
};

/** Return the currently active (enabled) tax type, or null. */
export const getActiveTaxType = (): TaxTypeConfig | null => {
  const cfg = getBusinessTaxConfig();
  if (!cfg.enabled) return null;
  return cfg.taxTypes.find((t) => t.active && t.enabled) ?? null;
};

// Legacy compat: getSaleTaxConfig returns the old shape for callers that
// haven't been updated yet (e.g. sale-form, product-wizard pricing).
export interface SaleTaxConfig {
  taxType: 'VAT' | 'TOT' | 'Other' | 'None';
  taxRate: string;
}

export const getSaleTaxConfig = (): SaleTaxConfig => {
  const active = getActiveTaxType();
  if (!active) return { taxType: 'None', taxRate: '0' };
  const taxType = (['VAT', 'TOT'].includes(active.name.toUpperCase())
    ? active.name.toUpperCase()
    : 'Other') as 'VAT' | 'TOT' | 'Other';
  return { taxType, taxRate: String(active.rate) };
};

export const saveSaleTaxConfig = (cfg: SaleTaxConfig): SaleTaxConfig => {
  const bizId = getScopedBusinessId();
  const rate = parseFloat(cfg.taxRate) || 0;
  // Before onboarding (no business yet) stage into the legacy key so it can be
  // migrated into per-business config once a business is created.
  if (!bizId) {
    writeJson(LEGACY_SALE_TAX_CONFIG_KEY, { taxType: cfg.taxType, taxRate: String(rate) });
    return cfg;
  }
  const bizCfg = getBusinessTaxConfig();
  if (cfg.taxType === 'None') {
    bizCfg.enabled = false;
    saveBusinessTaxConfig(bizCfg);
    return cfg;
  }
  const existing = bizCfg.taxTypes.find(
    (t) => t.name.toUpperCase() === cfg.taxType.toUpperCase() && t.rate === rate,
  );
  if (existing) {
    existing.active = true;
    existing.enabled = true;
    for (const t of bizCfg.taxTypes) t.active = t.id === existing.id;
  } else {
    const id = `tax_${Date.now()}`;
    for (const t of bizCfg.taxTypes) t.active = false;
    bizCfg.taxTypes.push({ id, name: cfg.taxType, rate, enabled: true, active: true });
  }
  bizCfg.enabled = true;
  saveBusinessTaxConfig(bizCfg);
  return cfg;
};

/** Migrate legacy app_settings sale_tax_config into per-business tax_config. */
const migrateLegacyTaxConfig = (bizId: string): BusinessTaxConfig => {
  try {
    const raw = getAppSetting(LEGACY_SALE_TAX_CONFIG_KEY, null);
    if (!raw) return { enabled: false, taxTypes: [] };
    const legacy = JSON.parse(raw) as { taxType?: string; taxRate?: string };
    const rate = parseFloat(legacy.taxRate || '0') || 0;
    const name = legacy.taxType || 'None';
    if (name === 'None' || rate <= 0) return { enabled: false, taxTypes: [] };
    const cfg: BusinessTaxConfig = {
      enabled: true,
      taxTypes: [{ id: 'tax_migrated', name, rate, enabled: true, active: true }],
    };
    const db = getDB();
    db.runSync(
      'UPDATE businesses SET tax_config = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [JSON.stringify(cfg), bizId],
    );
    return cfg;
  } catch {
    return { enabled: false, taxTypes: [] };
  }
};

export interface TaxPaymentRecord {
  obligationId: string;
  kind: string;
  period: string;
  amount: number;
  paidDate: string;
  method?: string;
  reference?: string;
}

export interface VatCreditRecord {
  period: string;
  amount: number;
  note?: string;
}

export interface TaxPeriodTotals {
  period: string;
  year: number;
  month: number;
  turnover: number;
  outputVat: number;
  inputVat: number;
  netVat: number;
  whtCollected: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = getAppSetting(key, null);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  setComplianceSetting(key, JSON.stringify(value));
};

export const getBusinessName = (): string => {
  const db = getDB();
  const bizId = getScopedBusinessId();
  if (!bizId) return 'My Business';
  const row = db.getFirstSync<{ name?: string }>(
    'SELECT name FROM businesses WHERE id = ? AND is_deleted = 0',
    [bizId],
  ) as any;
  return row?.name || 'My Business';
};

export const annualTurnover = (year?: number): number => {
  try {
    const db = getDB();
    const bizId = getScopedBusinessId();
    if (!bizId) return 0;
    let sql = 'SELECT COALESCE(SUM(totalPrice), 0) AS total FROM sales WHERE businessId = ? AND (cancelledAt IS NULL OR cancelledAt = \'\') AND (paymentStatus IS NULL OR paymentStatus != \'Cancelled\')';
    const params = [bizId];
    if (year) {
      sql += ' AND CAST(strftime(\'%Y\', createdAt) AS INTEGER) = ?';
      params.push(String(year));
    }
    const row = db.getFirstSync<{ total: number }>(sql, params) as any;
    return Number(row?.total) || 0;
  } catch {
    return 0;
  }
};

export const getTaxProfile = (): TaxProfile => {
  const stored = readJson<Partial<TaxProfile> | null>(PROFILE_KEY, null);
  const base = defaultTaxProfile(getBusinessName());
  const merged: TaxProfile = { ...base, ...stored };
  const turnover = merged.estimatedAnnualTurnover ?? annualTurnover();
  if (!stored?.estimatedAnnualTurnover) merged.estimatedAnnualTurnover = Math.round(turnover);
  if (!stored?.category && turnover > 0) {
    merged.category = classifyTaxpayer(turnover, merged.vatRegistered);
  }
  return merged;
};

export const saveTaxProfile = (data: Partial<TaxProfile>): TaxProfile => {
  const current = getTaxProfile();
  const merged: TaxProfile = { ...current, ...data };
  if (data.estimatedAnnualTurnover != null) {
    merged.category = classifyTaxpayer(Number(data.estimatedAnnualTurnover) || 0, merged.vatRegistered);
  }
  writeJson(PROFILE_KEY, merged);
  return merged;
};

const getPayments = (): TaxPaymentRecord[] => readJson<TaxPaymentRecord[]>(PAYMENTS_KEY, []);

export const listTaxPayments = (): TaxPaymentRecord[] => getPayments();

export const recordTaxPayment = (
  input: Omit<TaxPaymentRecord, 'kind'> & { kind: string },
): TaxPaymentRecord => {
  const payments = getPayments();
  const existing = payments.findIndex((p) => p.obligationId === input.obligationId);
  const record: TaxPaymentRecord = { ...input, amount: round2(input.amount), paidDate: input.paidDate || iso(new Date()) };
  if (existing >= 0) payments[existing] = record;
  else payments.push(record);
  writeJson(PAYMENTS_KEY, payments);
  return record;
};

export const getVatCredits = (): VatCreditRecord[] => readJson<VatCreditRecord[]>(CREDITS_KEY, []);

export const addVatCredit = (credit: VatCreditRecord) => {
  const credits = getVatCredits();
  const existing = credits.findIndex((c) => c.period === credit.period);
  if (existing >= 0) credits[existing] = credit;
  else credits.push(credit);
  writeJson(CREDITS_KEY, credits);
};

export const periodTotals = (year: number, month: number): TaxPeriodTotals => {
  const db = getDB();
  const bizId = getScopedBusinessId();
  const period = `${year}-${String(month).padStart(2, '0')}`;
  let turnover = 0;
  let outputVat = 0;
  let whtCollected = 0;
  if (bizId) {
    const row = db.getFirstSync<{ turnover?: number; outputVat?: number; whtCollected?: number }>(
      `SELECT
         COALESCE(SUM(totalPrice), 0) AS turnover,
         COALESCE(SUM(vat), 0) AS outputVat,
         0 AS whtCollected
       FROM sales
       WHERE businessId = ? AND CAST(strftime('%Y', createdAt) AS INTEGER) = ? AND CAST(strftime('%m', createdAt) AS INTEGER) = ?
         AND (cancelledAt IS NULL OR cancelledAt = '')
         AND (paymentStatus IS NULL OR paymentStatus != 'Cancelled')`,
      [bizId, String(year), String(month)],
    ) as any;
    turnover = Number(row?.turnover) || 0;
    outputVat = Number(row?.outputVat) || 0;
    whtCollected = Number(row?.whtCollected) || 0;
  }
  const vatPayments = getPayments().filter((p) => p.kind === 'wht' && p.period === period);
  whtCollected = round2(vatPayments.reduce((s, p) => s + p.amount, 0));
  const inputVat = round2(getVatCredits().filter((c) => c.period === period).reduce((s, c) => s + c.amount, 0));
  return {
    period,
    year,
    month,
    turnover: round2(turnover),
    outputVat: round2(outputVat),
    inputVat,
    netVat: round2(outputVat - inputVat),
    whtCollected,
  };
};

export const obligationsFor = (year: number): TaxObligationWithStatus[] => {
  const profile = getTaxProfile();
  const obs = buildTaxObligations(
    { category: profile.category, vatRegistered: profile.vatRegistered, payrollActive: profile.payrollActive },
    year,
  );
  const payments = getPayments().map((p) => ({
    obligationId: p.obligationId,
    paidAmount: p.amount,
    paidDate: p.paidDate,
    reference: p.reference,
  }));
  return mergePaymentStatus(obs, payments);
};

export const dueSoon = (horizonDays = 45): TaxObligationWithStatus[] => {
  const profile = getTaxProfile();
  const now = new Date();
  const upcoming = nextDueObligations(
    { category: profile.category, vatRegistered: profile.vatRegistered, payrollActive: profile.payrollActive },
    now,
    horizonDays,
  );
  return mergePaymentStatus(upcoming, getPayments().map((p) => ({
    obligationId: p.obligationId,
    paidAmount: p.amount,
    paidDate: p.paidDate,
    reference: p.reference,
  })), now);
};

export const syncTaxReminders = (): number => {
  const existing = getActiveReminders().filter((r) => r.type === 'tax');
  let created = 0;
  for (const o of dueSoon(45)) {
    if (o.status === 'paid') continue;
    const title = `${o.label} — ${o.dueDate}`;
    if (existing.some((r) => r.title === title)) continue;
    const trigger = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const reminder = createReminder({
      type: 'tax',
      title,
      body: `Tax obligation due on ${o.dueDate}.`,
      triggerAt: trigger.toISOString(),
      repeatInterval: o.kind === 'vat' || o.kind === 'wht' || o.kind === 'paye' || o.kind === 'pension' || o.kind === 'tot' ? 'monthly' : undefined,
    });
    if (reminder) created += 1;
  }
  return created;
};

export const estimateAnnualTax = (): number => {
  const profile = getTaxProfile();
  const turnover = profile.estimatedAnnualTurnover ?? annualTurnover();
  if (profile.category === 'A') {
    return round2(turnover * 0.15 * 0.25);
  }
  return round2(turnover * 0.02);
};