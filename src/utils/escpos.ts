// ESC/POS command encoder — pure, dependency-free, works on Node and React Native.
// Builds byte streams for thermal printers (Epson TM, Star, Bixolon, generic 58/80mm),
// cash drawers and pole displays. All output is an ASCII-safe byte sequence.
//
// Command reference (bytes):
//   ESC @                1B 40        initialize
//   LF                   0A           line feed
//   ESC d n              1B 64 n      print & feed n lines
//   ESC a n              1B 61 n      align 0=left 1=center 2=right
//   ESC E n              1B 45 n      bold off/on
//   GS ! n               1D 21 n      character size (bits 0-2 height, 4-6 width)
//   ESC t n              1B 74 n      select code page
//   GS k m n d..d 00     1D 6B ...    barcode
//   GS ( k ...           1D 28 6B ... QR code
//   GS v 0 m xL xH yL yH 1D 76 30 00  raster image
//   GS V B 0             1D 56 42 00  partial cut
//   GS V A 0             1D 56 41 00  full cut
//   ESC p m t1 t2        1B 70 00     cash drawer kick (pin 2), m=1 pin 5

export class EscposWriter {
  private bytes: number[] = [];

  raw(...b: number[]): this {
    this.bytes.push(...b);
    return this;
  }

  rawString(s: string): this {
    for (let i = 0; i < s.length; i++) this.bytes.push(s.charCodeAt(i) & 0xff);
    return this;
  }

  text(s: string): this {
    return this.rawString(s);
  }

  init(): this {
    return this.raw(0x1b, 0x40);
  }

  lineFeed(n: number = 1): this {
    return this.raw(0x0a).raw(0x1b, 0x64, Math.max(0, Math.min(255, n)));
  }

  align(n: 0 | 1 | 2): this {
    return this.raw(0x1b, 0x61, n);
  }

  bold(on: boolean): this {
    return this.raw(0x1b, 0x45, on ? 1 : 0);
  }

  size(width: number, height: number): this {
    const w = Math.max(0, Math.min(7, width));
    const h = Math.max(0, Math.min(7, height));
    return this.raw(0x1d, 0x21, (w << 4) | h);
  }

  underline(on: boolean): this {
    return this.raw(0x1b, 0x2d, on ? 1 : 0);
  }

  codePage(n: number): this {
    return this.raw(0x1b, 0x74, n);
  }

  // Line with label + value aligned to width via spaces.
  column(label: string, value: string, width: number): this {
    const line = `${label}${' '.repeat(Math.max(1, width - label.length - value.length))}${value}`;
    return this.text(line).lineFeed();
  }

  // Barcode: m = symbology (0 UPC-A, 2 EAN-13, 4 CODE128, 69 CODE93, 73 ITF).
  barcode(m: number, data: string): this {
    this.raw(0x1d, 0x6b, m, data.length).rawString(data).raw(0x00);
    return this.lineFeed();
  }

  // EAN-13 with automatic checksum handling. Data must be 12 or 13 digits.
  barcodeEan13(data: string): this {
    const digits = data.replace(/\D/g, '').slice(0, 13);
    if (digits.length < 12) throw new Error('EAN-13 requires at least 12 digits');
    const body = digits.length === 13 ? digits.slice(0, 12) : digits;
    const check = this.ean13CheckDigit(body);
    return this.barcode(2, body + String(check));
  }

  // CODE128 (best for internal SKUs).
  barcodeCode128(data: string): this {
    return this.barcode(4, data);
  }

  // QR code via the GS ( k sequence (model 2, sizes 1-16, EC level L).
  qr(data: string, moduleSize: number = 6, ecLevel: 0 | 1 | 2 | 3 = 0): this {
    const n = Math.max(1, Math.min(16, moduleSize));
    this.raw(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00); // model 2
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, n); // module size
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 48 + ecLevel); // EC
    const payload: number[] = [0x1d, 0x28, 0x6b, 0x00, 0x00, 0x31, 0x50, 0x30];
    for (let i = 0; i < data.length; i++) payload.push(data.charCodeAt(i) & 0xff);
    payload[3] = (payload.length - 4) & 0xff; // pL
    payload[4] = ((payload.length - 4) >> 8) & 0xff; // pH
    this.raw(...payload);
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30); // print
    return this.lineFeed();
  }

  // Raster image: 1-bit, one byte per 8 horizontal pixels, MSB first.
  raster(rows: Uint8Array, widthPx: number): this {
    const bytesPerRow = Math.ceil(widthPx / 8);
    const y = rows.length / bytesPerRow;
    if (y > 65535 || bytesPerRow > 65535) throw new Error('Raster dimensions out of range');
    this.raw(0x1d, 0x76, 0x30, 0x00);
    this.raw(bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff);
    this.raw(y & 0xff, (y >> 8) & 0xff);
    this.raw(...Array.from(rows));
    return this.lineFeed();
  }

  cut(partial: boolean = true): this {
    return this.raw(0x1d, 0x56, partial ? 0x42 : 0x41, 0x00);
  }

  // Cash drawer kick. pin: 2 (connector A) or 5 (connector B). t1/t2 in 2ms units.
  openDrawer(pin: 2 | 5 = 2, t1: number = 0x19, t2: number = 0xfa): this {
    return this.raw(0x1b, 0x70, pin === 5 ? 1 : 0, t1, t2);
  }

  private ean13CheckDigit(d12: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(d12[i], 10);
      sum += i % 2 === 0 ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  getBytes(): number[] {
    return this.bytes;
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  get length(): number {
    return this.bytes.length;
  }
}