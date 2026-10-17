# Fork Hardhat 3 migration — work in progress

Tracking: https://github.com/danieldirimini-myzubster/myzubster/issues/31
Upstream reference: https://github.com/MyZubster-Ecosystem/myzubster/pull/1604 (merged)

## Verified delta (2026-10-15)

The fork still has root Hardhat 2.29.1, `@nomicfoundation/hardhat-ethers` 3.1.3, Jest 29.7.0, and root CommonJS `hardhat.config.js`. Upstream moved Hardhat to 3.19.0 and ethers plugin to 4.2.0, migrated Solidity tooling to an isolated ESM `nft-tools/` directory, changed Jest test runner and root lockfile. The fork does not yet have `nft-tools/package.json`. These facts do **not** prove current production exposure or a successful fix.

## Implementation checklist

- [ ] Compare all 16 changed paths from upstream PR #1604 against fork HEAD, including existing fork-specific changes; never blindly replace the lockfile.
- [ ] Move NFT contracts/scripts/config into isolated `nft-tools/` as required by Hardhat 3, preserving network configuration and secrets handling; do not execute deploy or mint scripts.
- [ ] Update root package manifest and regenerate `package-lock.json` together using Node 24/npm in a clean workspace.
- [ ] Adapt test runner/Jest configuration without excluding existing Metaverse rate-limit tests.
- [ ] Investigate `tari` gitlink versus `.gitmodules` warning separately; preserve project data.
- [ ] Run `npm ci --ignore-scripts`, `npm audit --json`, `npm audit --omit=dev --json`, `npm test`, Metaverse tests, and CI Security Audit/Evidence Gate. Record outputs, exit codes and commit SHA; redact secrets.
- [ ] Request review before merge. No production deploy until smoke tests and rollback plan are approved.

## Current status

This document is a migration plan, **not** an implemented dependency fix. Audit findings are historical and require rerunning on the current branch. Contributor acceptance and passing CI are pending.
