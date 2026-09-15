import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform} from 'react-native';
import { pdfTranslations } from './pdf-translations';
import { formatNumber } from '@/utils/formatNumber';
import { toEthiopianDate } from '@/utils/date-utils';
// Shega brand logo embedded as base64 for PDF stamping
const SHEGA_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAAs+0lEQVR4nO3dv4srbZYYYPUiB53Vhh2YrmU6M+arNpMY1ntr/oKtBoPDW0PfvLVZTyRNZDsq/QEL0mTtSNeB47pLb7igyb1QWoxxslB3YXG0UA6ua0aj6R+qUpVK3f08MPAFV9L7ltQM57znnHc0AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABN/D8/uKWNGQqOvgAAAABJRU5ErkJggg==';



// Common Premium styling for PDFs
const getCommonStyles = () => `
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 30px;
      color: #1F2937;
      background-color: #FFFFFF;
      line-height: 1.5;
    }
    /* â”€â”€ Shega Brand Stamp â”€â”€ */
    .shega-stamp {
      display: flex;
      justify-content: center;
      margin-bottom: 10px;
    }
    .shega-stamp img {
      width: 48px;
      height: 48px;
      border-radius: 10px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #E5E7EB;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .business-info {
      text-align: left;
    }
    .business-name {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 3px;
    }
    .business-sub {
      font-size: 12px;
      color: #6B7280;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 700;
      color: #2563EB;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .doc-date {
      font-size: 11px;
      color: #6B7280;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      background-color: #F9FAFB;
      border: 1px solid #F3F4F6;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 30px;
      font-size: 13px;
    }
    .info-column {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
    }
    .label {
      color: #6B7280;
      font-weight: 500;
    }
    .value {
      font-weight: 600;
      color: #111827;
    }
    .metrics-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .metric-card {
      background-color: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 15px;
      text-align: center;
    }
    .metric-val {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }
    .metric-lbl {
      font-size: 11px;
      color: #6B7280;
      text-transform: uppercase;
      font-weight: 500;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .items-table th {
      background-color: #F3F4F6;
      color: #374151;
      font-weight: 600;
      text-align: left;
      font-size: 12px;
      padding: 12px 16px;
      text-transform: uppercase;
      border-bottom: 2px solid #E5E7EB;
    }
    .items-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 13px;
      color: #4B5563;
    }
    .items-table tr:last-child td {
      border-bottom: 2px solid #D1D5DB;
    }
    .total-section {
      width: 40%;
      margin-left: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 14px;
      margin-bottom: 40px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    .grand-total {
      font-size: 18px;
      font-weight: 700;
      color: #2563EB;
      border-top: 2px solid #E5E7EB;
      padding-top: 10px;
      margin-top: 5px;
    }
    .footer {
      text-align: center;
      margin-top: 60px;
      font-size: 11px;
      color: #9CA3AF;
      border-top: 1px solid #E5E7EB;
      padding-top: 20px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-unpaid {
      background-color: #FEE2E2;
      color: #EF4444;
    }
    .status-paid {
      background-color: #D1FAE5;
      color: #10B981;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
`;

// Formats a date+time string for the receipt PDF. Respects the
// user's selected time system. We can't import from `@/utils/date-utils`
// (it would create a circular import via SettingsContext at runtime)
// so this is a small inline copy. The logic mirrors `formatTime` in
// `date-utils.ts`.
const formatReceiptDateTime = (
  isoOrSqlite: string,
  language: Lang,
  timeSystem: 'device' | 'ethiopian',
): string => {
  if (!isoOrSqlite) return '';
  let normalized = isoOrSqlite;
  if (!normalized.includes('T') && !normalized.includes('Z')) {
    normalized = normalized.replace(' ', 'T') + 'Z';
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '';
  let datePart: string;
  if (timeSystem === 'ethiopian') {
    const eth = toEthiopianDate(d);
    const months = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Magabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];
    const monthName = months[eth.month - 1] || '';
    datePart = `${monthName} ${eth.day}, ${eth.year}`;
  } else {
    const locale = language === 'am' ? 'am-ET' : 'en-US';
    datePart = d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  const minutesStr = String(d.getMinutes()).padStart(2, '0');
  let timePart: string;
  if (timeSystem === 'ethiopian') {
    const localHour = d.getHours();
    const ethHour24 = (localHour - 6 + 24) % 24;
    const ethHour12 = ethHour24 % 12 === 0 ? 12 : ethHour24 % 12;
    const isDay = localHour >= 6 && localHour < 18;
    const dayStr = language === 'am' ? 'á‰€áŠ•' : language === 'om' ? 'Guyyaa' : language === 'ti' ? 'á‹•áˆˆá‰µ' : 'Day';
    const nightStr = language === 'am' ? 'áˆ›á‰³' : language === 'om' ? 'Halkan' : language === 'ti' ? 'áˆˆá‹­á‰²' : 'Night';
    timePart = `${ethHour12}:${minutesStr} ${isDay ? dayStr : nightStr}`;
  } else {
    const isPm = d.getHours() >= 12;
    const hour12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
    const am = language === 'am' ? 'áŒ¥á‹‹á‰µ' : 'AM';
    const pm = language === 'am' ? 'áŠ¨áˆ°á‹“á‰µ' : 'PM';
    timePart = `${hour12}:${minutesStr} ${isPm ? pm : am}`;
  }
  return `${datePart}, ${timePart}`;
};

// Generates a professional, searchable filename: e.g. "Sales_Receipt_2026-05-27_14-30"
const generateFilename = (title: string): string => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const time = `${hours}-${minutes}`;
  // Convert title to Title_Case_With_Underscores
  const cleanTitle = title
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '') // remove special chars
    .replace(/\s+/g, '_');           // spaces to underscores
  return `${cleanTitle}_${date}_${time}`;
};

const triggerShare = async (html: string, title: string, action: 'share' | 'save' = 'share') => {
  try {
    const { base64 } = await Print.printToFileAsync({ html, base64: true });
    const filename = generateFilename(title);
    // printToFileAsync writes to the host cache (unreadable in Expo Go / by
    // expo-sharing), so write the returned bytes into the app's own documents
    // directory and share from there.
    const shareUri = `${FileSystem.documentDirectory}${filename}.pdf`;
    await FileSystem.writeAsStringAsync(shareUri, base64 as string, { encoding: FileSystem.EncodingType.Base64 });

    if (action === 'save' && Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const createdUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          filename,
          'application/pdf'
        );
        const fileBase64 = await FileSystem.readAsStringAsync(shareUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(createdUri, fileBase64, { encoding: FileSystem.EncodingType.Base64 });
        return true;
      }
      return false; // Permission denied
    }

    if (Platform.OS === 'ios') {
      await Sharing.shareAsync(shareUri, { UTI: 'com.adobe.pdf' });
    } else {
      await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', dialogTitle: title });
    }
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
};

type Lang = 'en' | 'am' | 'om' | 'ti';

// 1. Sales Receipt PDF Generator
export const generateReceiptPDF = async (sale: any, business: any, language: Lang = 'en', action: 'share' | 'save' = 'share', timeSystem: 'device' | 'ethiopian' = 'device') => {
  const trans = pdfTranslations[language];
  const discount = sale.discount || 0;
  const vat = sale.vat || 0;
  const subtotal = sale.totalPrice || 0;

  const isBatch = sale.isBatch === true || (sale.items && sale.items.length > 0);
  const items = isBatch ? (sale.items || []) : [sale];

  const itemsHtml = items.map((item: any) => {
    const name = item.itemName || item.name || 'Item';
    const qty = item.quantity || 0;
    const unit = item.unit || item.baseUnit || 'pcs';
    const lineTotal = item.totalPrice || 0;
    const linePrice = qty > 0 ? lineTotal / qty : 0;
    const lineVat = item.vat || 0;
    const lineDiscount = item.discount || 0;
    return `
      <tr>
        <td>${name}</td>
        <td style="text-align: center;">${qty} ${unit}</td>
        <td style="text-align: right;">${formatNumber(linePrice)} ETB</td>
        <td style="text-align: right;">${formatNumber(lineTotal)} ETB</td>
      </tr>
      ${lineDiscount > 0 ? `<tr><td colspan="3" style="text-align: right; font-size: 11px; color: #EF4444;">${trans.receipt.discount}</td><td style="text-align: right; font-size: 11px; color: #EF4444;">- ${formatNumber(lineDiscount)} ETB</td></tr>` : ''}
      ${lineVat > 0 ? `<tr><td colspan="3" style="text-align: right; font-size: 11px; color: #6B7280;">${trans.receipt.vat} (${lineVat}%)</td><td style="text-align: right; font-size: 11px; color: #6B7280;">+ ${formatNumber((lineTotal * lineVat) / 100)} ETB</td></tr>` : ''}
    `;
  }).join('');

  const grandTotal = subtotal - discount + ((subtotal - discount) * vat) / 100;

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header">
          <div class="business-info">
            <div class="business-name">${business?.businessName || trans.common?.shegaStore || 'Shega Store'}</div>
            <div class="business-sub">${business?.storeName || trans.common?.mainBranch || 'Main Branch'}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-title" style="color: #10B981;">${trans.receipt.title}</div>
            <div class="doc-date">${trans.receipt.date}: ${sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : ''}</div>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.receipt.receiptNo}:</span><span class="value">${sale.uuid?.substring(0, 8).toUpperCase() || sale.id}</span></div>
            <div class="info-row"><span class="label">${trans.receipt.date}:</span><span class="value">${formatReceiptDateTime(sale.createdAt, language, timeSystem)}</span></div>
          </div>
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.receipt.customer}:</span><span class="value">${sale.customerName || trans.common?.walkInCustomer || 'Walk-in Customer'}</span></div>
            <div class="info-row"><span class="label">${trans.receipt.payment}:</span><span class="value">${sale.paymentMethod || trans.common?.cash || 'Cash'}</span></div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>${trans.receipt.item}</th>
              <th style="text-align: center;">${trans.receipt.qty}</th>
              <th style="text-align: right;">${trans.receipt.price}</th>
              <th style="text-align: right;">${trans.receipt.total}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-row">
            <span class="label">${trans.receipt.subtotal}</span>
            <span class="value">${formatNumber(subtotal)} ETB</span>
          </div>
          ${discount > 0 ? `
          <div class="total-row" style="color: #EF4444;">
            <span class="label">${trans.receipt.discount}</span>
            <span class="value">- ${formatNumber(discount)} ETB</span>
          </div>` : ''}
          ${vat > 0 ? `
          <div class="total-row">
            <span class="label">${trans.receipt.vat} (${vat}%)</span>
            <span class="value">+ ${formatNumber((subtotal * vat) / 100)} ETB</span>
          </div>` : ''}
          <div class="total-row grand-total">
            <span>${trans.receipt.totalPaid}</span>
            <span>${formatNumber(grandTotal)} ETB</span>
          </div>
        </div>
        
        <div class="footer">
          ${trans.receipt.thanks}<br/>
          ${trans.receipt.powered}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, trans.receipt.title, action);
};

// 2. Low Stock Product Order PDF Generator
export const generateLowStockOrderPDF = async (items: any[], business: any, language: Lang = 'en', action: 'share' | 'save' = 'share', timeSystem: 'device' | 'ethiopian' = 'device') => {
  const trans = pdfTranslations[language];
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.companyName || 'General'}</td>
      <td style="text-align: center;">${item.totalBaseQuantity} ${item.baseUnit || 'pcs'}</td>
      <td style="text-align: center; font-weight: 700; color: #3B82F6;">${item.orderQty || 10} ${item.baseUnit || 'pcs'}</td>
      <td style="text-align: right;">${item.supplierPhone || 'N/A'}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header">
          <div class="business-info">
            <div class="business-name">${business?.businessName || 'Shega Store'}</div>
            <div class="business-sub">${business?.storeName || 'Main Branch'}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-title" style="color: #3B82F6;">${trans.order.title}</div>
            <div class="doc-date">${trans.order.date}: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.order.date}:</span><span class="value">${new Date().toLocaleDateString()}</span></div>
          </div>
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.order.supplier}:</span><span class="value">${trans.common?.multipleSuppliers || 'Multiple Restock Suppliers'}</span></div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>${trans.order.item}</th>
              <th>${trans.reports?.brandCompany || 'Brand / Company'}</th>
              <th style="text-align: center;">${trans.order.currentStock}</th>
              <th style="text-align: center;">${trans.order.orderQty}</th>
              <th style="text-align: right;">${trans.order.phone}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer">
          ${trans.order.thanks}<br/>
          ${trans.order.powered}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, trans.order.title, action);
};

// 2b. Supplier Product Order PDF Generator — a reviewable purchase order
// built from a supplier's linked products.
const escHtml = (value: any): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const generateSupplierOrderPDF = async (
  order: {
    orderNumber?: string;
    supplier?: { fullName?: string; companyName?: string; phone?: string; address?: string } | null;
    items: { name?: string; currentStock?: number; unit?: string; quantity: number; price: number }[];
    totalAmount?: number;
    notes?: string | null;
    createdAt?: string | null;
  },
  business: any,
  language: Lang = 'en',
  action: 'share' | 'save' = 'share',
  timeSystem: 'device' | 'ethiopian' = 'device'
) => {
  const trans = pdfTranslations[language];
  const so = trans.supplierOrder;
  const sup = order.supplier || {};

  const itemsHtml = (order.items || []).map((item) => {
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const lineTotal = qty * price;
    const unit = item.unit || 'pcs';
    return `
    <tr>
      <td>${escHtml(item.name || 'Product')}</td>
      <td style="text-align: center;">${formatNumber(qty)} ${escHtml(unit)}</td>
      <td style="text-align: right;">${formatNumber(price)} ${trans.common.etb}</td>
      <td style="text-align: right; font-weight: 600;">${formatNumber(lineTotal)} ${trans.common.etb}</td>
    </tr>`;
  }).join('');

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header" style="flex-direction: column; align-items: center; text-align: center;">
          <div class="business-info" style="text-align: center;">
            <div class="business-name" style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 3px;">${escHtml(business?.businessName || trans.common.shegaStore)}</div>
            <div class="business-sub">${escHtml(business?.storeName || trans.common.mainBranch)}</div>
          </div>
          <div class="doc-meta" style="text-align: center; margin-top: 8px;">
            <div class="doc-title" style="color: #3B82F6;">${escHtml(so.title)}</div>
            ${order.orderNumber
              ? `<div class="doc-date">${escHtml(so.orderNo)}: ${escHtml(order.orderNumber)}</div>`
              : `<div class="doc-date">${escHtml(so.date)}: ${escHtml(formatReceiptDateTime(order.createdAt || new Date().toISOString(), language, timeSystem))}</div>`}
          </div>
        </div>

        <div class="info-grid">
          <div class="info-column">
            <div class="info-row"><span class="label">${escHtml(so.supplier)}:</span><span class="value">${escHtml(sup.fullName || sup.companyName || '—')}</span></div>
            ${sup.companyName ? `<div class="info-row"><span class="label">${escHtml(trans.reports.brandCompany)}:</span><span class="value">${escHtml(sup.companyName)}</span></div>` : ''}
            ${sup.phone ? `<div class="info-row"><span class="label">${escHtml(so.phone)}:</span><span class="value">${escHtml(sup.phone)}</span></div>` : ''}
            ${sup.address ? `<div class="info-row"><span class="label">${escHtml(so.address)}:</span><span class="value">${escHtml(sup.address)}</span></div>` : ''}
          </div>
          <div class="info-column">
            <div class="info-row"><span class="label">${escHtml(so.date)}:</span><span class="value">${escHtml(formatReceiptDateTime(order.createdAt || new Date().toISOString(), language, timeSystem))}</span></div>
            <div class="info-row"><span class="label">${escHtml(trans.reports.itemCount)}:</span><span class="value">${(order.items || []).length}</span></div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>${escHtml(so.item)}</th>
              <th style="text-align: center;">${escHtml(so.orderQty)}</th>
              <th style="text-align: right;">${escHtml(so.unitPrice)}</th>
              <th style="text-align: right;">${escHtml(so.lineTotal)}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span class="label">${escHtml(so.total)}</span>
            <span class="grand-total">${formatNumber(order.totalAmount || 0)} ${trans.common.etb}</span>
          </div>
        </div>

        ${order.notes ? `<div class="info-grid" style="margin-bottom: 20px;"><div class="info-column"><div class="info-row"><span class="label">${escHtml(so.notes)}:</span><span class="value">${escHtml(order.notes)}</span></div></div></div>` : ''}

        <div class="footer">
          ${escHtml(so.thanks)}<br/>
          ${escHtml(so.powered)}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, `${so.title}_${order.orderNumber || 'Order'}`, action);
};

// 3. Customer Debt Invoice PDF Generator
export const generateInvoicePDF = async (customer: any, debtSales: any[], business: any, language: Lang = 'en', action: 'share' | 'save' = 'share', timeSystem: 'device' | 'ethiopian' = 'device') => {
  const trans = pdfTranslations[language];
  const totalOwed = customer.oweAmount || customer.totalOwed || debtSales.reduce((acc, curr) => acc + (curr.totalPrice - (curr.paidAmount || 0)), 0);
  
  const itemsHtml = debtSales.map(sale => `
    <tr>
      <td>${sale.itemName || 'Product'}</td>
      <td style="text-align: center;">${sale.quantity}</td>
      <td style="text-align: right;">${formatReceiptDateTime(sale.createdAt, language, timeSystem)}</td>
      <td style="text-align: right;">${formatNumber(sale.totalPrice)} ETB</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header">
          <div class="business-info">
            <div class="business-name">${business?.businessName || 'Shega Store'}</div>
            <div class="business-sub">${business?.storeName || 'Main Branch'}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-title" style="color: #EF4444;">${trans.invoice.title}</div>
            <div class="doc-date">${trans.invoice.date}: ${timeSystem === 'ethiopian' ? new Date().toLocaleDateString() : new Date().toLocaleDateString()}</div>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.invoice.customer}:</span><span class="value">${customer.customerName}</span></div>
            <div class="info-row"><span class="label">${trans.invoice.phone}:</span><span class="value">${customer.customerPhone || 'N/A'}</span></div>
          </div>
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.invoice.status}:</span><span class="status-badge status-unpaid">${trans.invoice.unpaid}</span></div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>${trans.invoice.item}</th>
              <th style="text-align: center;">${trans.invoice.qty}</th>
              <th style="text-align: right;">${trans.invoice.boughtDate}</th>
              <th style="text-align: right;">${trans.invoice.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-row grand-total" style="color: #EF4444;">
            <span>${trans.invoice.outstanding}</span>
            <span>${formatNumber(totalOwed)} ETB</span>
          </div>
        </div>
        
        <div class="footer">
          ${trans.invoice.settle}<br/>
          ${trans.invoice.powered}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, trans.invoice.title, action);
};

// 4. Sales Report PDF Generator
export const generateSalesReportPDF = async (sales: any[], period: string, dateRange: string, business: any, language: Lang = 'en', action: 'share' | 'save' = 'share', timeSystem: 'device' | 'ethiopian' = 'device') => {
  const trans = pdfTranslations[language];
  const totalVolume = sales.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalRevenue = sales.reduce((acc, curr) => acc + curr.totalPrice, 0);

  const itemsHtml = sales.map(sale => `
    <tr>
      <td>${new Date(sale.createdAt).toLocaleDateString()}</td>
      <td>${sale.itemName || 'Product'}</td>
      <td style="text-align: center;">${sale.quantity} ${sale.unit || 'pcs'}</td>
      <td style="text-align: center;">${sale.paymentMethod || 'Cash'}</td>
      <td style="text-align: right;">${formatNumber(sale.totalPrice)} ETB</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header">
          <div class="business-info">
            <div class="business-name">${business?.businessName || 'Shega Store'}</div>
            <div class="business-sub">${business?.storeName || 'Main Branch'}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-title">${trans.reports.salesTitle}</div>
            <div class="doc-date">${trans.reports.dateGenerated}: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.reports.period}:</span><span class="value">${period} (${dateRange})</span></div>
          </div>
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.reports.valuation}:</span><span class="value">${trans.reports.activeTracking}</span></div>
          </div>
        </div>

        <div class="metrics-row">
          <div class="metric-card">
            <div class="metric-val" style="color: #2563EB;">${sales.length}</div>
            <div class="metric-lbl">${trans.reports.totalOrders}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val" style="color: #10B981;">${formatNumber(totalVolume)}</div>
            <div class="metric-lbl">${trans.reports.volumeSold}</div>
          </div>
          <div class="metric-card" style="grid-column: span 2;">
            <div class="metric-val" style="color: #2563EB; font-size: 22px;">${formatNumber(totalRevenue)} ETB</div>
            <div class="metric-lbl">${trans.reports.inflow}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>${trans.reports.date}</th>
              <th>${trans.reports.itemName}</th>
              <th style="text-align: center;">${trans.reports.quantity}</th>
              <th style="text-align: center;">${trans.reports.payment}</th>
              <th style="text-align: right;">${trans.reports.revenue}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer">
          ${trans.reports.powered}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, trans.reports.salesTitle, action);
};

// 5. Stock Report PDF Generator
export const generateStockReportPDF = async (items: any[], period: string, dateRange: string, business: any, language: Lang = 'en', action: 'share' | 'save' = 'share', timeSystem: 'device' | 'ethiopian' = 'device') => {
  const trans = pdfTranslations[language];
  const totalAssets = items.length;
  const totalStockQty = items.reduce((acc, curr) => acc + (curr.totalBaseQuantity || 0), 0);
  const totalValuation = items.reduce((acc, curr) => acc + ((curr.totalBaseQuantity || 0) * (curr.basePurchasePrice || 0)), 0);
  const lowStockCount = items.filter(item => (item.totalBaseQuantity || 0) < 10).length;

  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.categoryName || 'General'}</td>
      <td style="text-align: center; ${item.totalBaseQuantity < 10 ? 'color: #EF4444; font-weight: 700;' : ''}">
        ${item.totalBaseQuantity} ${item.baseUnit || 'pcs'}
      </td>
      <td style="text-align: right;">${formatNumber(item.basePurchasePrice || 0)} ETB</td>
      <td style="text-align: right;">${formatNumber(item.baseSellingPrice || 0)} ETB</td>
      <td style="text-align: right; font-weight: 600;">${formatNumber((item.totalBaseQuantity || 0) * (item.basePurchasePrice || 0))} ETB</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header">
          <div class="business-info">
            <div class="business-name">${business?.businessName || 'Shega Store'}</div>
            <div class="business-sub">${business?.storeName || 'Main Branch'}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-title">${trans.reports.stockTitle}</div>
            <div class="doc-date">${trans.reports.dateGenerated}: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.reports.period}:</span><span class="value">${period} (${dateRange})</span></div>
          </div>
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.reports.health}:</span><span class="value" style="color: #10B981; font-weight: 700;">${trans.reports.optimal}</span></div>
          </div>
        </div>

        <div class="metrics-row">
          <div class="metric-card">
            <div class="metric-val">${totalAssets}</div>
            <div class="metric-lbl">${trans.reports.assets}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">${formatNumber(totalStockQty)}</div>
            <div class="metric-lbl">${trans.reports.itemCount}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val" style="color: #EF4444;">${lowStockCount}</div>
            <div class="metric-lbl">${trans.reports.lowStock}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val" style="color: #10B981; font-size: 16px;">${formatNumber(totalValuation)} ETB</div>
            <div class="metric-lbl">${trans.reports.valuation}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>${trans.reports.itemName}</th>
              <th>${trans.reports.category}</th>
              <th style="text-align: center;">${trans.reports.stockLevel}</th>
              <th style="text-align: right;">${trans.reports.purchasePrice}</th>
              <th style="text-align: right;">${trans.reports.sellingPrice}</th>
              <th style="text-align: right;">${trans.reports.valuation}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer">
          ${trans.reports.powered}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, trans.reports.stockTitle, action);
};

// 6. Product List PDF Generator
export const generateProductListPDF = async (items: any[], business: any, language: Lang = 'en', action: 'share' | 'save' = 'share', timeSystem: 'device' | 'ethiopian' = 'device') => {
  const trans = pdfTranslations[language];
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.id}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.companyName || 'General'}</td>
      <td>${item.categoryName || 'General'}</td>
      <td style="text-align: right;">${formatNumber(item.basePurchasePrice || 0)} ETB</td>
      <td style="text-align: right; color: #2563EB; font-weight: 600;">${formatNumber(item.baseSellingPrice || 0)} ETB</td>
      <td style="text-align: right;">${item.totalBaseQuantity} ${item.baseUnit || 'pcs'}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header">
          <div class="business-info">
            <div class="business-name">${business?.businessName || 'Shega Store'}</div>
            <div class="business-sub">${business?.storeName || 'Main Branch'}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-title">${trans.reports.productTitle}</div>
            <div class="doc-date">${trans.reports.dateGenerated}: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>${trans.reports.id}</th>
              <th>${trans.reports.productName}</th>
              <th>${trans.reports.manufacturer}</th>
              <th>${trans.reports.category}</th>
              <th style="text-align: right;">${trans.reports.purchaseCost}</th>
              <th style="text-align: right;">${trans.reports.sellingPrice}</th>
              <th style="text-align: right;">${trans.reports.totalQty}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer">
          ${trans.reports.powered}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, trans.reports.productTitle, action);
};

// 8. Profit & Loss Report PDF Generator
export const generateProfitAndLossReportPDF = async (plData: any, period: string, dateRange: string, business: any, language: Lang = 'en', action: 'share' | 'save' = 'share', timeSystem: 'device' | 'ethiopian' = 'device') => {
  const trans = pdfTranslations[language];
  const grossProfit = plData.revenue - plData.cogs;
  const netProfit = grossProfit;
  const isProfit = netProfit >= 0;

  const html = `
    <html>
      <head>
        ${getCommonStyles()}
        <style>
          .pl-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 15px;
          }
          .pl-table td {
            padding: 16px 20px;
            border-bottom: 1px dashed #E5E7EB;
          }
          .pl-section-head {
            font-weight: 700;
            color: #111827;
            font-size: 16px;
            background-color: #F9FAFB;
            border-bottom: 2px solid #E5E7EB !important;
          }
          .pl-subtotal {
            font-weight: 600;
            color: #374151;
            padding-left: 40px !important;
          }
          .pl-total {
            font-weight: 700;
            font-size: 18px;
            background-color: #F3F4F6;
            border-top: 2px solid #D1D5DB;
            border-bottom: 2px solid #D1D5DB !important;
          }
        </style>
      </head>
      <body>
        <div class="shega-stamp">
          <img src="${SHEGA_LOGO}" alt="Shega" />
        </div>
        <div class="header">
          <div class="business-info">
            <div class="business-name">${business?.businessName || 'Shega Store'}</div>
            <div class="business-sub">${business?.storeName || 'Main Branch'}</div>
          </div>
          <div class="doc-meta">
            <div class="doc-title" style="color: ${isProfit ? '#10B981' : '#EF4444'};">${trans.reports.plTitle}</div>
            <div class="doc-date">${trans.reports.dateGenerated}: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="info-grid" style="margin-bottom: 40px;">
          <div class="info-column">
            <div class="info-row"><span class="label">${trans.reports.period}:</span><span class="value">${period} (${dateRange})</span></div>
          </div>
          <div class="info-column">
            <div class="info-row">
              <span class="label">${isProfit ? trans.reports.netProfit : trans.reports.netLoss}:</span>
              <span class="value" style="color: ${isProfit ? '#10B981' : '#EF4444'}; font-weight: 700;">${formatNumber(netProfit)} ETB</span>
            </div>
          </div>
        </div>

        <table class="pl-table">
          <tbody>
            <!-- REVENUE SECTION -->
            <tr class="pl-section-head">
              <td>1. ${trans.reports.revenue}</td>
              <td style="text-align: right;"></td>
            </tr>
            <tr>
              <td class="pl-subtotal">${trans.reports.grossSalesInflow}</td>
              <td style="text-align: right; color: #10B981; font-weight: 600;">+ ${formatNumber(plData.revenue)} ETB</td>
            </tr>
            
            <!-- COGS SECTION -->
            <tr class="pl-section-head">
              <td>2. ${trans.reports.cost}</td>
              <td style="text-align: right;"></td>
            </tr>
            <tr>
              <td class="pl-subtotal">${trans.reports.directCost}</td>
              <td style="text-align: right; color: #EF4444;">- ${formatNumber(plData.cogs)} ETB</td>
            </tr>

            <!-- GROSS PROFIT -->
            <tr class="pl-total" style="background-color: #F9FAFB; color: #111827;">
              <td>${trans.reports.grossProfit}</td>
              <td style="text-align: right; color: #10B981;">${formatNumber(grossProfit)} ETB</td>
            </tr>

            <!-- NET INCOME -->
            <tr class="pl-total" style="color: ${isProfit ? '#10B981' : '#EF4444'}; background-color: #F3F4F6;">
              <td>${isProfit ? trans.reports.netProfit : trans.reports.netLoss}</td>
              <td style="text-align: right; font-weight: 800; font-size: 20px;">
                ${isProfit ? '+' : ''} ${formatNumber(netProfit)} ETB
              </td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          ${trans.reports.powered}
        </div>
      </body>
    </html>
  `;

  return triggerShare(html, trans.reports.plTitle, action);
};

// â”€â”€â”€ CSV / Excel Export Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const escapeCSV = (val: any): string => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};

const rowToCSV = (row: any[]): string => row.map(escapeCSV).join(',');

const buildCSVString = (headers: string[], rows: any[][]): string =>
  [headers.map(escapeCSV).join(','), ...rows.map(rowToCSV)].join('\n');

const shareCSV = async (csv: string, filename: string, action: 'share' | 'save' = 'share') => {
  try {
    const dest = `${FileSystem.cacheDirectory}${filename}_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (action === 'save' && Platform.OS === 'android') {
      const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (perms.granted) {
        const base64 = await FileSystem.readAsStringAsync(dest, { encoding: FileSystem.EncodingType.Base64 });
        const createdUri = await FileSystem.StorageAccessFramework.createFileAsync(perms.directoryUri, filename + '.csv', 'text/csv');
        await FileSystem.writeAsStringAsync(createdUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        return true;
      }
    }
    await Sharing.shareAsync(dest, { mimeType: 'text/csv', dialogTitle: filename });
    return true;
  } catch (e) {
    console.error('CSV export error:', e);
    return false;
  }
};

// 9. Sales Report CSV
export const exportSalesReportCSV = async (sales: any[], action: 'share' | 'save' = 'share') => {
  const headers = ['Date', 'Item Name', 'Quantity', 'Unit', 'Payment Method', 'Payment Status', 'Customer', 'Total (ETB)'];
  const rows = sales.map(s => [
    s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
    s.itemName || '', s.quantity || 0, s.unit || 'pcs',
    s.paymentMethod || 'Cash', s.paymentStatus || '',
    s.customerName || '', s.totalPrice || 0,
  ]);
  return shareCSV(buildCSVString(headers, rows), 'Sales_Report', action);
};

// 10. Stock Report CSV
export const exportStockReportCSV = async (items: any[], action: 'share' | 'save' = 'share') => {
  const headers = ['Item Name', 'Category', 'Stock Qty', 'Unit', 'Purchase Price (ETB)', 'Selling Price (ETB)', 'Valuation (ETB)', 'Company'];
  const rows = items.map(i => [
    i.name || '', i.categoryName || 'General',
    i.totalBaseQuantity || 0, i.baseUnit || 'pcs',
    i.basePurchasePrice || 0, i.baseSellingPrice || 0,
    (i.totalBaseQuantity || 0) * (i.basePurchasePrice || 0),
    i.companyName || '',
  ]);
  return shareCSV(buildCSVString(headers, rows), 'Stock_Report', action);
};

// 12. P&L Report CSV
export const exportPLReportCSV = async (plData: { revenue: number; cogs: number }, action: 'share' | 'save' = 'share') => {
  const grossProfit = plData.revenue - plData.cogs;
  const netProfit = grossProfit;
  const headers = ['Line Item', 'Amount (ETB)'];
  const rows = [
    ['1. Revenue', plData.revenue],
    ['  Gross Sales Inflow', plData.revenue],
    ['2. Cost of Goods Sold (COGS)', plData.cogs],
    ['  Direct Cost of Inventory Sold', plData.cogs],
    ['Gross Profit', grossProfit],
    [netProfit >= 0 ? 'Net Profit' : 'Net Loss', netProfit],
  ];
  return shareCSV(buildCSVString(headers, rows), 'Profit_Loss_Report', action);
};

// 13. Product Catalog CSV
export const exportProductCatalogCSV = async (items: any[], action: 'share' | 'save' = 'share') => {
  const headers = ['ID', 'Product Name', 'Category', 'Manufacturer', 'Purchase Price (ETB)', 'Selling Price (ETB)', 'Stock Qty', 'Unit'];
  const rows = items.map(i => [
    i.id || '', i.name || '',
    i.categoryName || 'General', i.companyName || '',
    i.basePurchasePrice || 0, i.baseSellingPrice || 0,
    i.totalBaseQuantity || 0, i.baseUnit || 'pcs',
  ]);
  return shareCSV(buildCSVString(headers, rows), 'Product_Catalog', action);
};