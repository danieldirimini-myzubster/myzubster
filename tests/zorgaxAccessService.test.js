'use strict';

const {
  getAccess,
  getAccessPolicy,
  guestAccess,
  meetsPlan
} = require('../src/services/zorgaxAccessService');

describe('Zorgax unified access service', () => {
  test('selects a paid entitlement when it outranks sponsored Free access', async () => {
    const access = await getAccess('user-1', {
      entitlementAccessFn: jest.fn().mockResolvedValue({
        tier: 'PRO',
        active: true,
        source: 'PURCHASE',
        endsAt: new Date('2026-10-01T00:00:00Z')
      }),
      sponsoredAccessFn: jest.fn().mockResolvedValue({ tier: 'FREE', active: true })
    });

    expect(access).toMatchObject({
      ownerId: 'user-1',
      plan: 'pro',
      tier: 'PRO',
      source: 'ENTITLEMENT'
    });
  });

  test('selects a Developer entitlement over sponsored Pro access', async () => {
    const access = await getAccess('user-1', {
      entitlementAccessFn: jest.fn().mockResolvedValue({ tier: 'DEVELOPER', active: true }),
      sponsoredAccessFn: jest.fn().mockResolvedValue({ tier: 'PRO', active: true })
    });

    expect(access.plan).toBe('developer');
    expect(access.source).toBe('ENTITLEMENT');
    expect(meetsPlan(access, 'developer')).toBe(true);
  });

  test('selects sponsored Developer pilot access without a payment source', async () => {
    const access = await getAccess('user-1', {
      entitlementAccessFn: jest.fn().mockResolvedValue({ tier: 'FREE', active: true }),
      sponsoredAccessFn: jest.fn().mockResolvedValue({
        tier: 'DEVELOPER',
        active: true,
        status: 'ACTIVE',
        expiresAt: null
      })
    });

    expect(access).toMatchObject({
      ownerId: 'user-1',
      plan: 'developer',
      tier: 'DEVELOPER',
      source: 'SPONSORED_PILOT',
      expiresAt: null
    });
    expect(meetsPlan(access, 'developer')).toBe(true);
  });

  test('keeps a paid entitlement when the sponsored-access store is unavailable', async () => {
    const access = await getAccess('user-1', {
      entitlementAccessFn: jest.fn().mockResolvedValue({ tier: 'PRO', active: true }),
      sponsoredAccessFn: jest.fn().mockRejectedValue(new Error('sponsor store unavailable'))
    });

    expect(access.plan).toBe('pro');
    expect(access.sourcesChecked).toEqual(['ENTITLEMENT']);
  });

  test('fails closed when no access source can be checked', async () => {
    await expect(getAccess('user-1', {
      entitlementAccessFn: jest.fn().mockRejectedValue(new Error('entitlement store unavailable')),
      sponsoredAccessFn: jest.fn().mockRejectedValue(new Error('sponsor store unavailable'))
    })).rejects.toThrow('entitlement store unavailable');
  });

  test('applies guest, Free, Pro and Developer feature limits', () => {
    expect(getAccessPolicy(guestAccess(), { authenticated: false })).toMatchObject({
      webResearch: false,
      maxWebResults: 0,
      workspace: false,
      directApi: false
    });

    expect(getAccessPolicy({ plan: 'free' })).toMatchObject({
      researchMode: 'LIMITED',
      maxWebResults: 2,
      workspace: false,
      directApi: false
    });

    expect(getAccessPolicy({ plan: 'pro' })).toMatchObject({
      maxWebResults: 5,
      workspace: true,
      directApi: false
    });

    expect(getAccessPolicy({ plan: 'developer' })).toMatchObject({
      maxWebResults: 8,
      workspace: true,
      directApi: true
    });
  });
});
