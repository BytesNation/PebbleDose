export interface RewardProvider {
  addPoints(
    externalUserId: string,
    points: number,
    reason: string,
  ): Promise<void>;
}
export interface CalendarEvent {
  title: string;
  startsAt: string;
  endsAt?: string;
}
export interface CalendarProvider {
  createEvent(event: CalendarEvent): Promise<void>;
}
export interface Notification {
  type:
    | 'MedicationDue'
    | 'MedicationOverdue'
    | 'ParentConfirmationRequired'
    | 'MedicationCompleted'
    | 'DailyMedicationComplete';
  userId: string;
  createdAt: string;
}
export interface NotificationProvider {
  send(notification: Notification): Promise<void>;
}
export class LocalNotificationProvider implements NotificationProvider {
  readonly alerts: Notification[] = [];
  async send(notification: Notification) {
    this.alerts.push(notification);
    if (this.alerts.length > 100) this.alerts.shift();
  }
}
export class LocalRewardProvider implements RewardProvider {
  constructor(
    private readonly credit: (
      userId: string,
      points: number,
      reason: string,
    ) => void,
  ) {}
  async addPoints(userId: string, points: number, reason: string) {
    this.credit(userId, points, reason);
  }
}
