const request = require('supertest');
const app = require('../index');

describe('MyZubster metaverse API', () => {
  let sessionId;
  let sessionToken;

  test('reports an explicit degraded health status without MongoDB', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await request(app)
      .get('/api/metaverse/health')
      .expect(503);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      success: false,
      status: 'degraded',
      worldId: 'neon-plaza',
      transport: 'unavailable',
      mongodb: 'disconnected'
    });
    warning.mockRestore();
  });

  test('joins Neon Plaza as a guest identity', async () => {
    const response = await request(app)
      .post('/api/metaverse/join')
      .send({
        displayName: 'Demo User',
        characterName: 'AERON-17',
        archetype: 'explorer',
        myzId: 'MYZ-DEMO-000001'
      })
      .expect(201);

    sessionId = response.body.sessionId;
    sessionToken = response.body.sessionToken;
    expect(response.body.success).toBe(true);
    expect(sessionToken).toEqual(expect.any(String));
    expect(sessionToken.length).toBeGreaterThanOrEqual(32);
    expect(response.body.sessionTtlSeconds).toBe(90);
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(response.body.player).not.toHaveProperty('sessionToken');
    expect(response.body.player).not.toHaveProperty('sessionTokenHash');
    expect(response.body.player.characterName).toBe('AERON-17');
    expect(response.body.player.identityStatus).toBe('guest');
    expect(response.body.identityMode).toBe('guest-unverified');
    expect(response.body.totalCharacters).toBeGreaterThanOrEqual(1);
    // The isolated API test intentionally has no Mongo connection. Production
    // server.js gates /join on Mongo and therefore returns "durable" there.
    expect(response.body.persistence).toBe('ephemeral');
  });

  test('moves a joined player inside world bounds', async () => {
    const response = await request(app)
      .post('/api/metaverse/move')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId, x: 500, y: -50 })
      .expect(200);

    expect(response.body.player.x).toBe(96);
    expect(response.body.player.y).toBe(8);
  });

  test('rejects attempts to control a public player id without its secret token', async () => {
    await request(app)
      .post('/api/metaverse/move')
      .set('X-Metaverse-Session-Token', 'attacker-controlled-token')
      .send({ sessionId, x: 4, y: 88 })
      .expect(401);

    await request(app)
      .post('/api/metaverse/move')
      .send({ sessionId, x: 4, y: 88 })
      .expect(401);

    const syncResponse = await request(app)
      .post('/api/metaverse/sync')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId })
      .expect(200);
    const player = syncResponse.body.players.find((candidate) => candidate.id === sessionId);
    expect(player).toMatchObject({ x: 96, y: 8 });
  });

  test('rotates the private credential and invalidates the previous token', async () => {
    const previousToken = sessionToken;
    const response = await request(app)
      .post('/api/metaverse/session/rotate')
      .set('X-Metaverse-Session-Token', previousToken)
      .send({ sessionId })
      .expect(200);

    sessionToken = response.body.sessionToken;
    expect(sessionToken).toEqual(expect.any(String));
    expect(sessionToken).not.toBe(previousToken);
    expect(response.body.sessionTtlSeconds).toBe(90);
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    await request(app)
      .post('/api/metaverse/sync')
      .set('X-Metaverse-Session-Token', previousToken)
      .send({ sessionId })
      .expect(401);

    const syncResponse = await request(app)
      .post('/api/metaverse/sync')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId })
      .expect(200);

    expect(syncResponse.body.sessionTtlSeconds).toBe(90);
    expect(new Date(syncResponse.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('lists the active player and public character total in the world snapshot', async () => {
    const response = await request(app)
      .get('/api/metaverse/world')
      .expect(200);

    expect(response.body.players.some((player) => player.id === sessionId)).toBe(true);
    expect(response.body.players).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionToken: expect.anything() })
    ]));
    expect(response.body.players).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionTokenHash: expect.anything() })
    ]));
    expect(response.body.totalCharacters).toBeGreaterThanOrEqual(1);
    expect(response.body.featuredCharacters).toEqual([]);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-metaverse-transport']).toBe('unavailable');
  });

  test('shares presence and recent chat through the sync endpoint', async () => {
    const chatResponse = await request(app)
      .post('/api/metaverse/chat')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId, text: 'Ciao Neon Plaza' })
      .expect(201);

    const syncResponse = await request(app)
      .post('/api/metaverse/sync')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId })
      .expect(200);

    expect(syncResponse.body.transport).toBe('ephemeral');
    expect(syncResponse.body.players.some((player) => player.id === sessionId)).toBe(true);
    expect(syncResponse.body.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: chatResponse.body.message.id,
        characterName: 'AERON-17',
        text: 'Ciao Neon Plaza'
      })
    ]));
    expect(new Date(syncResponse.body.cursor).toString()).not.toBe('Invalid Date');
  });

  test('returns retry guidance when a mutation exceeds its minimum interval', async () => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    await request(app)
      .post('/api/metaverse/chat')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId, text: 'First message after cooldown' })
      .expect(201);

    const response = await request(app)
      .post('/api/metaverse/chat')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId, text: 'Immediate duplicate burst' })
      .expect(429);

    expect(response.headers['retry-after']).toBe('1');
    expect(response.body).toMatchObject({
      success: false,
      error: 'Chat rate exceeded',
      retryAfterMs: 700
    });
  });

  test('keeps an emote visible across a browser synchronization interval', async () => {
    await request(app)
      .post('/api/metaverse/emote')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId, emote: 'wave' })
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 2100));

    const syncResponse = await request(app)
      .post('/api/metaverse/sync')
      .set('X-Metaverse-Session-Token', sessionToken)
      .send({ sessionId })
      .expect(200);

    expect(syncResponse.body.players.find((player) => player.id === sessionId)?.emote).toBe('wave');
  });

  test('prunes an abandoned in-memory session after its lease expires', async () => {
    jest.useFakeTimers({ now: Date.now() });
    try {
      const joined = await request(app)
        .post('/api/metaverse/join')
        .send({
          displayName: 'Temporary User',
          characterName: 'LEASE-TEST',
          archetype: 'explorer'
        })
        .expect(201);

      jest.advanceTimersByTime(91 * 1000);

      const world = await request(app)
        .get('/api/metaverse/world')
        .expect(200);
      expect(world.body.players.some((player) => player.id === joined.body.sessionId)).toBe(false);

      await request(app)
        .post('/api/metaverse/sync')
        .set('X-Metaverse-Session-Token', joined.body.sessionToken)
        .send({ sessionId: joined.body.sessionId })
        .expect(404);
    } finally {
      jest.useRealTimers();
    }
  });

  afterAll(async () => {
    if (sessionId && sessionToken) {
      await request(app)
        .post('/api/metaverse/leave')
        .set('X-Metaverse-Session-Token', sessionToken)
        .send({ sessionId });
    }
  });
});
