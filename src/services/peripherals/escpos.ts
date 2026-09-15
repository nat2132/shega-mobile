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

// --- Virtual printer diagnostics -------------------------------------------------
//
// A per-command record for the ESC/POS command diagnostic test. `generated` is
// always true for commands our encoder emitted; `confirmed` is only true when
// the printer/service verified the command — a virtual printer cannot verify
// physical paper output, so the UI keeps these distinctly labelled.

export interface CommandCheck {
  id: string;
  label: string;
  bytesEmitted: number;
  generated: boolean;
  confirmed: boolean;
}

export interface CommandDiagnosticResult {
  bytes: Uint8Array;
  commands: CommandCheck[];
  totalBytes: number;
}

export function buildCommandDiagnosticBytes(opts: { paperWidth?: 58 | 80; drawerPin?: 2 | 5 } = {}): CommandDiagnosticResult {
  const width = widthFor(opts.paperWidth);
  const w = new EscposWriter();
  const commands: CommandCheck[] = [];
  const emit = (id: string, label: string, fn: () => void): void => {
    const before = w.length;
    fn();
    commands.push({ id, label, bytesEmitted: w.length - before, generated: true, confirmed: false });
  };

  emit('init', 'Initialize printer', () => w.init());
  emit('align_left', 'Left alignment', () => w.align(0));
  emit('align_center', 'Center alignment', () => w.align(1));
  emit('align_right', 'Right alignment', () => w.align(2));
  emit('bold_on', 'Bold ON', () => w.bold(true));
  emit('bold_off', 'Bold OFF', () => w.bold(false));
  emit('text_normal', 'Normal text', () => w.text('The quick brown fox jumps over the lazy dog').lineFeed());
  emit('font_size', 'Font size (2x)', () => w.size(1, 1).text('DOUBLE SIZE').lineFeed().size(0, 0));
  emit('line_spacing', 'Line spacing', () => w.lineFeed(2));
  emit('feed', 'Feed (3 lines)', () => w.lineFeed(3));
  emit('separator', 'Horizontal separator', () => w.text('-'.repeat(24)).lineFeed());
  emit('barcode_code128', 'Barcode CODE128', () => w.barcodeCode128('SHEGA-2026'));
  emit('barcode_ean13', 'Barcode EAN-13', () => w.barcodeEan13('123456789012'));
  emit('qr_url', 'QR code (https://shega.example)', () => w.qr('https://shega.example', 4));
  emit('qr_et_receipt', 'QR code (Ethiopian receipt payload — placeholder)', () => w.qr('SHEGA-ET-RECEIPT-SAMPLE-2026', 4));
  emit('totals', 'Receipt totals line', () => w.bold(true).size(1, 1).column('TOTAL', '105.00', width).size(0, 0).bold(false));
  emit('cut', 'Cut command', () => w.cut(true));
  emit('drawer', `Cash drawer kick (pin ${opts.drawerPin ?? 2})`, () => w.openDrawer(opts.drawerPin ?? 2));

  return { bytes: w.toUint8Array(), commands, totalBytes: w.length };
}

// Sample receipt for the virtual printer — built with the exact same
// `buildReceiptBytes` used by production checkout.
export function buildSampleReceiptBytes(opts: { businessName?: string; paperWidth?: 58 | 80 } = {}): Uint8Array {
  const lines: ReceiptLine[] = [
    { name: 'Biscuit 50g', quantity: 2, unitPrice: 25, total: 50 },
    { name: 'Water 1L', quantity: 1, unitPrice: 20, total: 20 },
    { name: 'Bread', quantity: 1, unitPrice: 35, total: 35 },
  ];
  return buildReceiptBytes(
    {
      businessName: opts.businessName || 'SHEGA',
      businessDetails: 'SAMPLE RECEIPT',
      orderId: 'SAMPLE-001',
      dateTime: new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      cashier: 'Test',
    },
    {
      lines,
      subtotal: 105,
      discount: 0,
      vat: 10,
      total: 115,
      paid: 120,
      change: 5,
      paymentMethod: 'CASH',
      qr: 'https://shega.example',
      paperWidth: opts.paperWidth,
    },
  );
}

export function buildSampleReceiptPreview(opts: { businessName?: string; paperWidth?: 58 | 80 } = {}): string {
  const width = widthFor(opts.paperWidth);
  const lines: string[] = [];
  lines.push(opts.businessName || 'SHEGA');
  lines.push('SAMPLE RECEIPT');
  lines.push(rule(width));
  lines.push('Order       SAMPLE-001');
  lines.push('Date        ' + new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
  lines.push('Cashier     Test');
  lines.push('Biscuit 50g');
  lines.push('2 x 25.00  50.00');
  lines.push('Water 1L');
  lines.push('1 x 20.00  20.00');
  lines.push('Bread');
  lines.push('1 x 35.00  35.00');
  lines.push(rule(width));
  lines.push('SUB TOTAL   105.00');
  lines.push('VAT         10.00');
  lines.push('TOTAL       115.00');
  lines.push('Paid        120.00');
  lines.push('Change      5.00');
  lines.push('Method      CASH');
  lines.push(rule(width));
  lines.push('*** THANK YOU ***');
  return lines.join('\n');
}
// ============================================
// Barcode label printing (shelf/price labels)
// ============================================

export interface LabelBytesOptions {
  name: string;
  barcode?: string | null;
  sku?: string | null;
  price: number;
  businessName?: string;
  copies?: number;
  /** 'ean13' uses the printer's native EAN-13 encoder; anything else falls back to CODE128. */
  barcodeType?: 'ean13' | 'code128';
}

/** Build ESC/POS bytes for one or more barcode labels. */
export function buildLabelBytes(opts: LabelBytesOptions): Uint8Array {
  const w = new EscposWriter();
  const copies = Math.max(1, Math.min(50, opts.copies ?? 1));
  const code = (opts.barcode || opts.sku || '').trim();

  for (let i = 0; i < copies; i++) {
    w.init().codePage(0);
    if (opts.businessName) w.align(1).text(truncate(opts.businessName, widthFor(58))).lineFeed();
    w.align(1).bold(true).text(truncate(opts.name || 'Product', 32)).lineFeed().bold(false);
    if (code) {
      const fmt = detectBarcodeFormat(code);
      try {
        if (opts.barcodeType === 'code128' || fmt.escposType === 4) w.barcode(4, code.slice(0, 40));
        else w.barcode(fmt.escposType as 0 | 2 | 3, code);
      } catch {
        // barcode is a nicety; keep printing the rest of the label
      }
      w.align(1).text(code.slice(0, 24)).lineFeed();
    }
    if (opts.sku && opts.sku !== code) w.align(1).text(truncate(`SKU ${opts.sku}`, 24)).lineFeed();
    w.align(1).bold(true).text(`${money(opts.price)} ETB`).lineFeed().bold(false);
    w.lineFeed(2);
  }
  w.cut(true);
  return w.toUint8Array();
}

/** Plain-text preview of what the label would print. */
export function buildLabelPreview(opts: LabelBytesOptions): string {
  const lines: string[] = [];
  const code = (opts.barcode || opts.sku || '').trim();
  if (opts.businessName) lines.push(opts.businessName);
  lines.push(opts.name || 'Product');
  if (code) {
    lines.push(`||| ${detectBarcodeFormat(code).format} |||`);
    lines.push(code);
  }
  if (opts.sku && opts.sku !== code) lines.push(`SKU ${opts.sku}`);
  lines.push(`${money(opts.price)} ETB`);
  return lines.join('\n');
}
