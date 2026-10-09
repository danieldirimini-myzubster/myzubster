import { LANDMARKS, sanitizeVisitedLandmarks } from './MetaversePage';
import {
  leaveMetaverse,
  moveMetaversePlayer,
  sendMetaverseChat,
  sendMetaverseEmote,
  syncMetaverse
} from '../api/metaverse';

describe('Neon Plaza mission progress', () => {
  test('keeps only known landmark ids and removes duplicates', () => {
    expect(sanitizeVisitedLandmarks(['identity', 'identity', 'unknown', null, 'marketplace']))
      .toEqual(['identity', 'marketplace']);
  });

  test('accepts every configured landmark', () => {
    const ids = LANDMARKS.map((landmark) => landmark.id);
    expect(sanitizeVisitedLandmarks(ids)).toEqual(ids);
  });

  test('rejects malformed stored progress', () => {
    expect(sanitizeVisitedLandmarks(null)).toEqual([]);
    expect(sanitizeVisitedLandmarks({ identity: true })).toEqual([]);
  });

  test('declares a stable set of server-supported landmark identifiers', () => {
    expect(LANDMARKS.map((landmark) => landmark.id)).toEqual([
      'identity', 'marketplace', 'projects', 'visual', 'zorgax', 'creator'
    ]);
  });
});

describe('Neon Plaza session ownership', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends the private session token with every mutable world request', async () => {
    await syncMetaverse('public-id', 'private-token', 'cursor');
    await moveMetaversePlayer('public-id', 'private-token', 10, 20);
    await sendMetaverseChat('public-id', 'private-token', 'hello');
    await sendMetaverseEmote('public-id', 'private-token', 'wave');
    await leaveMetaverse('public-id', 'private-token');

    expect(global.fetch).toHaveBeenCalledTimes(5);
    for (const [, options] of global.fetch.mock.calls) {
      expect(JSON.parse(options.body)).toMatchObject({
        sessionId: 'public-id',
        sessionToken: 'private-token'
      });
    }
  });
});
