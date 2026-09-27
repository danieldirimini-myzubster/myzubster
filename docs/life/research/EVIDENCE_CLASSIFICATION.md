# MyZubster Evidence Classification v1

Status: DRAFT

## Principle

Verifiable does not have to mean public.

Every research or pilot evidence object should have an explicit disclosure
classification before storage, publication or cryptographic anchoring.

## Classes

### PUBLIC

Evidence intentionally suitable for public disclosure.

Examples:
- published aggregate metrics;
- public technical documentation;
- intentionally public provenance records;
- non-sensitive public pilot results.

PUBLIC does not mean automatically publishable.
Human review may still be required.

### RESTRICTED

Evidence accessible only to authorised roles.

Examples:
- pseudonymised research records;
- protected study datasets;
- internal validation evidence;
- research administration records without unnecessary direct identifiers.

Access controls and retention rules are required.

### PARTICIPANT_ONLY

Evidence intended only for the directly involved participant or participants.

Examples:
- private peer attestations;
- participant-specific exchange evidence;
- selective-disclosure material;
- private settlement evidence where applicable.

It must not become PUBLIC merely because it can be cryptographically verified.

### EPHEMERAL

Information needed temporarily to complete an operation but not intended for
persistent evidence storage.

Examples:
- temporary session material;
- transient verification challenges;
- temporary routing information.

EPHEMERAL data should be discarded when its operational purpose ends,
subject to applicable security and legal requirements.

## Mandatory metadata

Where applicable, an evidence object should declare:

- evidenceClass;
- purpose;
- retentionPolicy;
- disclosureAudience;
- containsDirectIdentifier;
- containsPseudonymousIdentifier;
- containsLocation;
- containsPaymentMetadata;
- researchEligible;
- publicAnchoringAllowed.

## Default rule

If classification is missing:

PUBLICATION = DENIED

PUBLIC BLOCKCHAIN ANCHORING = DENIED

RESEARCH USE = DENIED

until classification and applicable consent/governance checks are complete.

## Research boundary

Evidence classification does not create research consent.

Research eligibility still requires the applicable research protocol,
participant consent state and human/governance gates.

## Cryptographic boundary

A hash, signature, commitment or blockchain transaction does not change the
classification of the underlying evidence.

PARTICIPANT_ONLY evidence remains PARTICIPANT_ONLY even if a cryptographic
commitment exists.

## Location boundary

Precise sensitive location should default to RESTRICTED,
PARTICIPANT_ONLY or EPHEMERAL rather than PUBLIC.

Location should only be retained when necessary for the declared purpose.

## Payment boundary

Payment evidence and event evidence are separate.

A payment does not prove that the associated physical event occurred.

Payment metadata must not automatically become public provenance.

## Conservative failure mode

When uncertain:

MINIMISE
    ↓
RESTRICT
    ↓
REQUEST HUMAN REVIEW

rather than automatically publishing evidence.
