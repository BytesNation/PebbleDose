import { randomUUID } from 'node:crypto';
import { auditEvents, type Store } from '@family/database';
export class AuditService {
  constructor(private store: Store) {}
  record(
    actor: string,
    action: string,
    target: string,
    timestamp: string,
    metadata: Record<string, unknown> = {},
  ) {
    this.store.db
      .insert(auditEvents)
      .values({
        id: randomUUID(),
        actor,
        action,
        target,
        timestamp,
        metadata: JSON.stringify(metadata),
      })
      .run();
  }
}
