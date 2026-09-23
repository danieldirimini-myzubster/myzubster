'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax professional profile onboarding save', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../public/zorgax-profile-onboarding.html'),
    'utf8'
  );

  test('keeps questionnaire questions focused on the user', () => {
    expect(source).toContain("stai intervistando l'utente sul SUO profilo professionale");
    expect(source).toContain("Non rispondere mai alle domande del questionario come se fossero rivolte a te/Zorgax");
    expect(source).toContain("Non attribuire all'utente capacità di Zorgax");
  });

  test('requires an authenticated explicit approval action before saving', () => {
    expect(source).toContain("fetch('/api/auth/profile/professional'");
    expect(source).toContain("approved:true");
    expect(source).toContain("visibility");
    expect(source).toContain("saveProfessionalProfile('private')");
    expect(source).toContain("saveProfessionalProfile('public')");
  });

  test('supports importing a draft without registering it automatically', () => {
    expect(source).toContain("decodeProfessionalProfileImport()");
    expect(source).toContain("Nessuna bozza professionale da registrare.");
    expect(source).toContain("Bozza importata scartata. Nessun dato è stato registrato.");
  });
});
