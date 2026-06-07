// WhatsApp Business notification hook (future / premium feature)
// Stub contract for sending business updates via WhatsApp Business API.

export interface WhatsAppMessage {
  recipient: string; // phone number with country code
  body: string;
  templateName?: string; // e.g. 'low_stock_alert'
  variables?: Record<string, string>;
}

export const sendWhatsAppMessage = async (msg: WhatsAppMessage): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    // TODO: integrate with WhatsApp Business API
    console.log('[whatsapp] Would send to', msg.recipient, msg.body);
    return { success: true, id: `wa-${Date.now()}` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unknown error' };
  }
};

export const sendDailySalesSummary = (recipient: string, data: { total: number; date: string }) =>
  sendWhatsAppMessage({
    recipient,
    body: `Today's Sales (${data.date}): ${data.total.toLocaleString()} Birr`,
    templateName: 'daily_sales_summary',
    variables: { total: String(data.total), date: data.date },
  });

export const sendLowStockAlert = (recipient: string, data: { item: string; qty: number }) =>
  sendWhatsAppMessage({
    recipient,
    body: `Low Stock Alert: ${data.item} - only ${data.qty} units remaining.`,
    templateName: 'low_stock_alert',
    variables: { item: data.item, qty: String(data.qty) },
  });

export const sendPaymentReminder = (recipient: string, data: { customer: string; amount: number }) =>
  sendWhatsAppMessage({
    recipient,
    body: `Payment Reminder: ${data.customer} owes ${data.amount.toLocaleString()} Birr.`,
    templateName: 'payment_reminder',
    variables: { customer: data.customer, amount: String(data.amount) },
  });

export const sendPerformanceSummary = (recipient: string, data: { revenue: number; profit: number }) =>
  sendWhatsAppMessage({
    recipient,
    body: `Business Update: Revenue ${data.revenue.toLocaleString()} Birr, Profit ${data.profit.toLocaleString()} Birr.`,
    templateName: 'performance_summary',
    variables: { revenue: String(data.revenue), profit: String(data.profit) },
  });
