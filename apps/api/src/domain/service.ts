import { randomUUID } from 'node:crypto';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  asNeededUses,
  households,
  users,
  medications,
  schedules,
  scheduleDays,
  doses,
  rewardSettings,
  rewardDefinitions,
  rewardEvents,
  auditEvents,
  devices,
  type Store,
} from '@family/database';
import { type z } from 'zod';
import {
  type setupSchema,
  type userUpdateSchema,
  type medicationSchema,
  type scheduleSchema,
  type Action,
  type Profile,
} from '@family/shared';
import { DomainError, requireValue } from '../errors';
import { hashPin } from './auth';
import { AuditService } from './audit';
import { Scheduler } from './scheduler';
import { RewardService } from './rewards';
import { EventBus, type DomainEvent } from './events';
import { LocalNotificationProvider } from '@family/integrations';
import { dayAt, streaks } from './time';
import { nextStatus } from './transitions';
export class FamilyService {
  readonly audit: AuditService;
  readonly scheduler: Scheduler;
  readonly rewards: RewardService;
  readonly events = new EventBus();
  readonly notifications = new LocalNotificationProvider();
  constructor(
    readonly store: Store,
    readonly now: () => string,
  ) {
    this.audit = new AuditService(store);
    this.scheduler = new Scheduler(store, now, this.audit);
    this.rewards = new RewardService(store);
    this.events.subscribe((e) => {
      if (e.type === 'DoseTaken') this.rewards.doseTaken(e.doseId, e.at);
    });
    this.events.subscribe((e) =>
      this.audit.record(
        e.actor,
        e.type === 'DoseTaken'
          ? 'Medication acknowledged as taken'
          : 'Dose changed',
        e.doseId,
        e.at,
      ),
    );
    this.events.afterCommit((event) => {
      const dose = requireValue(
        this.store.db
          .select()
          .from(doses)
          .where(eq(doses.id, event.doseId))
          .get(),
      );
      if (event.status === 'TAKEN') {
        void this.notifications.send({
          type: 'MedicationCompleted',
          userId: dose.userId,
          createdAt: event.at,
        });
        const records = this.todayDoses(dose.userId);
        if (records.length && records.every((d) => d.status === 'TAKEN'))
          void this.notifications.send({
            type: 'DailyMedicationComplete',
            userId: dose.userId,
            createdAt: event.at,
          });
      } else if (event.status === 'AWAITING_SUPERVISION')
        void this.notifications.send({
          type: 'ParentConfirmationRequired',
          userId: dose.userId,
          createdAt: event.at,
        });
    });
  }
  household() {
    return requireValue(
      this.store.db.select().from(households).get(),
      'Set up your household first',
    );
  }
  user(id: string) {
    return requireValue(
      this.store.db.select().from(users).where(eq(users.id, id)).get(),
    );
  }
  async setup(input: z.infer<typeof setupSchema>) {
    const pinHash = await hashPin(input.adult.pin!);
    const at = this.now();
    return this.store.sqlite.transaction(() => {
      if (this.store.db.select().from(households).get())
        throw new DomainError(409, 'Household is already configured');
      const household = {
        id: randomUUID(),
        name: input.name,
        timezone: input.timezone,
        createdAt: at,
        updatedAt: at,
      };
      this.store.db.insert(households).values(household).run();
      const { pin: _pin, ...adult } = input.adult;
      const user = {
        ...adult,
        id: randomUUID(),
        householdId: household.id,
        pinHash,
        rewardPoints: 0,
        createdAt: at,
        updatedAt: at,
      };
      this.store.db.insert(users).values(user).run();
      this.store.db
        .insert(rewardSettings)
        .values({ householdId: household.id })
        .run();
      this.audit.record(user.id, 'Household created', household.id, at);
      this.audit.record(user.id, 'User created', user.id, at);
      return { household, adultId: user.id };
    })();
  }
  async saveUser(
    input: z.infer<typeof userUpdateSchema>,
    actor: string,
    id?: string,
  ) {
    const pinHash = input.pin ? await hashPin(input.pin) : undefined;
    const { pin: _pin, ...fields } = input;
    const at = this.now();
    return this.store.sqlite.transaction(() => {
      const old = id ? this.user(id) : null;
      if (input.kioskPinRequired && !pinHash && !old?.pinHash)
        throw new DomainError(
          400,
          'Set a PIN before enabling kiosk protection',
        );
      if (input.role === 'ADULT' && !pinHash && !old?.pinHash)
        throw new DomainError(400, 'Adults need a PIN');
      if (
        old?.role === 'ADULT' &&
        old.active &&
        (!input.active || input.role !== 'ADULT') &&
        this.store.db
          .select()
          .from(users)
          .where(and(eq(users.role, 'ADULT'), eq(users.active, true)))
          .all().length <= 1
      )
        throw new DomainError(409, 'Keep at least one active adult');
      const userId = id ?? randomUUID();
      if (id)
        this.store.db
          .update(users)
          .set({ ...fields, ...(pinHash ? { pinHash } : {}), updatedAt: at })
          .where(eq(users.id, id))
          .run();
      else
        this.store.db
          .insert(users)
          .values({
            ...fields,
            id: userId,
            householdId: this.household().id,
            pinHash: pinHash ?? null,
            createdAt: at,
            updatedAt: at,
          })
          .run();
      this.audit.record(
        actor,
        !input.active ? 'User disabled' : id ? 'User changed' : 'User created',
        userId,
        at,
      );
      return this.publicUser(this.user(userId));
    })();
  }
  publicUser(user: typeof users.$inferSelect) {
    const { pinHash: _hash, ...safe } = user;
    return { ...safe, hasPin: !!user.pinHash };
  }
  saveMedication(
    input: z.infer<typeof medicationSchema>,
    actor: string,
    id?: string,
  ) {
    if (!this.user(input.userId).active)
      throw new DomainError(400, 'Choose an active family member');
    return this.store.sqlite.transaction(() => {
      const at = this.now();
      if (
        id &&
        input.usageType === 'AS_NEEDED' &&
        this.store.db
          .select()
          .from(schedules)
          .where(
            and(eq(schedules.medicationId, id), eq(schedules.active, true)),
          )
          .get()
      )
        throw new DomainError(
          409,
          'Disable this medication’s schedules before changing it to as needed',
        );
      if (id) {
        if (
          !input.active &&
          this.todayDoses().some(
            (d) =>
              d.medicationId === id &&
              ['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(d.status),
          )
        )
          throw new DomainError(
            409,
            "Resolve today's pending doses in History before disabling this medication",
          );
        const old = requireValue(
          this.store.db
            .select()
            .from(medications)
            .where(eq(medications.id, id))
            .get(),
        );
        if (
          old.userId !== input.userId &&
          (this.store.db
            .select()
            .from(doses)
            .where(eq(doses.medicationId, id))
            .get() ||
            this.store.db
              .select()
              .from(asNeededUses)
              .where(eq(asNeededUses.medicationId, id))
              .get())
        )
          throw new DomainError(
            409,
            'Disable this medication and create a new one to change its person after scheduling',
          );
        this.store.db
          .update(medications)
          .set({ ...input, updatedAt: at })
          .where(eq(medications.id, id))
          .run();
        for (const schedule of this.store.db
          .select()
          .from(schedules)
          .where(eq(schedules.medicationId, id))
          .all())
          this.clearFuture(schedule.id);
      } else {
        id = randomUUID();
        this.store.db
          .insert(medications)
          .values({
            ...input,
            id,
            householdId: this.household().id,
            createdAt: at,
            updatedAt: at,
          })
          .run();
      }
      this.audit.record(
        actor,
        input.active
          ? id
            ? 'Medication saved'
            : 'Medication created'
          : 'Medication disabled',
        id,
        at,
      );
      return { id };
    })();
  }
  clearFuture(scheduleId: string) {
    // Today's occurrences remain historical snapshots. Edits replace only tomorrow and later.
    const tomorrow = DateTime.fromISO(this.now(), {
      zone: this.household().timezone,
    })
      .plus({ days: 1 })
      .startOf('day')
      .toUTC()
      .toISO()!;
    this.store.db
      .delete(doses)
      .where(
        and(
          eq(doses.scheduleId, scheduleId),
          gte(doses.scheduledAt, tomorrow),
          eq(doses.status, 'DUE'),
        ),
      )
      .run();
    this.store.db
      .update(schedules)
      .set({ generatedThrough: dayAt(this.now(), this.household().timezone) })
      .where(eq(schedules.id, scheduleId))
      .run();
  }
  saveSchedule(
    input: z.infer<typeof scheduleSchema>,
    actor: string,
    id?: string,
  ) {
    requireValue(
      this.store.db
        .select()
        .from(medications)
        .where(eq(medications.id, input.medicationId))
        .get(),
    );
    if (
      this.store.db
        .select()
        .from(medications)
        .where(eq(medications.id, input.medicationId))
        .get()!.usageType === 'AS_NEEDED'
    )
      throw new DomainError(400, 'As-needed medications do not use schedules');
    const { daysOfWeek, ...fields } = input;
    const at = this.now();
    const result = this.store.sqlite.transaction(() => {
      if (id) {
        if (
          !input.active &&
          this.todayDoses().some(
            (d) =>
              d.scheduleId === id &&
              ['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(d.status),
          )
        )
          throw new DomainError(
            409,
            "Resolve today's pending doses in History before disabling this schedule",
          );
        const old = requireValue(
          this.store.db
            .select()
            .from(schedules)
            .where(eq(schedules.id, id))
            .get(),
        );
        if (old.medicationId !== input.medicationId)
          throw new DomainError(400, 'A schedule cannot change medication');
        this.clearFuture(id);
        this.store.db
          .update(schedules)
          .set({ ...fields, updatedAt: at })
          .where(eq(schedules.id, id))
          .run();
        this.store.db
          .delete(scheduleDays)
          .where(eq(scheduleDays.scheduleId, id))
          .run();
      } else {
        id = randomUUID();
        this.store.db
          .insert(schedules)
          .values({ ...fields, id, createdAt: at, updatedAt: at })
          .run();
      }
      for (const day of daysOfWeek)
        this.store.db
          .insert(scheduleDays)
          .values({ scheduleId: id, day })
          .run();
      this.audit.record(actor, 'Schedule saved', id, at);
      return { id };
    })();
    this.scheduler.generate();
    return result;
  }
  allSchedules() {
    return this.store.db
      .select()
      .from(schedules)
      .all()
      .map((s) => ({
        ...s,
        daysOfWeek: this.store.db
          .select()
          .from(scheduleDays)
          .where(eq(scheduleDays.scheduleId, s.id))
          .all()
          .map((d) => d.day),
      }));
  }
  todayDoses(userId?: string) {
    const today = dayAt(this.now(), this.household().timezone);
    return this.store.db
      .select()
      .from(doses)
      .all()
      .filter(
        (d) =>
          (!userId || d.userId === userId) &&
          dayAt(d.scheduledAt, this.household().timezone) === today,
      );
  }
  profile(user: typeof users.$inferSelect): Profile {
    const records = this.todayDoses(user.id),
      now = this.now();
    const unfinished = records.filter((d) =>
      ['DUE', 'SNOOZED', 'AWAITING_SUPERVISION'].includes(d.status),
    );
    const due = unfinished.filter(
      (d) => d.scheduledAt <= now && (!d.snoozedUntil || d.snoozedUntil <= now),
    );
    return {
      id: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      feedbackStyle: user.feedbackStyle,
      soundEnabled: user.soundEnabled,
      role: user.role,
      hasPin: !!user.pinHash,
      kioskPinRequired: user.kioskPinRequired,
      rewardPoints: user.rewardPoints,
      total: records.length,
      complete: records.filter((d) => d.status === 'TAKEN').length,
      due: due.length,
      awaiting: due.filter((d) => d.status === 'AWAITING_SUPERVISION').length,
      overdue: due.filter(
        (d) =>
          Date.parse(now) >
          Date.parse(d.scheduledAt) + d.gracePeriodMinutes * 60000,
      ).length,
      nextAt:
        unfinished.map((d) => d.snoozedUntil ?? d.scheduledAt).sort()[0] ??
        null,
    };
  }
  kiosk() {
    return {
      household: {
        name: this.household().name,
        timezone: this.household().timezone,
      },
      profiles: this.store.db
        .select()
        .from(users)
        .where(eq(users.active, true))
        .all()
        .map((u) => this.profile(u)),
      returnDelay: Math.max(
        1000,
        Math.min(2000, Number(process.env.KIOSK_RETURN_DELAY) || 1800),
      ),
      now: this.now(),
    };
  }
  profileData(id: string) {
    const user = this.user(id);
    if (!user.active) throw new DomainError(404, 'Profile unavailable');
    return {
      history: this.store.db
        .select({
          id: doses.id,
          scheduledAt: doses.scheduledAt,
          acknowledgedAt: doses.acknowledgedAt,
          status: doses.status,
          displayName: doses.displayName,
          doseDisplay: doses.doseDisplay,
        })
        .from(doses)
        .where(
          and(
            eq(doses.userId, id),
            gte(
              doses.scheduledAt,
              DateTime.fromISO(this.now(), { zone: this.household().timezone })
                .minus({ days: 6 })
                .startOf('day')
                .toUTC()
                .toISO()!,
            ),
            lte(
              doses.scheduledAt,
              DateTime.fromISO(this.now(), { zone: this.household().timezone })
                .endOf('day')
                .toUTC()
                .toISO()!,
            ),
          ),
        )
        .orderBy(desc(doses.scheduledAt))
        .all(),
      asNeeded: this.store.db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.userId, id),
            eq(medications.active, true),
            eq(medications.usageType, 'AS_NEEDED'),
          ),
        )
        .all()
        .map((m) => ({
          id: m.id,
          displayName: m.privacyMode ? m.displayName : m.name,
          doseDisplay: m.doseDisplay,
          instructions: m.instructions,
          requiresSupervision: m.requiresSupervision,
          lastUsedAt:
            this.store.db
              .select()
              .from(asNeededUses)
              .where(eq(asNeededUses.medicationId, m.id))
              .orderBy(desc(asNeededUses.usedAt))
              .get()?.usedAt ?? null,
        })),
      profile: this.profile(user),
      returnDelay: Math.max(
        1000,
        Math.min(2000, Number(process.env.KIOSK_RETURN_DELAY) || 1800),
      ),
      awardPoints: this.store.db.select().from(rewardSettings).get()!
        .medication,
      timezone: this.household().timezone,
      doses: this.todayDoses(id).map((d) => ({
        id: d.id,
        userId: d.userId,
        medicationId: d.medicationId,
        scheduledAt: d.scheduledAt,
        acknowledgedAt: d.acknowledgedAt,
        status: d.status,
        displayName: d.displayName,
        doseDisplay: d.doseDisplay,
        instructions: d.instructions,
        requiresSupervision: d.requiresSupervision,
        period: d.period,
        gracePeriodMinutes: d.gracePeriodMinutes,
        snoozedUntil: d.snoozedUntil,
        image:
          this.store.db
            .select()
            .from(medications)
            .where(eq(medications.id, d.medicationId))
            .get()?.image ?? null,
      })),
      streak: streaks(
        this.store.db.select().from(doses).where(eq(doses.userId, id)).all(),
        this.household().timezone,
        this.now(),
      ).current,
    };
  }
  act(doseId: string, input: Action, actor: typeof users.$inferSelect | null) {
    this.scheduler.generate();
    const at = this.now();
    let event: DomainEvent | undefined;
    const result = this.store.sqlite.transaction(() => {
      const dose = requireValue(
        this.store.db.select().from(doses).where(eq(doses.id, doseId)).get(),
      );
      const person = this.user(dose.userId);
      if (!person.active) throw new DomainError(403, 'Profile is disabled');
      const adult = actor?.role === 'ADULT';
      if (person.kioskPinRequired && !adult && actor?.id !== person.id)
        throw new DomainError(401, 'Unlock this profile first');
      if (dose.scheduledAt > at && !(adult && input.action === 'SKIP'))
        throw new DomainError(409, 'This medication is not due yet');
      // Retries are safe. A completed dose never emits a second reward event.
      if (dose.status === 'TAKEN' && ['TAKE', 'CONFIRM'].includes(input.action))
        return { status: 'TAKEN', points: 0, alreadyRecorded: true };
      const status = nextStatus(
        dose.status,
        input.action,
        dose.requiresSupervision,
        adult,
      );
      if (input.deviceId)
        requireValue(
          this.store.db
            .select()
            .from(devices)
            .where(eq(devices.id, input.deviceId))
            .get(),
          'Unknown device',
        );
      const before = this.rewards.balance(dose.userId);
      const previousAwards = new Set(
        this.store.db
          .select({ id: rewardEvents.id })
          .from(rewardEvents)
          .where(eq(rewardEvents.userId, dose.userId))
          .all()
          .map((r) => r.id),
      );
      this.store.db
        .update(doses)
        .set({
          status,
          updatedAt: at,
          acknowledgedAt: status === 'TAKEN' ? at : dose.acknowledgedAt,
          confirmationType:
            status === 'TAKEN'
              ? adult
                ? input.action === 'CONFIRM'
                  ? 'PARENT'
                  : 'ADMIN'
                : 'SELF'
              : dose.confirmationType,
          confirmedByUserId:
            status === 'TAKEN'
              ? (actor?.id ?? dose.userId)
              : dose.confirmedByUserId,
          deviceId: input.deviceId ?? dose.deviceId,
          notes: input.notes ?? dose.notes,
          snoozedUntil:
            status === 'SNOOZED'
              ? new Date(Date.parse(at) + input.minutes * 60000).toISOString()
              : null,
        })
        .where(eq(doses.id, doseId))
        .run();
      const who = actor?.id ?? `kiosk:${dose.userId}`;
      event = {
        type: status === 'TAKEN' ? 'DoseTaken' : 'DoseChanged',
        doseId,
        actor: who,
        at,
        status,
      };
      this.events.emit(event);
      this.audit.record(who, `Dose ${input.action.toLowerCase()}`, doseId, at, {
        from: dose.status,
        to: status,
        notes: input.notes ?? null,
      });
      const earned = this.store.db
        .select()
        .from(rewardEvents)
        .where(eq(rewardEvents.userId, dose.userId))
        .all()
        .filter((r) => !previousAwards.has(r.id));
      const today = this.todayDoses(dose.userId);
      const period = today.filter((d) => d.period === dose.period);
      const balance = this.rewards.balance(dose.userId);
      const rewards = this.store.db
        .select()
        .from(rewardDefinitions)
        .where(eq(rewardDefinitions.active, true))
        .all()
        .sort((a, b) => a.pointCost - b.pointCost);
      const nextReward =
        rewards.find((r) => r.pointCost > balance) ?? rewards[0];
      return {
        status,
        ...(status === 'TAKEN'
          ? {
              feedback: {
                dayComplete:
                  today.length > 0 && today.every((d) => d.status === 'TAKEN'),
                periodComplete:
                  period.length > 0 && period.every((d) => d.status === 'TAKEN')
                    ? dose.period
                    : null,
                medicationPoints: earned
                  .filter((r) => r.sourceType === 'DOSE')
                  .reduce((sum, r) => sum + r.points, 0),
                dailyPoints: earned
                  .filter((r) => r.sourceType === 'DAILY')
                  .reduce((sum, r) => sum + r.points, 0),
                streakPoints: earned
                  .filter((r) => r.sourceType.startsWith('STREAK_'))
                  .reduce((sum, r) => sum + r.points, 0),
                balance,
                nextReward: nextReward
                  ? { name: nextReward.name, pointCost: nextReward.pointCost }
                  : null,
              },
            }
          : {}),
        points: this.rewards.balance(dose.userId) - before,
        alreadyRecorded: false,
      };
    })();
    if (event) this.events.committed(event);
    return result;
  }
  history(days = 30) {
    const since = DateTime.fromISO(this.now()).minus({ days }).toUTC().toISO()!;
    return this.store.db
      .select()
      .from(doses)
      .where(
        and(gte(doses.scheduledAt, since), lte(doses.scheduledAt, this.now())),
      )
      .orderBy(desc(doses.scheduledAt))
      .all();
  }
  analytics(days = 7) {
    const records = this.history(days);
    const taken = records.filter((d) => d.status === 'TAKEN');
    const delays = taken.map((d) =>
      Math.max(
        0,
        (Date.parse(d.acknowledgedAt!) - Date.parse(d.scheduledAt)) / 60000,
      ),
    );
    return {
      days,
      takenOnTime: taken.filter(
        (d) =>
          Date.parse(d.acknowledgedAt!) <=
          Date.parse(d.scheduledAt) + d.gracePeriodMinutes * 60000,
      ).length,
      takenLate: taken.filter(
        (d) =>
          Date.parse(d.acknowledgedAt!) >
          Date.parse(d.scheduledAt) + d.gracePeriodMinutes * 60000,
      ).length,
      skipped: records.filter((d) => d.status === 'SKIPPED').length,
      missed: records.filter((d) => d.status === 'MISSED').length,
      averageDelay: delays.length
        ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
        : 0,
      profiles: this.store.db
        .select()
        .from(users)
        .all()
        .map((u) => ({
          id: u.id,
          displayName: u.displayName,
          ...streaks(
            this.store.db
              .select()
              .from(doses)
              .where(eq(doses.userId, u.id))
              .all(),
            this.household().timezone,
            this.now(),
          ),
        })),
    };
  }
  adminData() {
    return {
      ...this.kiosk(),
      users: this.store.db
        .select()
        .from(users)
        .all()
        .map((u) => this.publicUser(u)),
      medications: this.store.db.select().from(medications).all(),
      schedules: this.allSchedules(),
      rewards: this.store.db.select().from(rewardDefinitions).all(),
      rewardSettings: this.store.db.select().from(rewardSettings).get(),
      today: this.todayDoses(),
      history: this.history(),
      asNeededHistory: this.store.db
        .select()
        .from(asNeededUses)
        .orderBy(desc(asNeededUses.usedAt))
        .limit(200)
        .all(),
      audit: this.store.db
        .select()
        .from(auditEvents)
        .orderBy(desc(auditEvents.timestamp))
        .limit(200)
        .all(),
      rewardEvents: this.store.db
        .select()
        .from(rewardEvents)
        .orderBy(desc(rewardEvents.createdAt))
        .limit(200)
        .all(),
    };
  }
}
