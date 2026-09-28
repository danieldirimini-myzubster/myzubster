'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'csrf-protection-test-secret';

const {
  isTrustedMutationRequest,
  requireTrustedOrigin
} = require('../src/middleware/csrf');

function request({ method = 'POST', protocol = 'https', headers = {} } = {}) {
  return {
    method,
    protocol,
    headers,
    get(name) {
      return headers[String(name).toLowerCase()];
    }
  };
}

function response() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  delete process.env.AUTH_TRUSTED_ORIGINS;
  delete process.env.FRONTEND_URL;
  delete process.env.PUBLIC_APP_URL;
  delete process.env.GATEWAY_PUBLIC_URL;
});

test('allows safe requests without origin checks', () => {
  expect(isTrustedMutationRequest(request({
    method: 'GET',
    headers: { origin: 'https://attacker.example' }
  }))).toBe(true);
});

test('allows a same-origin browser mutation', () => {
  expect(isTrustedMutationRequest(request({
    headers: {
      host: 'www.myzubster.com',
      origin: 'https://www.myzubster.com',
      'sec-fetch-site': 'same-origin'
    }
  }))).toBe(true);
});

test('allows an explicitly configured frontend origin', () => {
  process.env.AUTH_TRUSTED_ORIGINS = 'https://app.myzubster.com, https://preview.myzubster.com';
  expect(isTrustedMutationRequest(request({
    headers: {
      host: 'api.myzubster.com',
      origin: 'https://app.myzubster.com',
      'sec-fetch-site': 'same-site'
    }
  }))).toBe(true);
});

test('rejects a cross-site browser mutation with a structured error', () => {
  const req = request({
    headers: {
      host: 'www.myzubster.com',
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site'
    }
  });
  const res = response();
  const next = jest.fn();

  requireTrustedOrigin(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    request_id: expect.any(String),
    error: {
      code: 'AUTH_CSRF_REJECTED',
      message: 'Origine della richiesta non autorizzata'
    }
  }));
});

test('rejects an untrusted origin even without Fetch Metadata', () => {
  expect(isTrustedMutationRequest(request({
    headers: {
      host: 'www.myzubster.com',
      origin: 'https://attacker.example'
    }
  }))).toBe(false);
});

test('retains non-browser server clients that send neither Origin nor Fetch Metadata', () => {
  expect(isTrustedMutationRequest(request({
    headers: { host: 'www.myzubster.com' }
  }))).toBe(true);
});

