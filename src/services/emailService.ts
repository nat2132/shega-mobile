// Email notification hook (future feature)
// This is a stub that documents the contract for sending business reports via email.
// In production it would call a backend SMTP/API service; here we expose the
// intent and log it for now.

export interface EmailReport {
  recipient: string;
  subject: string;
  body: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'backup' | 'receipt' | 'performance';
  attachData?: any;
}

export const sendEmailReport = async (report: EmailReport): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    // TODO: integrate with backend email service
    console.log('[email] Would send:', report.recipient, report.subject, report.reportType);
    return { success: true, id: `email-${Date.now()}` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Unknown error' };
  }
};

export const queueEmailReport = async (report: EmailReport) => {
  // Queue a report to be sent later (e.g. when network becomes available)
  return sendEmailReport(report);
};

export const sendDailySalesReport = (recipient: string, data: { date: string; total: number; items: number }) =>
  sendEmailReport({
    recipient,
    subject: `Daily Sales Report - ${data.date}`,
    body: `Total Sales: ${data.total} Birr\nItems Sold: ${data.items}`,
    reportType: 'daily',
  });

export const sendWeeklyReport = (recipient: string, data: { week: string; total: number }) =>
  sendEmailReport({
    recipient,
    subject: `Weekly Report - ${data.week}`,
    body: `Total: ${data.total} Birr`,
    reportType: 'weekly',
  });

export const sendMonthlyReport = (recipient: string, data: { month: string; total: number }) =>
  sendEmailReport({
    recipient,
    subject: `Monthly Report - ${data.month}`,
    body: `Total: ${data.total} Birr`,
    reportType: 'monthly',
  });
