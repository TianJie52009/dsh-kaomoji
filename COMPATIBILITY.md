# Compatibility and release evidence

Date: 2026-10-27 (Asia/Shanghai). Version: 0.3.0.

## Official package integration matrix

| Harness | Native settings / migration / restart |
|---|---|
| 0.2.0-rc.2 | PASS |
| 0.2.1-alpha.1 | PASS |
| 0.2.1-alpha.2 | PASS |
| 0.2.1-alpha.3 | PASS |
| 0.2.1-alpha.4 | PASS |
| 0.2.1-alpha.5 | PASS |
| 0.2.1-rc.1 | PASS |
| 0.2.1-rc.2 | PASS |
| 0.2.1-rc.3 | PASS |

The matrix uses the real published Loader, SettingsForms, ConfigEditor, app-boot and SystemPrompt in isolated profiles. It verifies legacy import, migration marker, newer user-field precedence (unit tests), live references without remounting, stale-write rejection, validation, restart persistence and reset without reimport. It also checks the General slot and generated settings Remote methods in each official client bundle.

Reproduce: npm ci --legacy-peer-deps, npm test, npm run test:compat. DSH_COMPAT_HOME can point at a shared isolated runtime/cache directory. No live profile is modified.

## Limits

These are official-package integration tests and ModuleLoader/store tests. Complete Web and Desktop applications were not launched across all nine releases; a full desktop carrier/UI smoke test remains a separate manual check. Later Harness versions and 0.1.x are outside this release range.

## Release and market

Release targets: GitHub tag v0.3.0 and npm latest 0.3.0. Use npm view dsh-kaomoji version to verify registry publication. sync-market.cmd checks the deployed catalog against this package version; catalog refresh and fresh-release installation policy are independent.
