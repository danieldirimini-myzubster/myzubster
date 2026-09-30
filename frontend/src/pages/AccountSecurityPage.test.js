import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AccountSecurityPage, { formatSessionDate } from './AccountSecurityPage';
import {
  getAuthSessions,
  getCurrentAccount,
  revokeAuthSession
} from '../api/authSessions';

jest.mock('../api/authSessions', () => ({
  clearBrowserAuth: jest.fn(),
  getAuthSessions: jest.fn(),
  getCurrentAccount: jest.fn(),
  logoutCurrentSession: jest.fn(),
  revokeAuthSession: jest.fn()
}));

describe('AccountSecurityPage', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    getCurrentAccount.mockResolvedValue({ data: { user: { username: 'Daniel', email: 'daniel@example.test' } } });
    getAuthSessions.mockResolvedValue({
      sessions: [
        {
          id: 'current-session',
          current: true,
          device: 'Current browser',
          createdAt: '2026-09-27T08:00:00.000Z',
          lastSeenAt: '2026-09-27T09:00:00.000Z',
          expiresAt: '2026-10-04T08:00:00.000Z'
        },
        {
          id: 'old-phone',
          current: false,
          device: 'Old phone',
          createdAt: '2026-09-20T08:00:00.000Z',
          lastSeenAt: '2026-09-21T09:00:00.000Z',
          expiresAt: '2026-09-28T08:00:00.000Z'
        }
      ]
    });
    revokeAuthSession.mockResolvedValue({ success: true });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  test('shows the current device and active session metadata', async () => {
    await act(async () => {
      root.render(<AccountSecurityPage />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Daniel');
    expect(container.textContent).toContain('2 sessioni attive');
    expect(container.textContent).toContain('Current browser');
    expect(container.textContent).toContain('QUESTO DISPOSITIVO');
    expect(container.textContent).toContain('Old phone');
  });

  test('revokes a remote device and removes it from the active list', async () => {
    await act(async () => {
      root.render(<AccountSecurityPage />);
      await Promise.resolve();
    });
    const revokeButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Revoca');

    await act(async () => {
      revokeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(revokeAuthSession).toHaveBeenCalledWith('old-phone');
    expect(container.textContent).not.toContain('Old phone');
    expect(container.textContent).toContain('Accesso del dispositivo revocato.');
  });

  test('formats valid timestamps and safely handles invalid values', () => {
    expect(formatSessionDate('not-a-date')).toBe('Non disponibile');
    expect(formatSessionDate(null)).toBe('Non disponibile');
    expect(formatSessionDate('2026-09-27T09:00:00.000Z')).not.toBe('Non disponibile');
  });
});

