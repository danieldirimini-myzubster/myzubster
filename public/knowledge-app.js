'use strict';

const $ = selector => document.querySelector(selector);
const locale = document.body.dataset.locale === 'it' ? 'it' : 'en';

const strings = {
  en: {
    loading: 'Loading verified knowledge…',
    unavailable: 'Verified Knowledge is temporarily unavailable.',
    empty: 'No PUBLIC verified knowledge matches this search.',
    count: n => `${n} verified ${n === 1 ? 'record' : 'records'}`,
    version: 'Version',
    category: 'Category',
    source: 'Source',
    evidence: 'Evidence',
    hash: 'Content hash',
    lineage: 'Supersedes',
    updated: 'Updated',
    visibility: 'Visibility',
    openReference: 'Open reference'
  },
  it: {
    loading: 'Caricamento conoscenza verificata…',
    unavailable: 'La Knowledge verificata non è temporaneamente disponibile.',
    empty: 'Nessuna Knowledge PUBLIC e verificata corrisponde alla ricerca.',
    count: n => `${n} ${n === 1 ? 'record verificato' : 'record verificati'}`,
    version: 'Versione',
    category: 'Categoria',
    source: 'Fonte',
    evidence: 'Evidenze',
    hash: 'Content hash',
    lineage: 'Sostituisce',
    updated: 'Aggiornata',
    visibility: 'Visibilità',
    openReference: 'Apri riferimento'
  }
};

const t = strings[locale];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function meta(label, value) {
  if (value === null || value === undefined || value === '') return '';
  return `<div class="meta"><b>${esc(label)}</b><span>${esc(value)}</span></div>`;
}

function sourceLabel(item) {
  const parts = [
    item.source?.type,
    item.source?.reference
  ].filter(Boolean);
  return parts.join(' · ') || '—';
}

function referenceBlock(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const href = safeUrl(raw);
  if (href) {
    return `<a class="reference" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(t.openReference)}</a>`;
  }
  return `<code class="reference-code">${esc(raw)}</code>`;
}

function evidenceList(values) {
  const evidence = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!evidence.length) return '';
  return `
    <div class="evidence">
      <strong>${esc(t.evidence)}</strong>
      <ul>${evidence.map(value => `<li>${esc(value)}</li>`).join('')}</ul>
    </div>
  `;
}

function card(item) {
  const hash = String(item.contentHash || '');
  const shortHash = hash ? `${hash.slice(0, 14)}…` : '—';
  const status = item.status || 'VERIFIED';
  const visibility = item.visibility || 'PUBLIC';

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="record-id">${esc(item.contributionId || item.id || 'KNOWLEDGE')}</div>
          <h2>${esc(item.title || 'Untitled knowledge')}</h2>
        </div>
        <div class="badges">
          <span class="badge verified">${esc(status)}</span>
          <span class="badge public">${esc(visibility)}</span>
        </div>
      </div>

      <p class="description">${esc(item.description || '')}</p>

      <div class="meta-grid">
        ${meta(t.version, Math.max(1, Number(item.version) || 1))}
        ${meta(t.category, item.category || 'general')}
        ${meta(t.source, sourceLabel(item))}
        ${meta(t.hash, shortHash)}
        ${meta(t.lineage, item.supersedesContributionId || '—')}
        ${meta(t.updated, item.updatedAt || item.reviewedAt || item.publishedAt || '—')}
      </div>

      ${referenceBlock(item.reference)}
      ${evidenceList(item.evidenceRefs)}

      ${hash ? `
        <details>
          <summary>${esc(t.hash)}</summary>
          <code class="full-hash">${esc(hash)}</code>
        </details>
      ` : ''}
    </article>
  `;
}

async function loadKnowledge() {
  const status = $('#status');
  const records = $('#records');
  const query = $('#search').value.trim();

  status.textContent = t.loading;
  records.innerHTML = '';

  const url = new URL('/api/zorgax/knowledge/search', location.origin);
  if (query) url.searchParams.set('q', query);
  url.searchParams.set('limit', '20');

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success !== true) {
      throw new Error(payload.message || response.statusText);
    }

    const items = Array.isArray(payload.items)
      ? payload.items.filter(item =>
          item &&
          item.visibility === 'PUBLIC' &&
          ['APPROVED', 'REWARD_ELIGIBLE', 'REWARDED'].includes(item.status)
        )
      : [];

    status.textContent = items.length ? t.count(items.length) : t.empty;
    records.innerHTML = items.map(card).join('');
  } catch (_error) {
    status.textContent = t.unavailable;
    records.innerHTML = '';
  }
}

$('#searchButton').addEventListener('click', loadKnowledge);
$('#search').addEventListener('keydown', event => {
  if (event.key === 'Enter') loadKnowledge();
});

loadKnowledge();
