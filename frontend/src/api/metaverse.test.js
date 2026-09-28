jest.mock('./authenticatedFetch', () => ({
  authenticatedFetch: jest.fn()
}));

import { authenticatedFetch } from './authenticatedFetch';
import {
  getMetaverseProfile,
  sendMetaverseRoomMessage
} from './metaverse';

beforeEach(() => {
  authenticatedFetch.mockReset();
});

test('routes protected Metaverse APIs through the renewable session client', async () => {
  authenticatedFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true })
  });

  await getMetaverseProfile();
  await sendMetaverseRoomMessage('session/1', 'Hello');

  expect(authenticatedFetch).toHaveBeenNthCalledWith(
    1,
    '/api/metaverse/profile',
    expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' })
    })
  );
  expect(authenticatedFetch).toHaveBeenNthCalledWith(
    2,
    '/api/metaverse/sessions/session%2F1/messages',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ text: 'Hello' })
    })
  );
});

test('preserves structured authentication failures for the Metaverse UI', async () => {
  authenticatedFetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({
      request_id: 'request-42',
      error: { code: 'AUTH_SESSION_REVOKED', message: 'Session revoked' }
    })
  });

  await expect(getMetaverseProfile()).rejects.toMatchObject({
    message: 'Session revoked',
    status: 401,
    code: 'AUTH_SESSION_REVOKED',
    requestId: 'request-42'
  });
});

