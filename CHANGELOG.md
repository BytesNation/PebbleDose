# Changelog

Changes are grouped by release. PebbleDose uses semantic versioning. During 0.x development, minor releases may introduce breaking changes; release notes must call them out.

## [Unreleased]

### Added

- Screenshot gallery and a reproducible, isolated demo with fictional family data.

## [0.1.0] - 2026-09-09

### Added

- Local household setup, adult PIN administration, and optional member kiosk PINs.
- Scheduled medication reminders, acknowledgements, adult supervision, skips, and snoozes.
- As-needed medication recording without scheduled goals or reward points.
- Editable avatars, member history tiles, parent history, and an audit trail.
- Configurable rewards, completion celebrations, and optional sounds.
- Opt-in Web Push reminders with generic notification text.
- Installable browser app and persistent SQLite storage through Docker Compose.
- MIT license, contributor templates, automated application tests, AMD64/ARM64 container checks, CodeQL scanning, and verified source release archives.

### Deployment notes

- This is the first versioned release. Back up existing data and uploaded images before applying updates. Never remove the data volume during a normal update.
- The application records acknowledgements, not verified ingestion. As-needed medication does not earn rewards.
- Keep the kiosk on a trusted local network. HTTPS is needed for installation on separate devices and browser push, with a localhost exception.
- Physical touchscreen devices and real background push receipt require device-specific acceptance testing.
