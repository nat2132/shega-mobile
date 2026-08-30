// Shared pricing intelligence for the Shega product/pricing system.
// Single source of truth for tax-aware profit, margin and markup so the
// wizard, item details and future reports all agree on the numbers.

export type TaxTreatment = 'inclusive' | 'exclusive';

// Canonical tax rates (Ethiopian VAT 15%, TOT 2%). Mirrors the existing sale
// engine which hard-codes VAT=15 at the point of sale.
export const DEFAULT_TAX_RATES: Record<string, number> = {
  VAT: 15,
  TOT: 2,
};

export function taxRateFor(taxType?: string | null): number {
  if (!taxType || taxType === 'None') return 0;
  return DEFAULT_TAX_RATES[taxType] ?? 0;
}

export interface TaxBreakdown {
  rate: number;   // fraction, e.g. 0.15
  gross: number;  // total charged to the customer (incl. tax where applicable)
  tax: number;    // amount of tax
  net: number;    // net sales value retained by the business
}

// Split a selling price into net + tax given the product's tax type and the
// tax-inclusive/exclusive treatment of the stored price.
//
//   exclusive: stored price is BEFORE tax  -> net = price, tax = price * rate
//   inclusive: stored price INCLUDES tax   -> net = price / (1 + rate)
export function splitTax(
  price: number,
  taxType?: string | null,
  treatment: TaxTreatment = 'exclusive'
): TaxBreakdown {
  const ratePct = taxRateFor(taxType);
  const rate = ratePct / 100;
  if (ratePct <= 0) return { rate: 0, gross: price, tax: 0, net: price };
  if (treatment === 'inclusive') {
    const net = price / (1 + rate);
    return { rate, gross: price, tax: price - net, net };
  }
  return { rate, gross: price, tax: price * rate, net: price };
}

export interface ProfitMetrics {
  cost: number;       // effective per-unit cost
  price: number;      // selling price
  tax: number;        // tax portion of the price
  netRevenue: number; // net sales value
  grossProfit: number;// netRevenue - cost
  margin: number;     // grossProfit / netRevenue * 100
  markup: number;     // grossProfit / cost * 100
}

export function profitMetrics(
  cost: number,
  price: number,
  taxType?: string | null,
  treatment: TaxTreatment = 'exclusive'
): ProfitMetrics {
  const t = splitTax(price, taxType, treatment);
  const grossProfit = t.net - cost;
  let margin: number;
  if (t.net > 0) margin = (grossProfit / t.net) * 100;
  else if (grossProfit === 0) margin = 0;
  else margin = grossProfit > 0 ? Infinity : -Infinity;
  const markup = cost > 0 ? (grossProfit / cost) * 100 : (grossProfit === 0 ? 0 : Infinity);
  return { cost, price, tax: t.tax, netRevenue: t.net, grossProfit, margin, markup };
}

// Selling price (with correct tax treatment) required to reach targetMarginPct.
// Margin is defined on net revenue: net = cost / (1 - margin).
export function suggestedSellingPrice(
  cost: number,
  targetMarginPct: number,
  taxType?: string | null,
  treatment: TaxTreatment = 'exclusive'
): number | null {
  const margin = targetMarginPct / 100;
  if (cost <= 0 || margin >= 1) return null;
  const net = cost / (1 - margin);
  const ratePct = taxRateFor(taxType);
  if (treatment === 'inclusive' && ratePct > 0) {
    return net * (1 + ratePct / 100);
  }
  return net;
}

// Quantity-based forecast: what happens if all `quantity` units sell.
export interface StockForecast {
  unitProfit: number;
  totalProfit: number;
  revenue: number;
  netRevenue: number;
  tax: number;
  cost: number;
}

export function stockForecast(
  unitCost: number,
  unitPrice: number,
  quantity: number,
  taxType?: string | null,
  treatment: TaxTreatment = 'exclusive'
): StockForecast | null {
  if (quantity <= 0) return null;
  const m = profitMetrics(unitCost, unitPrice, taxType, treatment);
  return {
    unitProfit: m.grossProfit,
    totalProfit: m.grossProfit * quantity,
    revenue: m.price * quantity,
    netRevenue: m.netRevenue * quantity,
    tax: m.tax * quantity,
    cost: m.cost * quantity,
  };
}

// -- formatting helpers ------------------------------------------------------

export function fmtMoney(value?: number | null, digits: number = 2): string {
  if (value === undefined || value === null || !isFinite(value)) return '0.00';
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Percent without trailing zeros: 28 -> "28%", 38.9 -> "38.9%", -20 -> "-20%"
export function fmtPercent(value?: number | null): string {
  if (value === undefined || value === null || !isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}