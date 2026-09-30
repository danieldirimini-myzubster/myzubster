import { AUTH_EXPIRED_EVENT } from '../api/authenticatedFetch';
import {
  bindAuthExpiryRedirect,
  expiredSessionLoginUrl,
  safeReturnPath
} from './authExpiryRedirect';

test('preserves a local room invite path through login', () => {
  const location = {
    pathname: '/metaverse/rooms/private-room',
    search: '?invite=one-time-code',
    hash: '#stage'
  };

  expect(safeReturnPath(location)).toBe('/metaverse/rooms/private-room?invite=one-time-code#stage');
  expect(expiredSessionLoginUrl(location)).toBe(
    '/social-login?returnTo=%2Fmetaverse%2Frooms%2Fprivate-room%3Finvite%3Done-time-code%23stage'
  );
});

test('rejects a protocol-relative return target', () => {
  expect(safeReturnPath({ pathname: '//attacker.example/path' })).toBe('/metaverse');
});

test('redirects once when concurrent polling failures emit repeated expiry events', () => {
  const eventTarget = new EventTarget();
  const navigate = jest.fn();
  const unbind = bindAuthExpiryRedirect({
    eventTarget,
    locationLike: { pathname: '/metaverse', search: '', hash: '' },
    navigate
  });

  eventTarget.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  eventTarget.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));

  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('/social-login?returnTo=%2Fmetaverse');

  unbind();
  eventTarget.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  expect(navigate).toHaveBeenCalledTimes(1);
});

