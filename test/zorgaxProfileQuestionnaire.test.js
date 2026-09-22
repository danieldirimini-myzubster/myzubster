'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax profile questionnaire perspective', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../public/zorgax-profile-onboarding.html'),
    'utf8'
  );

  test('keeps questionnaire questions focused on the user', () => {
    expect(source).toContain("stai intervistando l'utente sul SUO profilo professionale");
    expect(source).toContain("Non rispondere mai alle domande del questionario come se fossero rivolte a te/Zorgax");
    expect(source).toContain("Non attribuire all'utente capacità di Zorgax");
  });
});
