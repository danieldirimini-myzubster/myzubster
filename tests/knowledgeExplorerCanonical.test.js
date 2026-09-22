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

  test('browser queries the Zorgax verified Knowledge endpoint', () => {
    const js = read('public/knowledge-app.js');
    expect(js).toMatch(/\/api\/zorgax\/knowledge\/search/);
    expect(js).toMatch(/visibility === 'PUBLIC'/);
    expect(js).toMatch(/APPROVED/);
    expect(js).toMatch(/REWARD_ELIGIBLE/);
    expect(js).toMatch(/REWARDED/);
    expect(js).toMatch(/contentHash/);
    expect(js).toMatch(/supersedesContributionId/);
    expect(js).toMatch(/evidenceRefs/);
  });

  test('frontend remains read-only', () => {
    const js = read('public/knowledge-app.js');
    expect(js).not.toMatch(/method\s*:\s*['"]POST['"]/i);
    expect(js).not.toMatch(/method\s*:\s*['"]PATCH['"]/i);
    expect(js).not.toMatch(/method\s*:\s*['"]DELETE['"]/i);
  });
});
