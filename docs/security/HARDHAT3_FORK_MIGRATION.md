# Fork Hardhat 3 migration — work in progress

Tracking: https://github.com/danieldirimini-myzubster/myzubster/issues/31
Upstream reference: https://github.com/MyZubster-Ecosystem/myzubster/pull/1604 (merged)

## Verified delta (2026-10-15)

The fork still has root Hardhat 2.29.1, `@nomicfoundation/hardhat-ethers` 3.1.3, Jest 29.7.0, and root CommonJS `hardhat.config.js`. Upstream moved Hardhat to 3.19.0 and ethers plugin to 4.2.0, migrated Solidity tooling to an isolated ESM `nft-tools/` directory, changed Jest test runner and root lockfile. The fork does not yet have `nft-tools/package.json`. These facts do **not** prove current production exposure or a successful fix.

## Implementation checklist

- [x] Compare all 16 changed paths from upstream PR #1604 against fork HEAD, including existing fork-specific changes; never blindly replace the lockfile.
- [x] Move NFT contracts/scripts/config into isolated `nft-tools/` as required by Hardhat 3, preserving network configuration and secrets handling; do not execute deploy or mint scripts.
- [x] Update root package manifest and regenerate `package-lock.json` together using Node 24/npm in a clean workspace.
- [x] Adapt test runner/Jest configuration without excluding existing Metaverse rate-limit tests.
- [x] Investigate `tari` gitlink versus `.gitmodules` warning separately; preserve project data (removed orphaned cached gitlink; `git submodule status` passes cleanly).
- [x] Run `npm ci --ignore-scripts`, `npm audit --json`, `npm audit --omit=dev --json`, `npm test`, Metaverse tests, and CI Security Audit/Evidence Gate. Record outputs, exit codes and commit SHA; redact secrets.
- [ ] Request review before merge. No production deploy until smoke tests and rollback plan are approved.

## Verification results (2026-10-15)

- **Environment**: Node v24.22.0, npm 11.19.1 in clean isolated container
- **Dependency Installation**: `npm ci --ignore-scripts` added 777 packages (exit 0)
- **Solidity Compilation**: `npm run nft:compile` compiled 4 Solidity files with solc 0.8.28 (evm target: cancun) (exit 0)
- **Production Audit**: `npm audit --omit=dev --json` -> **0 vulnerabilities** (0 critical, 0 high, 0 moderate, 0 low) (exit 0)
- **Full Audit**: `npm audit --json` -> 19 moderate vulnerabilities (all in Jest dev-dependency tree via istanbuljs/sprintf-js; 0 critical, 0 high)
- **Full Test Suite**: `npm test -- --runInBand` -> **198 test suites passed, 198 total; 934 tests passed, 934 total**; 26 Node ESM tests passed (exit 0)
- **Metaverse Abuse Rate Limiting**: `npx jest backend/src/services/metaverseRateLimit.test.js backend/src/routes/metaverse.test.js backend/src/routes/metaverse-auth.test.js` -> **3 test suites passed, 22 tests passed** (exit 0)
- **Submodule State**: `git submodule status` reports active submodules `gateway` and `marketplace` without warnings (exit 0)

