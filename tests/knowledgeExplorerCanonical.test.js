const fs = require('fs');
const path = require('path');

describe('canonical Knowledge Explorer', () => {
  const root = path.join(__dirname, '..');
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');

  test('bilingual pages use the canonical Knowledge runtime', () => {
    for (const file of ['public/knowledge.html', 'public/conoscenze.html']) {
      const html = read(file);
      expect(html).toMatch(/knowledge-app\.js/);
      expect(html).toMatch(/knowledge\.css/);
      expect(html).toMatch(/danieldirimini-myzubster\/myzubster/);
    }
  });

  test('browser queries all PUBLIC Knowledge and keeps verification as metadata', () => {
    const js = read('public/knowledge-app.js');
    const route = read('src/routes/zorgaxKnowledgeRoutes.js');
    expect(js).toMatch(/\/api\/zorgax\/knowledge\/search/);
    expect(js).toMatch(/visibility === 'PUBLIC'/);
    expect(js).not.toMatch(/\.includes\(item\.status\)/);
    expect(js).toMatch(/badge \$\{verified \? 'verified' : 'unverified'\}/);
    expect(route).toMatch(/searchPublicKnowledge/);
    expect(route).toMatch(/public_only:\s*true/);
    expect(route).toMatch(/verified_only:\s*false/);
    expect(js).toMatch(/contentHash/);
    expect(js).toMatch(/supersedesContributionId/);
    expect(js).toMatch(/evidenceRefs/);
  });

  test('public pages describe the explorer as all-public, not verified-only', () => {
    const en = read('public/knowledge.html');
    const it = read('public/conoscenze.html');

    expect(en).toMatch(/Public Knowledge Explorer/);
    expect(en).toMatch(/PUBLIC knowledge · status shown/);
    expect(it).toMatch(/Esplora le Conoscenze Pubbliche/);
    expect(it).toMatch(/tutte le PUBLIC · stato visibile/);

    expect(en).not.toMatch(/PUBLIC \+ VERIFIED only/);
    expect(it).not.toMatch(/solo PUBLIC \+ VERIFIED/);
  });

  test('Vercel keeps Knowledge API on the canonical Express app', () => {
    const vercel = read('vercel.json');
    expect(vercel).toMatch(/\/api\/zorgax\/knowledge\/\(\.\*\).*\/api\/index\.js/);
    expect(vercel).toMatch(/\/knowledge\/\?[^\n]*public\/knowledge\.html/);
    expect(vercel).toMatch(/\/conoscenze\/\?[^\n]*public\/conoscenze\.html/);
  });

  test('frontend remains read-only', () => {
    const js = read('public/knowledge-app.js');
    expect(js).not.toMatch(/method\s*:\s*['"]POST['"]/i);
    expect(js).not.toMatch(/method\s*:\s*['"]PATCH['"]/i);
    expect(js).not.toMatch(/method\s*:\s*['"]DELETE['"]/i);
  });
});
