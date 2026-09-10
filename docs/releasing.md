# Releasing PebbleDose

Use semantic versions. Patch releases fix compatible defects. During 0.x development, minor releases may change behavior or storage compatibility, with explicit migration notes.

1. Open a pull request that updates the root `package.json` version and moves the relevant changelog entries into a dated release section.
2. Include migration, backup, and compatibility instructions. Never promise an older binary can read an upgraded database without testing it.
3. Merge only after `Required checks` passes. It includes application tests, browser tests, CodeQL, and native AMD64/ARM64 container smoke tests.
4. From an up-to-date, clean `main`, create and push an annotated tag matching the version:

```bash
git tag -a v0.1.0 -m "PebbleDose v0.1.0"
git push origin v0.1.0
```

The Release workflow runs the checks again against the tagged commit. It verifies that the tag matches `package.json` and is on `main`, builds source archives, and attaches SHA-256 checksums. The release stays a draft until asset upload succeeds. Never move a published release tag; fix defects in a new patch release.

If publication fails after a draft is created, inspect the run and assets before retrying. Remove only the incomplete draft release, preserving its tag, then rerun the failed publication job. A published release must not be deleted as a retry shortcut.

Download archives and checksums from the same release. On Linux, use `sha256sum -c SHA256SUMS`; on macOS, use `shasum -a 256 -c SHA256SUMS`.

Current releases contain source and Docker build instructions. Prebuilt registry images are not distributed. Physical device testing and real push delivery remain separate acceptance checks.
