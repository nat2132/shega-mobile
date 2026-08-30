// Lightweight barcode format detection used to pick the right ESC/POS
// symbology and to show the decoded format in scanner diagnostics.

export interface BarcodeFormatInfo {
  format: string;
  escposType: 0 | 2 | 3 | 4 | 64; // 0 UPC-A, 2 EAN-13, 3 EAN-8, 4 CODE128, 64 EAN-13 (GS1-128-ish)
  numeric: boolean;
}

export function detectBarcodeFormat(code: string): BarcodeFormatInfo {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 12) return { format: 'UPC-A', escposType: 0, numeric: true };
  if (digits.length === 8) return { format: 'EAN-8', escposType: 3, numeric: true };
  if (digits.length === 13) return { format: 'EAN-13', escposType: 2, numeric: true };
  if (digits.length === 14) return { format: 'GTIN-14', escposType: 2, numeric: true };
  return { format: 'CODE128', escposType: 4, numeric: false };
}