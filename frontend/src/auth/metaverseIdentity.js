import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../api/authenticatedFetch';

const SIGNED_OUT_IDENTITY = Object.freeze({
  authenticated: false,
  user: null,
  character: null
});

function identityError(response, payload) {
  const error = new Error(
    payload.error?.message || payload.message || `Identity request failed (${response.status})`
  );
  error.status = response.status;
  error.code = payload.error?.code || payload.code;
  error.requestId = payload.request_id;
  return error;
}

/**
 * Resolve the browser identity from the server session instead of localStorage.
 * A missing session is an expected guest state, so this probe refreshes silently
 * and never emits the global auth-expired redirect event.
 */
export async function probeMetaverseIdentity() {
  const response = await authenticatedFetch(
    '/api/auth/me',
    { cache: 'no-store' },
    { notifyOnFailure: false }
  );
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) return SIGNED_OUT_IDENTITY;
  if (!response.ok) throw identityError(response, payload);

  return {
    authenticated: true,
    user: payload.data?.user || null,
    character: payload.data?.character || null
  };
}

export function useMetaverseIdentity() {
  const [identity, setIdentity] = useState({
    checking: true,
    ...SIGNED_OUT_IDENTITY,
    error: null
  });

  useEffect(() => {
    let active = true;
    probeMetaverseIdentity()
      .then((result) => {
        if (active) setIdentity({ checking: false, ...result, error: null });
      })
      .catch((error) => {
        if (active) setIdentity({ checking: false, ...SIGNED_OUT_IDENTITY, error });
      });
    return () => { active = false; };
  }, []);

  return identity;
}

export { SIGNED_OUT_IDENTITY };

