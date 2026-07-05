import { formatNumber } from '@/utils/formatNumber';

export const formatAbbreviated = (num: number) => {
  return formatNumber(num, { compact: true });
};

export const formatCurrency = (num: number) => {
  return formatNumber(num, { compact: num >= 1000 });
};
