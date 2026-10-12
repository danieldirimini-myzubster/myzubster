import{DEMO_SELLERS,MARKETPLACE_CATEGORIES,MARKETPLACE_COPY,demoPaymentMode,filterDemoSellers,isDemoDeepLink}from'./MarketplacePage';

describe('Marketplace Demo v2',()=>{
  test('uses valid categories and unique demo ids',()=>{
    const allowed=new Set(MARKETPLACE_CATEGORIES),ids=DEMO_SELLERS.map(s=>s.id);
    expect(DEMO_SELLERS.every(s=>allowed.has(s.category))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('keeps marketplace categories selectable without fabricating a demo seller for every category',()=>{
    expect(new Set(MARKETPLACE_CATEGORIES).size).toBe(MARKETPLACE_CATEGORIES.length);
    expect(MARKETPLACE_CATEGORIES).toEqual(expect.arrayContaining(DEMO_SELLERS.map(s=>s.category)));
  });
  test('every demo has a visual, detail content and availability',()=>{expect(DEMO_SELLERS.every(s=>s.icon&&s.description&&s.availability&&Array.isArray(s.details)&&s.details.length)).toBe(true)});
  test('filters demos by category, location, text and payment mode',()=>{expect(filterDemoSellers(DEMO_SELLERS,{category:'pet_adoption'}).map(s=>s.id)).toContain('demo-pet-adoption');expect(filterDemoSellers(DEMO_SELLERS,{location:'Cesena'}).every(s=>s.location.includes('Cesena'))).toBe(true);expect(filterDemoSellers(DEMO_SELLERS,{query:'volontario'}).map(s=>s.id)).toContain('demo-volunteering');expect(filterDemoSellers(DEMO_SELLERS,{payment:'BARTER'}).every(s=>demoPaymentMode(s.price)==='BARTER')).toBe(true)});
  test('specialized community categories expose purpose-specific fields',()=>{for(const category of['volunteering','pet_adoption','pet_lost_found','pet_services']){const demo=DEMO_SELLERS.find(s=>s.category===category);expect(demo.details.length).toBeGreaterThanOrEqual(3)}});
  test('recognizes only the explicit demo deep link',()=>{expect(isDemoDeepLink('?demo=1&utm_source=facebook')).toBe(true);expect(isDemoDeepLink('?demo=0')).toBe(false);expect(isDemoDeepLink('?utm_source=facebook')).toBe(false)});
  test('keeps key UI copy defined and localized',()=>{
    const keys=['title','intro','seller','activate','publish','close','demoSearch','demoDetails','demoConfirm','noDemoMatches'];
    for(const lang of['es','fr','de']) {
      for(const key of keys) expect(typeof MARKETPLACE_COPY[lang][key]).toBe('string');
      for(const key of keys) expect(MARKETPLACE_COPY[lang][key]).not.toBe(MARKETPLACE_COPY.en[key]);
    }
  });
  test('keeps localized benefit lists complete',()=>{for(const lang of['it','es','fr','de'])expect(MARKETPLACE_COPY[lang].benefits).toHaveLength(MARKETPLACE_COPY.en.benefits.length)});
});
