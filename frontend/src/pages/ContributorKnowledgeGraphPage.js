import React,{useEffect,useMemo,useState} from 'react';
import './KnowledgeGraphPage.css';

const API='https://www.myzubster.com';
const STARTERS=[
 {id:'nicolaususnicola-lgtm',label:'Nicola · N4K48',legacy:true},
 {id:'jdjioe5-cpu',label:'jdjioe5-cpu · NFC',legacy:false}
];
const TYPE_COLOR={Contributor:'#f59e0b',Knowledge:'#8d7cff',KnowledgeContribution:'#ff4d8d',Evidence:'#21d4b4',Attestation:'#55a9ff',Reward:'#e7c557',Settlement:'#4ade80'};
const linkOf=n=>{const p=n?.properties||{};return [p.reference,p.evidenceReference,p.url].find(u=>typeof u==='string'&&/^https:\/\//i.test(u))||null;};

export default function ContributorKnowledgeGraphPage(){
 const query=new URLSearchParams(window.location.search);
 const [contributor,setContributor]=useState(query.get('contributor')||'jdjioe5-cpu');
 const [draft,setDraft]=useState(query.get('contributor')||'jdjioe5-cpu');
 const [cards,setCards]=useState([]);
 const [catalogError,setCatalogError]=useState('');
 const [graph,setGraph]=useState(null),[passport,setPassport]=useState(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [type,setType]=useState('Tutti'),[selected,setSelected]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>{
  let active=true;
  fetch(API+'/api/knowledge-evidence/public',{cache:'no-store'})
   .then(r=>{if(!r.ok)throw new Error('Catalogo non disponibile');return r.json()})
   .then(data=>{if(active)setCards(Array.isArray(data.cards)?data.cards:[])})
   .catch(e=>{if(active)setCatalogError(e.message)});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  let active=true;setLoading(true);setError('');setGraph(null);setPassport(null);setSelected('');setType('Tutti');
  const encoded=encodeURIComponent(contributor);
  Promise.allSettled([
   fetch(API+'/api/knowledge-graph/contributors/'+encoded,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Knowledge Graph HTTP '+r.status);const data=await r.json();if(data.success===false)throw new Error(data.error||'Knowledge Graph');return data.graph||data}),
   fetch(API+'/api/passports/'+encoded,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Passport HTTP '+r.status);const data=await r.json();if(data.success===false)throw new Error(data.error||'Passport');return data.passport||data})
  ]).then(results=>{
   if(!active)return;
   if(results[0].status==='fulfilled')setGraph(results[0].value);
   if(results[1].status==='fulfilled')setPassport(results[1].value);
   if(results[0].status==='rejected'&&results[1].status==='rejected')setError('Le API contributor non sono raggiungibili dal sito pubblico. Le Knowledge Card pubblicate rimangono consultabili.');
   setLoading(false);
  });
  return()=>{active=false};
 },[contributor]);
 const publishers=useMemo(()=>{
  const map=new Map(STARTERS.map(item=>[item.id,item]));
  cards.forEach(c=>{const name=c.publisherName||c.publisher;if(name&&!map.has(name))map.set(name,{id:name,label:name})});
  return [...map.values()];
 },[cards]);
 const matchingCards=useMemo(()=>cards.filter(c=>(c.publisherName||c.publisher)===contributor),[cards,contributor]);
 const nodes=Array.isArray(graph?.nodes)?graph.nodes:[];
 const edges=Array.isArray(graph?.edges)?graph.edges:[];
 const shown=nodes.filter(n=>(type==='Tutti'||n.type===type)&&(!search||JSON.stringify(n).toLowerCase().includes(search.toLowerCase())));
 const current=nodes.find(n=>n.id===selected)||shown[0];
 const types=['Tutti',...new Set(nodes.map(n=>n.type).filter(Boolean))];
 const positions=new Map(shown.map((n,i)=>[n.id,{x:105+(i%4)*255,y:90+Math.floor(i/4)*155}]));
 const svgHeight=Math.max(350,185+Math.ceil(shown.length/4)*155);
 const visibleEdges=edges.filter(e=>positions.has(e.from)&&positions.has(e.to));
 const selectContributor=event=>{const value=event.target.value;setContributor(value);setDraft(value);window.history.replaceState(null,'','/knowledge-graph?contributor='+encodeURIComponent(value))};
 return <main className="kg-shell">
  <header><a className="kg-back" href="/conoscenze">← Catalogo conoscenze</a><p className="kg-eye">MYZUBSTER · CONTRIBUTOR KNOWLEDGE GRAPH</p><h1>Le conoscenze dei contributori</h1><p>Contributi, concetti dimostrati, evidenze e attestazioni nello stesso percorso navigabile. Le dichiarazioni e le ricompense non equivalgono a competenze verificate.</p></header>
  <section className="kg-contributor-controls" aria-label="Seleziona un contributore">
   <label htmlFor="kg-person">Contributori presenti nel catalogo e pilot</label>
   <select id="kg-person" value={publishers.some(p=>p.id===contributor)?contributor:''} onChange={selectContributor}><option value="" disabled>Contributore personalizzato</option>{publishers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
   <form onSubmit={e=>{e.preventDefault();if(!draft.trim())return;const value=draft.trim();setContributor(value);window.history.replaceState(null,'','/knowledge-graph?contributor='+encodeURIComponent(value))}}>
    <label htmlFor="kg-id">GitHub / ID contributore</label><input id="kg-id" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="GitHub login"/><button className="kg-open" type="submit">Apri grafo</button>
   </form>
  </section>
  <section aria-label="Schede pubblicate"><h2>Knowledge Card · {contributor}</h2>{catalogError&&<p role="status">{catalogError}</p>}{matchingCards.length?<div className="kg-cards">{matchingCards.map(c=><article className="kg-card" key={c._id}><h3>{c.title}</h3><p>{c.description}</p><div className="kg-card-actions"><a href={'/conoscenze?card='+encodeURIComponent(c._id)}>Grafo della scheda</a><a href={API+'/knowledge-card?id='+encodeURIComponent(c._id)} target="_blank" rel="noreferrer">Scheda pubblica</a></div></article>)}</div>:<p>Nessuna Knowledge Card di questo autore caricata dal catalogo. Questo non esclude contributi registrati nel Knowledge Graph.</p>}
   {contributor==='nicolaususnicola-lgtm'&&<p><a className="kg-back" href="/conoscenze?card=6abaaefb3a7460c4574a45fd">Apri il grafo storico N4K48, con Proof v2/v3 e fonti Sepolia →</a></p>}
  </section>
  <section aria-label="Grafo contributore"><h2>Grafo delle conoscenze e delle prove</h2>{loading?<p role="status">Caricamento dei dati pubblici…</p>:error?<p role="status" className="kg-limit">{error}</p>:null}
   {nodes.length>0&&<><p>{nodes.length} nodi · {edges.length} relazioni · {passport?'Passport pubblico disponibile':'Passport non disponibile'}</p>
    <nav aria-label="Filtra tipi di nodo">{types.map(t=><button type="button" key={t} className={t===type?'active':''} onClick={()=>setType(t)}>{t}</button>)}</nav>
    <label htmlFor="kg-search">Cerca nei nodi</label> <input id="kg-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Concetto, PR o evidenza…" />
    <div className="kg-work"><div className="kg-canvas"><svg viewBox={'0 0 1000 '+svgHeight} style={{minWidth:780}} role="img" aria-label={'Knowledge Graph di '+contributor}>{visibleEdges.map((e,i)=><line key={i} x1={positions.get(e.from).x} y1={positions.get(e.from).y} x2={positions.get(e.to).x} y2={positions.get(e.to).y}><title>{e.type}</title></line>)}{shown.map(n=>{const p=positions.get(n.id);return <g key={n.id} className="kg-node" role="button" tabIndex="0" transform={'translate('+p.x+' '+p.y+')'} aria-label={n.type+': '+(n.label||n.id)} onClick={()=>setSelected(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(n.id)}}}><circle r="40" fill={n.id===current?.id?(TYPE_COLOR[n.type]||'#c8d0e5'):'#10182d'} stroke={TYPE_COLOR[n.type]||'#c8d0e5'} strokeWidth="3"/><text y="-4">{String(n.label||n.id).slice(0,14)}</text><text className="type" y="15">{n.type}</text></g>})}</svg></div>
    <aside aria-live="polite">{current&&<><span className="kg-badge concept">{current.type}</span><h2>{current.label||current.id}</h2><p><code>{current.id}</code></p>{Object.entries(current.properties||{}).filter(([,v])=>v!==null&&v!==undefined&&typeof v!=='object').map(([k,v])=><p key={k}><strong>{k}:</strong> {String(v)}</p>)}{linkOf(current)&&<a href={linkOf(current)} target="_blank" rel="noreferrer">Apri evidenza ↗</a>}<h3>Relazioni</h3>{edges.filter(e=>e.from===current.id||e.to===current.id).map((e,i)=><p key={i}>{e.type} · {e.from===current.id?e.to:e.from}</p>)}</>}</aside></div>
    <p className="kg-limit">Stato OBSERVED: evidenza documentata, non verifica indipendente. Le transazioni Monero sono privacy-preserving; un riferimento di transazione da solo non prova pubblicamente destinatario e importo.</p>
   </>}
   {!loading&&!nodes.length&&!error&&<p>Non sono presenti nodi pubblici per questo identificativo.</p>}
  </section>
  <footer>I dati del grafo provengono dalle API MyZubster. Le schede pubbliche rimangono separate dai claim verificati e le identità dei contributori non vengono fuse automaticamente.</footer>
 </main>;
}
