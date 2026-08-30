// ESC/POS receipt, test-page and cash-drawer byte builders.
//
// Built on the pure `EscposWriter` from `@/utils/escpos`. Output is ASCII-safe
// (no unicode glyphs) so it prints correctly on 58/80mm thermal printers and
// any code page. Also produces human-readable plain-text previews for the
// printer diagnostics screens (honest "what WOULD print" preview while the
// real hardware transport still requires a development build).

import { EscposWriter } from '@/utils/escpos';
import { detectBarcodeFormat } from './barcodeFormat';

export interface PrinterMeta {
  businessName: string;
  businessDetails?: string; // address / phone line
  orderId: string;
  dateTime: string;
  cashier: string;
}

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitLabel?: string;
  unitPrice: number;
  total: number;
}

export interface ReceiptLayoutOptions {
  lines: ReceiptLine[];
  subtotal: number;
  discount: number; // amount subtracted (positive)
  vat: number;
  total: number;
  paid: number;
  change: number;
  paymentMethod: string;
  footer?: string;
  qr?: string;
  paperWidth?: 58 | 80;
}

const money = (n: number): string => {
  const r = Math.max(0, n || 0).toFixed(2);
  return r;
};

const qtyLabel = (l: ReceiptLine): string => {
  const q = Number(l.quantity) || 0;
  const qStr = Number.isInteger(q) ? String(q) : q.toFixed(2);
  return `${qStr}${l.unitLabel ? l.unitLabel.trim() : ''}`;
};

const truncate = (s: string, width: number): string => (s.length > width ? s.slice(0, Math.max(width, 2) - 1) : s);

// Total column width for a paper size. ASCII printers need a load of dash
// separators that fit inside the printable column (32 chars on 58mm, 44 on 80mm).
const widthFor = (paper: 58 | 80 | undefined): number => (paper === 80 ? 44 : 32);

const rule = (width: number): string => '-'.repeat(width);

function writeHeader(w: EscposWriter, meta: PrinterMeta, width: number): void {
  w.init();
  w.codePage(0);
  w.align(1).bold(true).size(1, 1).text(truncate(meta.businessName || 'BUSINESS', width)).lineFeed().bold(false).size(0, 0);
  if (meta.businessDetails) {
    w.align(1).text(truncate(meta.businessDetails, width)).lineFeed();
  }
  w.align(1).text(rule(width)).lineFeed();
  w.align(0);
  w.column('Order', meta.orderId, width);
  w.column('Date', meta.dateTime, width);
  w.column('Cashier', truncate(meta.cashier || '-', 14), width);
  w.text(rule(width)).lineFeed();
}

export function buildReceiptBytes(meta: PrinterMeta, options: ReceiptLayoutOptions): Uint8Array {
  const width = widthFor(options.paperWidth);
  const w = new EscposWriter();
  writeHeader(w, meta, width);

  for (const l of options.lines) {
    w.text(truncate(l.name, width)).lineFeed();
    const qty = qtyLabel(l);
    const right = money(l.total);
    const left = `${qty} x ${money(l.unitPrice)}`;
    w.text(`${truncate(left, width - right.length)}  ${right}`).lineFeed();
  }
  w.text(rule(width)).lineFeed();
  w.column('SUB TOTAL', money(options.subtotal), width);
  if (options.discount > 0) w.column('Discount', `-${money(options.discount)}`, width);
  if (options.vat > 0) w.column('VAT', money(options.vat), width);
  w.bold(true).size(1, 1);
  w.column('TOTAL', money(options.total), width);
  w.size(0, 0).bold(false);
  w.column('Paid', money(options.paid), width);
  if (options.change > 0) w.column('Change', money(options.change), width);
  if (options.paymentMethod) w.column('Method', truncate(options.paymentMethod, 16), width);
  w.text(rule(width)).lineFeed();

  if (options.footer) {
    w.text(truncate(options.footer, width)).lineFeed().lineFeed();
  }

  // Barcode + QR so the sale can be looked up or scanned for returns.
  w.align(1);
  if (options.qr) w.qr(options.qr, 4);
  if (meta.orderId) {
    try {
      const fmt = detectBarcodeFormat(meta.orderId);
      if (fmt.numeric && fmt.escposType === 2) w.barcodeEan13(meta.orderId);
      else w.barcode(4, meta.orderId.slice(0, 40));
    } catch {
      // fall through — barcode is a nicety, not required for the receipt
    }
  }
  w.align(1).text('*** THANK YOU ***').lineFeed();
  w.lineFeed(3);
  w.cut(true);
  return w.toUint8Array();
}

export interface TestReceiptOptions {
  deviceName: string;
  connectionLabel: string;
  paperWidth?: 58 | 80;
}

export function buildTestReceiptBytes(opts: TestReceiptOptions): Uint8Array {
  const width = widthFor(opts.paperWidth);
  const w = new EscposWriter();
  w.init().codePage(0);
  w.align(1).bold(true).size(1, 1).text(truncate(opts.deviceName, width)).lineFeed().size(0, 0).bold(false);
  w.align(1).bold(true).text('** PRINTER TEST **').bold(false).lineFeed();
  w.align(1).text(rule(width)).lineFeed();
  w.align(0);
  w.column('Status', '[OK]', width);
  w.column('Connection', truncate(opts.connectionLabel, width - 15), width);
  w.column('Paper', opts.paperWidth === 80 ? '80mm' : '58mm', width);
  w.column('Command set', 'ESC/POS', width);
  w.text(rule(width)).lineFeed();
  w.text('Line 1').lineFeed();
  w.text('Line 2').lineFeed();
  w.text(rule(width)).lineFeed();
  w.text('[OK] Header row').lineFeed();
  w.text('[OK] Data row').lineFeed();
  w.align(1).text('[OK] Alignment: center').lineFeed();
  w.bold(true).text('[OK] Bold text').bold(false).lineFeed();
  w.size(1, 1).text('[OK] LARGE').size(0, 0).lineFeed();
  w.align(0).text(rule(width)).lineFeed();
  w.align(1).text('BARCODE').lineFeed().text('123456789012').lineFeed();
  w.align(0).text(rule(width)).lineFeed();
  w.qr('SHEGA-BUSINESS-2026', 4);
  w.align(1).text('[OK]').lineFeed();
  w.bold(true).text('*** TEST COMPLETE ***').bold(false).lineFeed();
  w.align(1).text(truncate('Thank you!-' + opts.deviceName, width)).lineFeed();
  w.lineFeed(3);
  w.cut(true);
  return w.toUint8Array();
}

export function buildTestReceiptPreview(opts: TestReceiptOptions): string {
  const width = widthFor(opts.paperWidth);
  const lines: string[] = [];
  lines.push(opts.deviceName);
  lines.push('** PRINTER TEST **');
  lines.push(rule(width));
  lines.push('Status     : [OK]');
  lines.push(`Connection : ${opts.connectionLabel}`);
  lines.push(`Paper      : ${opts.paperWidth === 80 ? '80mm' : '58mm'}`);
  lines.push('Command set: ESC/POS');
  lines.push(rule(width));
  lines.push('[OK] Header row');
  lines.push('[OK] Data row');
  lines.push('[OK] Bold text');
  lines.push('[OK] LARGE');
  lines.push(rule(width));
  lines.push('BARCODE 123456789012');
  lines.push('QR: SHEGA-BUSINESS-2026');
  lines.push(rule(width));
  lines.push('*** TEST COMPLETE ***');
  return lines.join('\n');
}

export function buildDrawerKickBytes(pin: 2 | 5 = 2): Uint8Array {
  return new EscposWriter().init().openDrawer(pin).toUint8Array();
}