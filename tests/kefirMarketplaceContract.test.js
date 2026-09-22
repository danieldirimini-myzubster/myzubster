const fs = require('fs');
const path = require('path');

describe('community marketplace kefir donor contract', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/community-marketplace.html'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/listingRoutes.js'), 'utf8');

  test('offers a dedicated kefir donor category and filter', () => {
    expect(page).toContain('value="kefir_culture_donation"');
    expect(page).toContain('data-filter="kefir_culture_donation"');
  });

  test('forces kefir cultures to remain free donations', () => {
    expect(routes).toMatch(/category==='kefir_culture_donation'\s*&&\s*normalizedCurrency!=='FREE'/);
    expect(routes).toContain('solo come dono gratuito');
  });

  test('requires type and safety acknowledgement', () => {
    expect(routes).toMatch(/\['milk','water'\]\.includes\(kefir\?\.type\)/);
    expect(routes).toMatch(/kefir\?\.safetyAcknowledged\s*!==\s*true/);
  });

  test('keeps free kefir donations outside Seller membership', () => {
    expect(routes).toMatch(/category==='kefir_culture_donation'\s*&&\s*normalized==='FREE'/);
    expect(routes).toContain('const communityExchange=isCommunityExchange(requestedCategory,requestedCurrency)');
    expect(routes).toContain('if(!communityExchange)');
  });
});
