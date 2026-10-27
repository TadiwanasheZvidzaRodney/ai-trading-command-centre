import type { Db } from 'mongodb';

export interface AuditEvent {
  action: string;
  actor: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

/** Best-effort audit write. An audit failure must not silently grant access. */
export async function writeAudit(db: Db | null, event: AuditEvent): Promise<boolean> {
  if (!db) return false;
  try {
    await db.collection('audit_logs').insertOne({
      ...event,
      metadata: event.metadata ?? {},
      createdAt: new Date(),
    });
    return true;
  } catch {
    return false;
  }
}
