# MyZubster Private Verifiability — Threat Model v0.1

Status: DRAFT

## Assets to protect

1. participant identity;
2. participant relationships;
3. precise location;
4. transaction metadata;
5. communication metadata;
6. private evidence;
7. research identity mapping;
8. credentials and cryptographic secrets.

## Adversarial observations

An observer may attempt to correlate:

PSEUDONYM
  + TIME
  + LOCATION
  + PAYMENT
  + PUBLIC LOG
  + NETWORK METADATA
  =
POSSIBLE REAL-WORLD IDENTIFICATION

Therefore each additional data source should be treated as a possible
correlation surface.

## Design objective

Minimise what must exist.

Then minimise what must persist.

Then minimise who can access it.

Only after those decisions should cryptographic mechanisms be selected.

## Evidence principle

PUBLIC VERIFIABILITY is not the default.

Evidence may instead be:

PUBLIC
RESTRICTED
PARTICIPANT_ONLY
EPHEMERAL

The classification must be explicit.

## Non-goals

This document does not promise:

- perfect anonymity;
- absolute untraceability;
- immunity from endpoint compromise;
- immunity from participant disclosure;
- legal protection;
- physical safety.

## Research boundary

This threat model is intended for privacy-preserving software and research
design.

It is not an operational guide for concealing unlawful activity.
