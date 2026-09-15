import { getAppSetting, setComplianceSetting } from '@/database/db';

// Saved mobile-banking providers the cashier can pick at checkout. Stored as a
// JSON list in app_settings so they persist and are reused on every future sale.
export interface MobileBankingProvider {
  id: string;
  name: string;
  account?: string;
}

const KEY = 'mobile_banking_providers';

// Seeded once on first use so the picker is never empty.
const DEFAULTS: MobileBankingProvider[] = [
  { id: 'telebirr', name: 'Telebirr', account: '' },
  { id: 'cbe-birr', name: 'CBE Birr', account: '' },
];

const read = (): MobileBankingProvider[] | null => {
  try {
    const raw = getAppSetting(KEY, null);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MobileBankingProvider[]) : null;
  } catch {
    return null;
  }
};

const write = (list: MobileBankingProvider[]): void => {
  setComplianceSetting(KEY, JSON.stringify(list));
};

export function getMobileBankingProviders(): MobileBankingProvider[] {
  const stored = read();
  if (!stored) {
    write(DEFAULTS);
    return [...DEFAULTS];
  }
  return stored;
}

export function addMobileBankingProvider(name: string, account?: string): MobileBankingProvider {
  const clean = name.trim();
  if (!clean) throw new Error('Provider name is required');
  const list = read() ?? DEFAULTS;
  const provider: MobileBankingProvider = {
    id: `mb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    account: (account || '').trim(),
  };
  write([...list, provider]);
  return provider;
}

export function removeMobileBankingProvider(id: string): void {
  const list = read() ?? DEFAULTS;
  write(list.filter((p) => p.id !== id));
}