import { eq } from 'drizzle-orm';
import { asNeededUses, medications, type users } from '@family/database';
import type { FamilyService } from './service';
import { DomainError, requireValue } from '../errors';
export function recordAsNeeded(
  service: FamilyService,
  medicationId: string,
  input: { requestId: string; doseDisplay: string },
  actor: typeof users.$inferSelect | null,
) {
  return service.store.sqlite.transaction(() => {
    const { db } = service.store;
    const medication = requireValue(
      db
        .select()
        .from(medications)
        .where(eq(medications.id, medicationId))
        .get(),
    );
    const user = service.user(medication.userId);
    if (
      !user.active ||
      !medication.active ||
      medication.usageType !== 'AS_NEEDED'
    )
      throw new DomainError(409, 'This as-needed medication is unavailable');
    if (
      user.kioskPinRequired &&
      actor?.id !== user.id &&
      actor?.role !== 'ADULT'
    )
      throw new DomainError(401, 'Unlock this profile first');
    if (medication.requiresSupervision && actor?.role !== 'ADULT')
      throw new DomainError(403, 'An adult must confirm this use');
    const existing = db
      .select()
      .from(asNeededUses)
      .where(eq(asNeededUses.id, input.requestId))
      .get();
    if (existing) {
      if (
        existing.medicationId !== medicationId ||
        existing.doseDisplay !== input.doseDisplay
      )
        throw new DomainError(
          409,
          'This request was already used for a different record',
        );
      return {
        id: existing.id,
        usedAt: existing.usedAt,
        alreadyRecorded: true,
      };
    }
    const at = service.now();
    db.insert(asNeededUses)
      .values({
        id: input.requestId,
        medicationId,
        userId: user.id,
        usedAt: at,
        displayName: medication.privacyMode
          ? medication.displayName
          : medication.name,
        doseDisplay: input.doseDisplay,
        confirmedByUserId: actor?.id ?? null,
        confirmationType: actor?.role === 'ADULT' ? 'PARENT' : 'SELF',
      })
      .run();
    service.audit.record(
      actor?.id ?? `kiosk:${user.id}`,
      'As-needed use recorded',
      input.requestId,
      at,
    );
    return { id: input.requestId, usedAt: at, alreadyRecorded: false };
  })();
}
