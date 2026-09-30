import { AUTH_EXPIRED_EVENT } from '../api/authenticatedFetch';

export function safeReturnPath(locationLike) {
  const pathname = String(locationLike?.pathname || '/metaverse');
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/metaverse';
  const search = String(locationLike?.search || '');
  const hash = String(locationLike?.hash || '');
  return `${pathname}${search}${hash}`;
}

export function expiredSessionLoginUrl(locationLike) {
  return `/social-login?returnTo=${encodeURIComponent(safeReturnPath(locationLike))}`;
}

/**
 * Redirects an expired Metaverse session to login while preserving the exact
 * local room/invite path. Multiple failing poll requests still navigate once.
 */
export function bindAuthExpiryRedirect({
  eventTarget,
  locationLike,
  navigate
} = {}) {
  const browserWindow = typeof window !== 'undefined' ? window : null;
  const target = eventTarget || browserWindow;
  const location = locationLike || browserWindow?.location;
  const go = navigate || ((url) => browserWindow?.location.assign(url));
  if (!target?.addEventListener || !target?.removeEventListener) return () => {};

  let redirecting = false;
  const onExpired = () => {
    if (redirecting) return;
    redirecting = true;
    go(expiredSessionLoginUrl(location));
  };

  target.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
  return () => target.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
}

