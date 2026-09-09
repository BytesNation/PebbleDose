# Acceptance evidence

The project was built in seven phases. This record maps the requested MVP acceptance criteria to the implemented paths and verification. The initial implementation was subsequently extended with editable avatars, as-needed use, member history, optional kiosk PINs, completion feedback, and push notifications. The current automated suites are the executable acceptance record.

| #   | Requirement                  | Implementation and check                                                                                              |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Docker Compose startup       | Explicit migration job, healthy API, Nginx web service, persistent volume; container smoke check                      |
| 2   | Create a household           | First-run browser form creates household and first adult; API and browser checks                                      |
| 3   | Create adults and children   | Parent family editor, hashed PINs, final-adult guard; API and browser checks                                          |
| 4   | Create medications           | Parent medication editor, validated text and image decoding; API and browser checks                                   |
| 5   | Assign schedules             | Parent schedule editor with timezone, weekdays, dates and grace period; API and browser checks                        |
| 6   | Due medication appears       | Scheduler interval, request-time generation, persistent catch-up cursor, unique occurrences; API tests                |
| 7   | Child acknowledgement        | Large single-card action, persisted event, automatic home return; browser test                                        |
| 8   | Adult supervision            | Readiness state, PIN dialog, API role enforcement, parent confirmation; API and browser tests                         |
| 9   | Dose events                  | Persistent occurrences, recorded timestamp, confirmation type, actor, device, immutable snapshots; integration checks |
| 10  | Completion points            | Reward service and transactional ledger; duplicate and rollback tests                                                 |
| 11  | Daily completion and streaks | Complete-day rule and 7/30-day milestones; unit/API and multiple-medication browser tests                             |
| 12  | Overdue visibility           | Parent dashboard sorts pending overdue reminders; browser check                                                       |
| 13  | Mark, skip, snooze           | Parent dashboard and history controls; role/state tests                                                               |
| 14  | Audited actions              | Append-only audit table for setup, changes, acknowledgement, overrides, and rewards; integration checks               |
| 15  | History                      | Parent dose history, audit records, and points ledger; browser check                                                  |
| 16  | Basic analytics              | 7/30-day on-time, late, skipped, missed, average delay, current/best streaks; dashboard and domain checks             |
| 17  | Create and redeem rewards    | Parent definitions and PIN-confirmed child store; insufficient balance and retry tests                                |
| 18  | Tablet layout                | 1280×800 screenshots, 1024×600 layout check, responsive styles; visual inspection and browser checks                  |
| 19  | No Internet dependency       | No external assets/services, local auth and database, blocked-external-request browser test                           |
| 20  | AMD64 and ARM64              | Multi-platform API and web builds; architecture-specific runtime smoke checks                                         |
| 21  | PWA installation             | Manifest, PNG icons, service worker, standalone display; Chromium reports no installability errors                    |
| 22  | Automated core flows         | Vitest domain/API suite and production-build Playwright suite                                                         |

A physical Android tablet, iPad, Raspberry Pi touchscreen, and commercial appliance have not been tested here. Chromium installation eligibility is verified; device-specific installation and touch acceptance remain hardware checks. Offline means the Internet may be absent while the local server remains reachable. Loss of that server produces an explicit error and never a queued acknowledgement.

## Public release verification

On September 9, 2026, the clean public release passed lint, strict type checks, 39 unit/API/audio tests, 14 production-browser tests, and the production build. Browser tests use a temporary fictional household. Real background push receipt and physical touchscreen hardware remain device acceptance checks.
