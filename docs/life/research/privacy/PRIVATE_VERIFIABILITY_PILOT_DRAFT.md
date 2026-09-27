# MZ-PRIVACY-PILOT-001
# Private Verifiability & Community Exchange

Status: DRAFT / RESEARCH DESIGN ONLY

## 1. Purpose

This pilot explores whether participants can verify a community exchange
without creating an unnecessarily public record of their identities,
relationships, locations or activities.

Core principle:

> Verifiable does not have to mean public.

This pilot is separate from the Kefir/Rimini operational pilot.

It does not constitute university approval, ethics approval, EU LIFE
participation, funding, partnership or research enrolment.

## 2. Research question

Primary question:

What is the minimum information required for participants to verify an
exchange while avoiding unnecessary public disclosure?

Secondary questions:

- Which evidence must be public?
- Which evidence can remain participant-only?
- Can pseudonymous attestations provide useful accountability?
- How much metadata is exposed by each architecture?
- Can settlement be separated from identity and evidence?
- Can selective disclosure support later verification?
- How should withdrawal and deletion operate when evidence is private?

## 3. Comparison model

### A — Public verification

EVENT
  -> operational record
  -> public evidence
  -> public verification

Suitable where transparency is intentionally part of the pilot.

### B — Pseudonymous verification

EVENT
  -> pseudonymous attestation
  -> restricted evidence
  -> authorised verification

The public does not require access to the complete event record.

### C — Minimal/private verification

EVENT
  -> peer attestation
  -> minimal commitment
  -> selective disclosure when required

No public event log is required by default.

## 4. Separation of concerns

The architecture must keep separate:

IDENTITY
PAYMENT
EVENT
REPUTATION
RESEARCH CONSENT
RESEARCH DATA
CRYPTOGRAPHIC EVIDENCE

A payment must not automatically become proof of an event.

An event must not automatically reveal an identity.

A pseudonym must not automatically become a research identity.

Research consent must not be inferred from participation, payment,
software contribution or possession of cryptographic evidence.

## 5. Threat model

Potential risks include:

- identity correlation;
- pseudonym correlation;
- transaction correlation;
- timing correlation;
- location disclosure;
- social-graph reconstruction;
- metadata leakage;
- permanent publication of sensitive evidence;
- accidental disclosure through logs;
- wallet-to-identity linkage;
- research dataset re-identification.

The objective is data minimisation rather than claims of perfect anonymity
or absolute untraceability.

## 6. Location policy

Exact sensitive event locations are excluded by default.

The research architecture should prefer:

- no location;
- coarse region where genuinely required;
- participant-controlled disclosure.

A precise location must not be made public merely to prove that an event
occurred.

## 7. Peer attestations

A participant may attest to a narrowly defined fact, for example:

- an agreed exchange was completed;
- a contribution was acknowledged;
- an item was received;
- a task was completed.

The attestation should reveal only information necessary for its purpose.

Peer attestation represents participant testimony.

It is not independent proof that the underlying physical event is true.

## 8. Pseudonymous reputation

Future experiments may investigate reputation associated with pseudonymous
identifiers.

Reputation must not require publication of a legal identity.

Research questions include:

- resistance to correlation;
- resistance to duplicate identities;
- portability;
- revocation;
- selective disclosure;
- recovery;
- abuse prevention.

No production reputation system is activated by this draft.

## 9. Private settlement track

Monero may be evaluated as an OPTIONAL private settlement technology.

XMR settlement is not required for participation in this research track.

Settlement evidence must remain conceptually separate from:

- participant identity;
- event evidence;
- reputation;
- research consent;
- research participation.

A Monero payment should not be interpreted as proof that a physical event
occurred.

No wallet address is required in the public research registry.

No private key, seed phrase or wallet credential may be collected.

## 10. Cryptographic research track

Future prototypes may evaluate:

- hashes;
- participant signatures;
- selective disclosure;
- zero-knowledge proofs;
- group-oriented attestations;
- encrypted evidence exchange.

These are candidate technologies, not claims about the current
implementation.

Cryptography must be selected only after the threat model and disclosure
requirements are defined.

## 11. Communications

Privacy-preserving communication technologies may be evaluated separately
as research infrastructure.

Communication-system evaluation must remain separate from operational
coordination of unlawful activity.

The research focus is privacy, metadata minimisation, resilience and
participant protection.

## 12. Research data

Potential research measures include:

- bytes/fields disclosed publicly;
- number of persistent identifiers;
- number of parties able to inspect evidence;
- correlation surfaces;
- verification success rate;
- failed verification rate;
- participant-controlled disclosures;
- revocation effectiveness;
- evidence integrity;
- usability;
- time required to verify an attestation.

## 13. Prohibited automatic inference

The system must not infer from technical evidence:

- legal identity;
- physical location;
- political affiliation;
- participation in a particular event;
- research consent;
- institutional affiliation.

## 14. Research activation

As with other MyZubster research tracks:

RESEARCH INFORMATION
        +
EXPLICIT RESEARCH CONSENT
        +
PSEUDONYMOUS RESEARCH ID
        +
DATA-MINIMISATION REVIEW
        +
HUMAN APPROVAL
        =
ELIGIBLE RESEARCH PARTICIPATION

Until those gates are satisfied:

RESEARCH PARTICIPATION = DISABLED

## 15. Current implementation state

Threat model: DRAFT

Public/private comparison model: DRAFT

Monero settlement integration: NOT IMPLEMENTED

Zero-knowledge prototype: NOT IMPLEMENTED

Private reputation system: NOT IMPLEMENTED

Research participants: NONE ACTIVATED BY THIS DOCUMENT

Formal university validation: NOT CLAIMED
