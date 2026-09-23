'use strict';

const fs = require('fs');
const path = require('path');

describe('Zorgax social login UI', () => {
  const page = fs.readFileSync(path.join(__dirname, '../frontend/src/pages/SocialLoginPage.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/authRoutes.js'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/socialAuthController.js'), 'utf8');

  test('exposes only provider availability booleans', () => {
    expect(routes).toContain("router.get('/social/providers', socialAuthController.providers)");
    expect(controller).toMatch(/data\s*:\s*\{\s*providers\s*:\s*providerAvailability\(\)\s*\}/);
    expect(controller).not.toContain('data: { providers: process.env');
  });

  test('normalizes accidental whitespace in OAuth deployment variables', () => {
    expect(controller).toContain("'GOOGLE_LOGIN_CLIENT_ID'");
    expect(controller).toContain("'GOOGLE_LOGIN_CLIENT_SECRET'");
    expect(controller).toContain("process.env[key] = process.env[key].trim()");
  });

  test('renders configured social providers', () => {
    expect(page).toContain("fetch('/api/auth/social/providers')");
    expect(page).toContain("oauthHref('google')");
    expect(page).toContain("oauthHref('github')");
    expect(page).toContain("oauthHref('facebook')");
  });

  test('exchanges the short-lived OAuth ticket for the normal MyZubster session', () => {
    expect(page).toContain("fetch('/api/auth/social/exchange-ticket'");
    expect(page).toMatch(/localStorage\.setItem\(['"]myzubster-token['"]\s*,\s*\w+\.data\.token\)/);
    expect(page).toContain('finishReturnTo()');
    expect(page).toContain('window.location.assign(destination)');
  });

  test('preserves a safe return path across authentication', () => {
    expect(page).toMatch(/const\s+RETURN_TO_KEY\s*=\s*['"]myzubster-login-return-to['"]/);
    expect(page).toMatch(/\.startsWith\(['"]\/['"]\)\s*&&\s*!\w+\.startsWith\(['"]\/\/['"]\)/);
    expect(page).toMatch(/sessionStorage\.setItem\(RETURN_TO_KEY\s*,/);
  });
});
