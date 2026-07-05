export interface FormatNumberOptions {
  decimals?: number;
  prefix?: string;
  suffix?: string;
  showSign?: boolean;
  compact?: boolean;
  fallback?: string;
}

export function formatNumber(
  value: number | null | undefined,
  options: FormatNumberOptions = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return options.fallback ?? '—';
  }

  const {
    decimals = 0,
    prefix = '',
    suffix = '',
    showSign = false,
    compact = false,
  } = options;

  let formatted: string;

  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) {
      formatted = (abs / 1_000_000_000).toFixed(1) + 'B';
    } else if (abs >= 1_000_000) {
      formatted = (abs / 1_000_000).toFixed(1) + 'M';
    } else if (abs >= 1_000) {
      formatted = (abs / 1_000).toFixed(1) + 'K';
    } else {
      formatted = abs.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
  } else {
    formatted = Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const sign = value < 0 ? '\u2212' : showSign && value > 0 ? '+' : '';

  return `${sign}${prefix}${formatted}${suffix}`;
}
