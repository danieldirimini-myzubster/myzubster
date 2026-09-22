'use strict';

const {
  buildAssistantPrompt
} = require('../src/services/zorgaxAssistantService');

describe('Zorgax assistant verified knowledge context', () => {
  const knowledge = [
    {
      status: 'APPROVED',
      visibility: 'PUBLIC',
      title: 'Public marketplace invariant',
      description: 'Kefir culture listings are FREE-only.',
      category: 'marketplace'
    },
    {
      status: 'APPROVED',
      visibility: 'INTERNAL',
      title: 'Internal engineering decision',
      description: 'Private architectural context.',
      category: 'architecture'
    }
  ];

  test('guest/public prompt receives only PUBLIC verified knowledge', () => {
    const prompt = buildAssistantPrompt(
      'Come funziona il marketplace?',
      [],
      knowledge,
      false
    );

    expect(prompt)
      .toContain('Public marketplace invariant');

    expect(prompt)
      .not.toContain('Internal engineering decision');
  });

  test('internal/admin prompt may receive INTERNAL verified knowledge', () => {
    const prompt = buildAssistantPrompt(
      'Mostrami il contesto tecnico',
      [],
      knowledge,
      true
    );

    expect(prompt)
      .toContain('Public marketplace invariant');

    expect(prompt)
      .toContain('Internal engineering decision');
  });
});
