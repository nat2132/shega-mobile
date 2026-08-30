// Turn a committed sale batch into a printable receipt payload.
// The sale is looked up from the local database by its batch id.

import { getSaleWithItemsById } from '@/database/db';
import type { PrinterMeta, ReceiptLayoutOptions } from './escpos';

export interface SaleReceiptInput {
  transactionId: string;
  businessName: string;
  businessDetails?: string;
  cashier: string;
  paymentMethod: string;
  totalPrice: number;
  paidAmount?: number;
  customerName?: string;
}

export interface SaleReceiptPayload {
  meta: PrinterMeta;
  layout: ReceiptLayoutOptions;
}

export function saleReceiptFromBatch(input: SaleReceiptInput): SaleReceiptPayload | null {
  let sale: any = null;
  try {
    sale = getSaleWithItemsById(input.transactionId);
  } catch {
    sale = null;
  }
  if (!sale) return null;

  const lines: ReceiptLayoutOptions['lines'] = (sale.items || []).map((it: any) => ({
    name: it.itemName || `Item #${it.itemId}`,
    quantity: Number(it.quantity) || 0,
    unitLabel: it.unit || it.baseUnit,
    unitPrice: (Number(it.totalPrice) || 0) / Math.max(1, Number(it.quantity) || 1),
    total: Number(it.totalPrice) || 0,
  }));

  if (lines.length === 0) {
    lines.push({
      name: input.customerName ? `Sale - ${input.customerName}` : 'Sale',
      quantity: 1,
      unitPrice: input.totalPrice,
      total: input.totalPrice,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const total = Number(input.totalPrice) || subtotal;
  const discount = subtotal > total ? subtotal - total : 0;
  const paid = Number(input.paidAmount) || total;
  const change = paid > total ? paid - total : 0;

  const meta: PrinterMeta = {
    businessName: input.businessName || 'Business',
    businessDetails: input.businessDetails,
    orderId: input.transactionId,
    dateTime: new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    cashier: input.cashier || '-',
  };

  const layout: ReceiptLayoutOptions = {
    lines,
    subtotal,
    discount,
    vat: 0,
    total,
    paid,
    change,
    paymentMethod: input.paymentMethod,
    qr: input.transactionId,
    footer: input.customerName ? `Customer: ${input.customerName}` : undefined,
    paperWidth: 58,
  };

  return { meta, layout };
}