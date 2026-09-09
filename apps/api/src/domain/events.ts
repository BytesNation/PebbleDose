import type { DoseStatus } from '@family/shared';
export interface DomainEvent {
  type: 'DoseTaken' | 'DoseChanged';
  doseId: string;
  actor: string;
  at: string;
  status: DoseStatus;
}
export class EventBus {
  private handlers: ((event: DomainEvent) => void)[] = [];
  private committedHandlers: ((event: DomainEvent) => void)[] = [];
  subscribe(handler: (event: DomainEvent) => void) {
    this.handlers.push(handler);
  }
  afterCommit(handler: (event: DomainEvent) => void) {
    this.committedHandlers.push(handler);
  }
  emit(event: DomainEvent) {
    for (const handler of this.handlers) handler(event);
  }
  committed(event: DomainEvent) {
    for (const handler of this.committedHandlers) handler(event);
  }
}
