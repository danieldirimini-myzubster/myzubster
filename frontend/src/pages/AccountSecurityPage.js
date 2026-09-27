import React, { useCallback, useEffect, useState } from 'react';
import {
  clearBrowserAuth,
  getAuthSessions,
  getCurrentAccount,
  logoutCurrentSession,
  revokeAuthSession
} from '../api/authSessions';
import './AccountSecurityPage.css';

function formatSessionDate(value) {
  if (!value) return 'Non disponibile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponibile';
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function AccountSecurityPage() {
  const [account, setAccount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountPayload, sessionPayload] = await Promise.all([
        getCurrentAccount(),
        getAuthSessions()
      ]);
      setAccount(accountPayload.user || accountPayload.data?.user || null);
      setSessions(Array.isArray(sessionPayload.sessions) ? sessionPayload.sessions : []);
    } catch (requestError) {
      if (requestError.status === 401) clearBrowserAuth();
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(session) {
    if (!window.confirm(
      session.current
        ? 'Vuoi terminare questa sessione? Dovrai accedere di nuovo.'
        : 'Vuoi revocare l'accesso a questo dispositivo?'
    )) return;

    setWorkingId(session.id);
    setError(null);
    try {
      await revokeAuthSession(session.id);
      if (session.current) {
        clearBrowserAuth();
        window.location.assign('/social-login?returnTo=%2Faccount%2Fsecurity');
        return;
      }
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setNotice('Accesso del dispositivo revocato.');
    } catch (requestError) {
      setError(requestError);
    } finally {
      setWorkingId('');
    }
  }

  async function logout() {
    setWorkingId('logout');
    setError(null);
    try {
      await logoutCurrentSession();
    } catch (requestError) {
      setError(requestError);
    } finally {
      clearBrowserAuth();
      window.location.assign('/social-login?returnTo=%2Fmetaverse');
    }
  }

  if (loading) {
    return <main className="account-security-page"><div className="account-security-card">Caricamento sicurezza account.</div></main>;
  }

  if (error?.status === 401) {
    return (
      <main className="account-security-page">
        <section className="account-security-card">
          <div className="account-security-kicker">MYZUBSTER IDENTITY</div>
          <h1>Sessione non attiva</h1>
          <p>Accedi di nuovo per vedere e gestire i dispositivi collegati al tuo account.</p>
          <a className="account-security-primary" href="/social-login?returnTo=%2Faccount%2Fsecurity">Accedi</a>
          {error.requestId && <small>Request ID: {error.requestId}</small>}
        </section>
      </main>
    );
  }

  return (
    <main className="account-security-page">
      <header className="account-security-header">
        <a href="/metaverse"> Neon Plaza</a>
        <a href="/">Home MyZubster</a>
      </header>

      <section className="account-security-card account-security-hero">
        <div className="account-security-kicker">MYZUBSTER � ACCOUNT SECURITY</div>
        <h1>Sessioni e dispositivi</h1>
        <p>
          Controlla dove � attivo il tuo account e revoca gli accessi che non riconosci.
          Gli indirizzi IP non vengono mostrati n� memorizzati in chiaro.
        </p>
        {account && (
          <div className="account-security-identity">
            <strong>{account.username || account.email}</strong>
            <span>{account.email}</span>
          </div>
        )}
      </section>

      {notice && <div className="account-security-notice" role="status">{notice}</div>}
      {error && (
        <div className="account-security-error" role="alert">
          <strong>{error.message || 'Operazione non riuscita'}</strong>
          {error.requestId && <small>Request ID: {error.requestId}</small>}
        </div>
      )}

      <section className="account-security-card">
        <div className="account-security-section-heading">
          <div>
            <h2>Accessi attivi</h2>
            <p>{sessions.length} {sessions.length === 1 ? 'sessione attiva' : 'sessioni attive'}</p>
          </div>
          <button type="button" className="account-security-secondary" onClick={load}>Aggiorna</button>
        </div>

        <div className="account-security-session-list">
          {sessions.map((session) => (
            <article className={`account-security-session ${session.current ? 'is-current' : ''}`} key={session.id}>
              <div className="account-security-device-icon" aria-hidden="true">{session.current ? '?' : '	'}</div>
              <div className="account-security-session-info">
                <div className="account-security-session-title">
                  <strong>{session.device || 'Dispositivo sconosciuto'}</strong>
                  {session.current && <span>QUESTO DISPOSITIVO</span>}
                </div>
                <dl>
                  <div><dt>Ultima attivit�</dt><dd>{formatSessionDate(session.lastSeenAt)}</dd></div>
                  <div><dt>Creata</dt><dd>{formatSessionDate(session.createdAt)}</dd></div>
                  <div><dt>Scadenza</dt><dd>{formatSessionDate(session.expiresAt)}</dd></div>
                </dl>
              </div>
              <button
                type="button"
                className="account-security-danger"
                disabled={Boolean(workingId)}
                onClick={() => revoke(session)}
              >
                {workingId === session.id ? 'Revoca.' : session.current ? 'Termina' : 'Revoca'}
              </button>
            </article>
          ))}
          {sessions.length === 0 && <p className="account-security-empty">Nessuna sessione attiva trovata.</p>}
        </div>
      </section>

      <section className="account-security-card account-security-logout">
        <div>
          <h2>Esci da questo dispositivo</h2>
          <p>Revoca la sessione server, cancella il cookie sicuro e rimuove i dati di accesso locali.</p>
        </div>
        <button type="button" className="account-security-danger" onClick={logout} disabled={Boolean(workingId)}>
          {workingId === 'logout' ? 'Uscita.' : 'Esci'}
        </button>
      </section>
    </main>
  );
}

export { formatSessionDate };
export default AccountSecurityPage;

