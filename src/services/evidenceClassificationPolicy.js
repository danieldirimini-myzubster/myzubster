const EVIDENCE_CLASSES = Object.freeze({
  PUBLIC: 'PUBLIC',
  RESTRICTED: 'RESTRICTED',
  PARTICIPANT_ONLY: 'PARTICIPANT_ONLY',
  EPHEMERAL: 'EPHEMERAL'
});

function normalizeEvidenceClass(value) {
  const normalized = String(value || '').trim().toUpperCase();

  return Object.values(EVIDENCE_CLASSES).includes(normalized)
    ? normalized
    : null;
}

function canPersistEvidence(classification) {
  const evidenceClass = normalizeEvidenceClass(
    classification?.evidenceClass
  );

  if (!evidenceClass) {
    return {
      allowed: false,
      code: 'EVIDENCE_CLASS_REQUIRED'
    };
  }

  if (evidenceClass === EVIDENCE_CLASSES.EPHEMERAL) {
    return {
      allowed: false,
      code: 'EPHEMERAL_PERSISTENCE_DENIED'
    };
  }

  return {
    allowed: true,
    code: 'PERSISTENCE_ALLOWED'
  };
}

function canPrepareCommitment(classification) {
  const persistence = canPersistEvidence(classification);

  if (!persistence.allowed) {
    return persistence;
  }

  return {
    allowed: true,
    code: 'COMMITMENT_PREPARATION_ALLOWED'
  };
}

function canPubliclyAnchor(classification) {
  const evidenceClass = normalizeEvidenceClass(
    classification?.evidenceClass
  );

  if (!evidenceClass) {
    return {
      allowed: false,
      code: 'EVIDENCE_CLASS_REQUIRED'
    };
  }

  if (evidenceClass !== EVIDENCE_CLASSES.PUBLIC) {
    return {
      allowed: false,
      code: 'PUBLIC_ANCHORING_CLASS_DENIED'
    };
  }

  if (classification?.publicAnchoringAllowed !== true) {
    return {
      allowed: false,
      code: 'PUBLIC_ANCHORING_NOT_AUTHORISED'
    };
  }

  return {
    allowed: true,
    code: 'PUBLIC_ANCHORING_ALLOWED'
  };
}

module.exports = {
  EVIDENCE_CLASSES,
  normalizeEvidenceClass,
  canPersistEvidence,
  canPrepareCommitment,
  canPubliclyAnchor
};
