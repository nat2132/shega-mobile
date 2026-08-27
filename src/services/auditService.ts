import { auditLog, verifyAuditChain, getAuditLogs } from '@/database/db';

// Tamper-evident audit trail (Phase 4.3). The insert + verify live in db.ts so
// the write layer can call auditLog() without a circular import; this module
// re-exports them for the UI.

export { auditLog, verifyAuditChain, getAuditLogs };