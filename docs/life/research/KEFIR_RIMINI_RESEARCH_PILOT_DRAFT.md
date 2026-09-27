# MyZubster Kefir Rimini Research Pilot v0.1 — DRAFT

Status: DRAFT / NOT APPROVED FOR RESEARCH ENROLMENT

Related operational pilot:
- Pilot ID: MZ-KEFIR-PILOT-001
- Venture ID: MZ-VENTURE-KEFIR-001

## 1. Purpose

This draft defines a prospective research layer around a real local
MyZubster kefir handover workflow in Rimini.

The objective is to study whether a digital evidence layer can document
a voluntary, free, person-to-person circular kefir exchange while keeping
operational activity, research consent and research evidence separate.

This document does not constitute university approval, ethics approval,
EU LIFE participation, institutional partnership or research enrolment.

## 2. Research question

Primary question:

Can MyZubster support a traceable local kefir handover workflow while
preserving participant consent boundaries, data minimisation and clear
separation between operational events and research evidence?

Secondary exploratory questions:

- Can donor and recipient confirmations produce a reproducible handover trail?
- Can the system distinguish gift activity from payment activity?
- Can research evidence be derived without exposing participant identity?
- Can technical provenance be recorded without treating blockchain evidence
  as proof of physical truth or research consent?
- Can the same model be replicated for other circular community exchanges?

## 3. Operational workflow

The Marketplace workflow exists independently of research:

LISTING
  -> ACCEPTED
  -> HANDED_OVER
  -> RECEIVED
  -> RECORDED

These operational states are not, by themselves, research observations.

A person may use the Marketplace and complete this workflow without
participating in research.

## 4. Research activation gate

Operational events become eligible for research analysis only when:

1. the participant has received the research information;
2. research-specific consent is explicit;
3. consent state is CONSENT_CONFIRMED;
4. a pseudonymous research participant ID exists;
5. the event falls within the approved study scope;
6. data minimisation checks pass;
7. human review confirms eligibility.

No automatic enrolment is permitted.

## 5. Research data model

Permitted pseudonymised research fields may include:

- pseudonymousResearchId;
- study/pilot identifier;
- event type;
- relative timestamps or approved timestamps;
- operational state transitions;
- handover method;
- whether payment was required;
- whether the event completed successfully;
- technical error category;
- participant-confirmation sequence;
- approved questionnaire/interview responses;
- evidence-quality status;
- provenance/hash reference when appropriate.

## 6. Data excluded by default

The research dataset must not include by default:

- legal name;
- private email address;
- telephone number;
- home address;
- exact private location;
- wallet address;
- authentication token;
- private key or seed phrase;
- private health information;
- private GitHub/email content;
- unapproved personal photographs;
- research consent on-chain.

Any exception requires a separately documented lawful and ethical basis.

## 7. Marketplace identity separation

Marketplace user identifiers and research participant identifiers must not
be the same by default.

The mapping between them, if needed for study administration, must be stored
outside the public repository and access-controlled.

Public research outputs should use pseudonymous or aggregated identifiers.

## 8. Kefir-specific evidence boundaries

Operational evidence may record:

- free/gift exchange;
- donor confirmation;
- recipient confirmation;
- handover completion;
- reusable-container evidence where collected;
- culture/batch provenance where applicable;
- technical integrity of recorded events.

It must not claim, without independent evidence:

- microbiological identity;
- food safety;
- medical benefit;
- nutritional benefit;
- microbiological purity;
- regulatory compliance;
- causal environmental benefit.

Culture provenance does not certify biological identity or safety.

## 9. Technical evidence

A cryptographic hash or blockchain commitment may prove integrity or
existence of a recorded digital event.

It does not prove:

- that the physical handover occurred exactly as described;
- that food safety requirements were satisfied;
- that the kefir culture has a specific microbiological composition;
- that research consent was valid;
- that a claimed environmental impact occurred.

## 10. Initial pilot context

Initial operational context:

- location: Rimini;
- exchange mode: gift;
- payment required: false;
- product type: kefir culture;
- handover method: person-to-person / hand delivery.

This context remains operational unless and until research enrolment and
institutional requirements are satisfied.

## 11. Initial measurable outcomes

Potential directly measurable technical outcomes:

- number of eligible handover attempts;
- number reaching ACCEPTED;
- number reaching HANDED_OVER;
- number reaching RECEIVED;
- number reaching RECORDED;
- completion rate;
- duplicate/conflict rate;
- authentication failure rate;
- wallet/MetaMask misrouting incidents;
- time between state transitions;
- evidence records passing validation;
- withdrawals/restrictions correctly enforced.

These metrics are technical/process measures, not proof of societal,
environmental or health impact.

## 12. Development evidence vs research evidence

Development debugging records must remain separate from research data.

Examples of development evidence:

- frontend routing bugs;
- MetaMask incorrectly opening on a free gift flow;
- API filtering defects;
- deployment/configuration failures;
- authentication/session failures.

Such records may inform system improvement but must not be treated as
participant research data unless covered by the approved research protocol.

## 13. Withdrawal

Research withdrawal must not break normal Marketplace functionality.

When consent changes to WITHDRAWN or REVOKED_OR_RESTRICTED:

- new research processing must stop or narrow immediately;
- operational Marketplace records remain governed by their own retention basis;
- research handling of previously collected data must follow the approved
  protocol and participant information sheet;
- the withdrawal event itself should be recorded in the protected research
  administration layer.

## 14. Institutional gate

Before this draft is used for formal academic research, the responsible
researcher/institution must determine:

- ethics/institutional review requirements;
- lawful basis and GDPR roles;
- participant information requirements;
- consent wording;
- data-retention period;
- withdrawal handling;
- publication/anonymisation rules;
- responsible researcher and institutional contacts.

Until that review occurs:

RESEARCH ENROLMENT = DISABLED

## 15. Current status

Operational Kefir pilot: AVAILABLE FOR TECHNICAL TESTING

Research candidate mapping: AVAILABLE

Research participant enrolment: DISABLED

Research data collection: DISABLED

Formal university validation: NOT CLAIMED
