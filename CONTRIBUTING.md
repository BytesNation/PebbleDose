# Contributing to PebbleDose

Open an issue for a bug or proposed change. Include steps to reproduce and the behavior you expected. Use fictional examples. Do not attach household databases, medication records, PINs, push subscriptions, or unredacted screenshots.

## Local setup

Use Node 24 and pnpm 11.5.0. Follow the development instructions in the README. Use a separate test household when changing medication, scheduling, or reward behavior.

Before opening a pull request, run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
git diff --check
```

Describe the user-visible change and what the checks showed. Add focused regression tests for changes to scheduling, authorization, recorded doses, or rewards. Commit generated SQL migrations when changing the database schema. Do not edit migrations already released.

Keep acknowledgements distinct from verified ingestion. As-needed medication must not earn points or contribute to scheduled daily goals. Preserve adult authorization for administration, supervised confirmation, and reward redemption.

Contributions are made under the repository's MIT license.
