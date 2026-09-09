import type { Action, DoseStatus } from '@family/shared';
import { DomainError } from '../errors';
export function nextStatus(
  status: DoseStatus,
  action: Action['action'],
  supervised: boolean,
  adult: boolean,
): DoseStatus {
  if (status === 'TAKEN' || status === 'SKIPPED')
    throw new DomainError(409, 'This dose is already finished');
  if (status === 'MISSED' && !adult)
    throw new DomainError(403, 'An adult must update a missed dose');
  if (action === 'SKIP') {
    if (!adult) throw new DomainError(403, 'An adult must skip a dose');
    return 'SKIPPED';
  }
  if (action === 'SNOOZE') {
    if (status === 'AWAITING_SUPERVISION' && !adult)
      throw new DomainError(409, 'Waiting for an adult');
    return 'SNOOZED';
  }
  if (action === 'READY') {
    if (!supervised)
      throw new DomainError(409, 'This dose does not require supervision');
    return 'AWAITING_SUPERVISION';
  }
  if (action === 'CONFIRM') {
    if (!adult) throw new DomainError(403, 'Adult confirmation required');
    if (status !== 'AWAITING_SUPERVISION')
      throw new DomainError(409, 'No confirmation is pending');
    return 'TAKEN';
  }
  if (supervised && !adult)
    throw new DomainError(403, 'Adult confirmation required');
  return 'TAKEN';
}
