'use strict';

const fs = require('fs');
const path = require('path');

describe('public professional profile page', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/professional-profile.html'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

  test('renders public profile data from the unauthenticated endpoint', () => {
    expect(html).toContain("'/api/users/'+encodeURIComponent(username)+'/professional-profile'");
    expect(html).not.toContain('Authorization');
    expect(html).toContain('Competenze');
    expect(html).toContain('Esperienze');
    expect(html).toContain('Evidenze');
  });

  test('supports canonical /profile/:username route on Vercel', () => {
    expect(vercel.builds.some(b => b.src === 'public/professional-profile.html')).toBe(true);
    expect(vercel.routes.some(r => r.src === '/profile/([^/]+)/?' && r.dest === '/public/professional-profile.html')).toBe(true);
  });

  test('supports the same route in the Express runtime', () => {
    expect(server).toContain("app.get(/^\\/profile\\/[^/]+\\/?$/");
    expect(server).toContain("professional-profile.html");
  });
});
