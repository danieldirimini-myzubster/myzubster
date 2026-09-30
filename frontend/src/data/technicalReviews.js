// Public editorial records: authors are attributed to the source, not linked accounts.
export const technicalReviews = [{
  id: 'mike-evidence-review-2026-09-30',
  title: 'Verifica, finalità e privacy delle evidenze',
  author: 'Mike Dabydeen',
  date: '2026-09-30',
  source: 'https://coderlegion.com/29295/building-evidence-systems-that-know-what-they-cannot-prove?show=29309#a29309',
  task: 'https://linear.app/myzubster/issue/MYZ-214/mike-dabydeen-attribuire-la-revisione-tecnica-e-rafforzare-verifica',
  status: 'Revisione tecnica · proposte da implementare',
  summary: 'Osservazioni pubbliche su chi verifica le evidenze, sulla finalità delle transazioni e sulla protezione dei dati riservati.',
  observations: [
    { id: 'verifica', title: 'Chi verifica la prova', description: 'Registrare chi ha effettuato il controllo, con quale metodo, quando e su quali fonti. Distinguere una dichiarazione della pipeline da una revisione indipendente.' },
    { id: 'finalita', title: 'Finalità osservata', description: 'Documentare blocco e momento del controllo, distinguendo inclusione e finalizzazione e gestendo eventuali riorganizzazioni. Per L2, esplicitare lo stato pertinente su L1.' },
    { id: 'privacy', title: 'Digest e dati riservati', description: 'Valutare la protezione dei digest di dati con pochi valori possibili: il semplice hash pubblico può consentire tentativi di ricostruzione. La scelta di salting o keying richiede verifica.' }
  ]
}];
