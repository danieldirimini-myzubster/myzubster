import React,{useEffect,useMemo,useState} from 'react';
import {knowledgeArticles} from '../data/knowledge';
import './KnowledgeGraphPage.css';
import {technicalReviews} from '../data/technicalReviews';
import TechnicalReviewGraph from './TechnicalReviewGraph';
import {buildEvidenceNodes,buildVersionedProofNodes} from './knowledgeGraphEvidence';

const color={article:'#ff4d8d',source:'#21d4b4',concept:'#8d7cff',person:'#f59e0b',proof:'#55a9ff'};
const slug=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'KNOWLEDGE';
const proofCardId='6abaaefb3a7460c4574a45fd';
const digest='6097e05866bafceec24663d2638cb1dae5742ac78284abbfd45cc9c3b0bfb845';
const proofV3={
 digest:'d1c89d2a4157a159b56e92825ca59fdb1f0e84e003b05e022af67da69ed25ac4',
 payload:'https://github.com/nicolaususnicola-lgtm/myzubster-mvp/commit/e57261a325625057350aa059ca142f1eb84b30c2',
 contract:'https://sepolia.etherscan.io/address/0x3233fA7f8c50Aa25d9B1263c25F28535B6eA59bF',
 transaction:'https://sepolia.etherscan.io/tx/0x5c7717be6dc70e6416f8053c72bb1e2bec2b7c5462b23fcb9c4b1077f907fed4',
 documentation:'https://github.com/nicolaususnicola-lgtm/myzubster-mvp/commit/148347838cf7bd1c1b83853311fd7a543f5e50e1'
};
const proofLinks={
 card:`https://www.myzubster.com/knowledge-card?id=${proofCardId}`,
 payload:'https://github.com/nicolaususnicola-lgtm/myzubster-mvp/commit/ecefd81c5c9da0be15c99aeeb83878480abd60a8',
 contract:'https://sepolia.etherscan.io/address/0x21787249Df054132093FcF09bB914C0CCC539390',
 transaction:'https://sepolia.etherscan.io/tx/0xc837ba3f3046f3712e3eba4b81107cb22939b61300f2cab3cfe5bbb7b3319ded',
 documentation:'https://github.com/nicolaususnicola-lgtm/myzubster-mvp/commit/405467e8d7b4e55ea9f18044a00aa66804f3ada3'
};
const pilotPassportSnapshot={
 contributor:{id:'jdjioe5-cpu'},
 summary:{knowledge:16,contributions:3,attestations:3,observedAttestations:3,verifiedAttestations:0,rewards:1,settlements:1,settledRewards:1},
 reward:{amount:0.001,currency:'XMR',status:'paid'},
 settlement:{network:'monero-mainnet',status:'SETTLED',privacyMode:'privacy_preserving',proofType:'REFERENCE_ONLY'},
 contributionUrl:'https://github.com/MyZubster-Ecosystem/myzubster-animal-registry/pull/11'
};

export default function KnowledgeGraphPage(){
 const q=new URLSearchParams(window.location.search),domain=(q.get('domain')||'MONERO').toUpperCase(),id=(q.get('id')||'ART-001').toUpperCase(),cardId=q.get('card');
 const reviewId=q.get('review');
 const showCatalog=!reviewId&&!cardId&&!q.has('domain')&&!q.has('id');
 const staticArticle=cardId||showCatalog?null:knowledgeArticles[`${domain}:${id}`];
 const [publicCards,setPublicCards]=useState([]),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
 const [pilotPassport,setPilotPassport]=useState(pilotPassportSnapshot),[pilotPassportLive,setPilotPassportLive]=useState(false);
 useEffect(()=>{let live=true;fetch('https://www.myzubster.com/api/knowledge-evidence/public',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Catalogo non disponibile');return r.json()}).then(d=>{if(live)setPublicCards(Array.isArray(d.cards)?d.cards:[])}).catch(e=>{if(live)setLoadError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
 useEffect(()=>{let live=true;fetch('https://www.myzubster.com/api/passports/jdjioe5-cpu',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Passport live non disponibile');return r.json()}).then(d=>{if(live&&d&&d.success&&d.passport){setPilotPassport(d.passport);setPilotPassportLive(true)}}).catch(()=>{});return()=>{live=false}},[]);

 const dynamic=useMemo(()=>publicCards.map((c,i)=>({
   ...c,
   key:String(c._id||`public-${i}`),
   id:`K-${String(c._id||i).slice(-6).toUpperCase()}`,
   domain:String(c.domain||'GENERALE').toUpperCase(),
   publisher:c.publisherName||'Titolare MyZubster'
 })),[publicCards]);
 const requestedDynamic=dynamic.find(c=>cardId?c.key===cardId:c.domain===domain&&c.id===id);
 const article=staticArticle||requestedDynamic;
 const isDynamic=Boolean(requestedDynamic);
 const articleId=article?.id||id;
 const isProofV2=isDynamic&&requestedDynamic.key===proofCardId&&requestedDynamic.publisher==='nicolaususnicola-lgtm';

 const nodes=useMemo(()=>{
   if(isDynamic){
     const samePublisher=dynamic.filter(c=>c.publisher===requestedDynamic.publisher&&c.key!==requestedDynamic.key);
     const evidence=requestedDynamic.evidence||[];
     const sources=buildEvidenceNodes(requestedDynamic.key,evidence);
     const versionedProofs=buildVersionedProofNodes(requestedDynamic.key,evidence).filter(proof=>!(isProofV2&&proof.proofVersion==='2'));
     const groupedProofUrls=new Set(versionedProofs.flatMap(proof=>proof.canonicalUrls||[]));
     return [
       {key:'card',id:articleId,type:'article',title:requestedDynamic.title,description:requestedDynamic.description,url:`https://www.myzubster.com/knowledge-card?id=${encodeURIComponent(requestedDynamic.key)}`},
       {key:'person',id:isProofV2?'N4K48':slug(requestedDynamic.publisher),type:'person',title:requestedDynamic.publisher,description:'Profilo che ha pubblicato questa conoscenza',url:isProofV2?'https://github.com/nicolaususnicola-lgtm':undefined},
       ...(isProofV2?[
         {key:'proof-v3',id:'PROOF V3',type:'proof',title:'MyZubsterProof v3 · Sepolia',description:`SHA-256: ${proofV3.digest}. Attestazione v3 distinta dalla storia di Proof v2.`,url:proofV3.contract,extraUrl:proofV3.transaction,proofVersion:'3',digest:proofV3.digest,contract:proofV3.contract,transaction:proofV3.transaction,documentation:proofV3.documentation},
         {key:'payload',id:'PAYLOAD V1',type:'source',title:'Contenuto canonico',description:'Commit con gli esatti byte del payload canonico della Knowledge Card.',url:proofLinks.payload},
         {key:'digest',id:'SHA-256',type:'proof',title:'Digest del payload',description:`SHA-256: ${digest}. Il digest si riferisce al payload canonico nel commit, non alla pagina web che può cambiare.`},
         {key:'sepolia',id:'PROOF V2',type:'proof',title:'MyZubsterProof · Sepolia',description:'Contratto della seconda prova con knowledgeHash() riferito al digest del payload. Rete di test Ethereum Sepolia.',url:proofLinks.contract,extraUrl:proofLinks.transaction},
         {key:'docs',id:'DOCS',type:'source',title:'Metodo di verifica',description:'Commit GitHub con documentazione e comandi per ricalcolare il digest.',url:proofLinks.documentation}
       ]:[]),
       ...samePublisher.map(c=>({key:`a:${c.id}`,id:c.id,type:'article',title:c.title,description:c.description,domain:c.domain,cardId:c.key})),
       ...versionedProofs,
       ...sources.filter(s=>s.type!=='proof'&&!groupedProofUrls.has(s.canonicalUrl)),
       {key:`c:${slug(requestedDynamic.domain)}`,id:slug(requestedDynamic.domain),type:'concept',title:requestedDynamic.domain,description:'Ambito della conoscenza'}
     ];
   }
   return staticArticle?[{key:'card',id:articleId,type:'article',title:staticArticle.title,description:staticArticle.summary},...staticArticle.relations.map(x=>{const a=knowledgeArticles[`${domain}:${x.id}`];return{key:`a:${x.id}`,id:x.id,type:'article',title:a?.title||x.label,description:a?.summary}}),...staticArticle.sources.map(x=>({key:`s:${x.id}`,id:x.id,type:'source',title:x.title,description:x.url,url:x.url})),...staticArticle.concepts.map(x=>({key:`c:${x.id}`,id:x.id,type:'concept',title:x.title,description:'Concetto collegato'}))]:[];
 },[staticArticle,isDynamic,isProofV2,requestedDynamic,dynamic,domain,articleId]);

 const [selected,setSelected]=useState('card'),[filter,setFilter]=useState('all');
 useEffect(()=>setSelected('card'),[articleId]);
 if(reviewId){const review=technicalReviews.find(r=>r.id===reviewId);return review?<TechnicalReviewGraph key={review.id} review={review}/>:<main className="kg-shell"><p>Revisione non trovata.</p><a href="/conoscenze">Apri Conoscenze</a></main>;}
 if(showCatalog)return <main className="kg-shell kg-catalog"><header><a href="https://www.myzubster.com/" className="kg-back">← MyZubster</a><p className="kg-eye">MYZUBSTER · KNOWLEDGE GRAPH</p><h1>Conoscenze</h1><p><a className="kg-back" href="/knowledge-graph">Esplora il grafo delle conoscenze dei contributori →</a></p><p>Esplora le schede pubblicate dalla community. Apri una scheda per vedere le persone, le fonti e le evidenze collegate nel grafo.</p></header>{loading?<p role="status">Caricamento delle schede pubbliche…</p>:loadError?<div className="kg-error" role="alert"><p>Il catalogo non è disponibile adesso.</p><button className="kg-open" onClick={()=>window.location.reload()}>Riprova</button></div>:<><p className="kg-count">{dynamic.length} {dynamic.length===1?'scheda pubblica':'schede pubbliche'} · aggiornate quando apri la pagina</p>{dynamic.length?<div className="kg-cards">{[...dynamic].sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0)).map(c=><article className="kg-card" key={c.key}><span className="kg-badge article">Conoscenza</span><h2>{c.title}</h2><p className="kg-card-person">{c.publisher} · {c.domain}</p><p>{c.description}</p><div className="kg-card-actions"><a href={`/conoscenze?card=${encodeURIComponent(c.key)}`}>Esplora il grafo</a><a href={`https://www.myzubster.com/knowledge-card?id=${encodeURIComponent(c.key)}`}>Apri la scheda pubblica</a></div></article>)}</div>:<p>Non ci sono ancora schede pubbliche.</p>}</>}<section aria-label="Knowledge Passport pilot" style={{margin:'28px 0'}}><h2>Digital Knowledge Passport · pilot reale</h2><p>Un contributore reale è ora collegato a conoscenze dimostrate, evidenze, attestazioni, reward e settlement privacy-preserving.</p><div className="kg-cards"><article className="kg-card"><span className="kg-badge person">Contributor Passport</span><h3>{pilotPassport.contributor?.id||'jdjioe5-cpu'}</h3><p>{pilotPassport.summary?.knowledge||16} conoscenze · {pilotPassport.summary?.contributions||3} contributi · {pilotPassport.summary?.attestations||3} attestazioni</p><p>{pilotPassport.summary?.rewards||1} reward · {pilotPassport.summary?.settlements||1} settlement · {pilotPassport.summary?.verifiedAttestations||0} attestazioni indipendentemente verificate</p><p><strong>Monero:</strong> {pilotPassport.settlements?.[0]?.amount??pilotPassport.reward?.amount??0.001} {pilotPassport.settlements?.[0]?.asset||pilotPassport.reward?.currency||'XMR'} · {pilotPassport.settlements?.[0]?.status||pilotPassport.settlement?.status||'SETTLED'} · privacy-preserving</p><p className="kg-limit">{pilotPassportLive?'Dati caricati dal Passport API pubblico.':'Snapshot verificato del pilot; il frontend passerà automaticamente ai dati live quando il Passport API sarà esposto dal gateway pubblico.'}</p><div className="kg-card-actions"><a href={pilotPassport.contributions?.find(c=>c.contributionId==='github:myzubster-animal-registry:pr:11')?.reference||pilotPassport.contributionUrl||'https://github.com/MyZubster-Ecosystem/myzubster-animal-registry/pull/11'} target="_blank" rel="noreferrer">Apri il contributo premiato</a></div></article></div></section><section aria-label="Revisioni tecniche pubbliche"><h2>Contributi di conoscenza · revisioni tecniche</h2><div className="kg-cards">{technicalReviews.map(r=><article className="kg-card" key={r.id}><span className="kg-badge concept">Revisione tecnica</span><h3>{r.title}</h3><p>{r.author} · {r.date}</p><p>{r.summary}</p><p>{r.status}</p><div className="kg-card-actions"><a href={`/conoscenze?review=${encodeURIComponent(r.id)}`}>Esplora il contributo</a><a href={r.source} target="_blank" rel="noreferrer">Commento originale</a></div></article>)}</div></section><footer>Le attività sono dichiarate dai titolari. Le fonti collegate e le prove tecniche non certificano automaticamente le competenze.</footer></main>;
 if(!article)return <main className="kg-shell"><div className="kg-error">{loading?'Caricamento conoscenze…':loadError?`Errore: ${loadError}`:`Conoscenza ${cardId||`${domain}/${id}`} non trovata.`}<br/><a href="/conoscenze">Apri Conoscenze</a></div></main>;
 const shown=nodes.filter(n=>filter==='all'||n.type===filter||n.key===selected),active=nodes.find(n=>n.key===selected)||nodes[0],cx=390,cy=235;
 const pos=new Map(shown.map((n,i)=>n.key==='card'?[n.key,{x:cx,y:cy}]:[n.key,{x:cx+Math.cos((Math.PI*2*(i-1))/Math.max(shown.length-1,1)-Math.PI/2)*225,y:cy+Math.sin((Math.PI*2*(i-1))/Math.max(shown.length-1,1)-Math.PI/2)*155}]));
 const open=n=>{if(n.cardId)window.location.assign(`/conoscenze?card=${encodeURIComponent(n.cardId)}`);else if(n.type==='article'&&n.key!=='card')window.location.assign(`/conoscenze?domain=${encodeURIComponent(n.domain||domain)}&id=${encodeURIComponent(n.id)}`)};
 const edges=isProofV2?[['person','card'],['card','payload'],['payload','digest'],['digest','sepolia'],['sepolia','docs'],...shown.filter(n=>n.key==='proof-v3'||n.key.startsWith('proof:v')).map(n=>['card',n.key])]:shown.filter(n=>n.key!=='card').map(n=>['card',n.key]);
 return <main className="kg-shell"><header><a href="/conoscenze" className="kg-back">← Tutte le conoscenze</a><p className="kg-eye">KNOWLEDGE GRAPH</p><h1>{isProofV2?'N4K48 · Proof v2':`${article.domain||domain} ↔ ${articleId}`}</h1><p>{article.summary||article.description}</p>{isDynamic&&<p>Pubblicata da <strong>{requestedDynamic.publisher}</strong> · dati del catalogo pubblico MyZubster.</p>}</header><nav aria-label="Filtra i nodi">{['all','article','person','source','proof','concept'].filter(x=>x!=='proof'||isProofV2||nodes.some(n=>n.type==='proof')).map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x==='all'?'Tutto':x}</button>)}</nav><section className="kg-work"><div className="kg-canvas"><svg viewBox="0 0 780 470" role="img" aria-label={`Grafo ${isProofV2?'N4K48 Proof v2':`${domain} ${articleId}`}`}>{edges.filter(([a,b])=>pos.has(a)&&pos.has(b)).map(([a,b])=><line key={`${a}-${b}`} x1={pos.get(a).x} y1={pos.get(a).y} x2={pos.get(b).x} y2={pos.get(b).y}/>)}{shown.map(n=>{const p=pos.get(n.key),sel=n.key===selected;return <g key={n.key} className="kg-node" transform={`translate(${p.x} ${p.y})`} role="button" aria-label={`${n.type}: ${n.title}`} tabIndex="0" onClick={()=>setSelected(n.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(n.key)}}} onDoubleClick={()=>open(n)}><circle r={n.key==='card'?52:41} fill={sel?color[n.type]:'#10182d'} stroke={color[n.type]} strokeWidth={sel?4:2}/><text y="-3">{n.id.length>13?`${n.id.slice(0,12)}…`:n.id}</text><text className="type" y="17">{n.type}</text></g>})}</svg></div><aside><span className={`kg-badge ${active.type}`}>{active.type}</span><h2>{active.title}</h2><code>{active.id}</code><p>{active.description}</p>{active.cardId&&<button className="kg-open" onClick={()=>open(active)}>Apri nel grafo</button>}{active.url&&<a href={active.url} target="_blank" rel="noreferrer">Apri {active.key==='card'?'Knowledge Card':'evidenza'} ↗</a>}{active.extraUrl&&<a href={active.extraUrl} target="_blank" rel="noreferrer">Apri transazione di deploy ↗</a>}{active.proofVersion&&<p><strong>Versione:</strong> Proof v{active.proofVersion}</p>}{active.digest&&<p><strong>Digest:</strong> <code>{active.digest}</code></p>}{active.contract&&<p><strong>Contratto:</strong> {active.contract}</p>}{active.transaction&&<p><strong>Transazione:</strong> {active.transaction}</p>}{active.documentation&&<a href={active.documentation} target="_blank" rel="noreferrer">Apri documentazione Proof ↗</a>}</aside></section><div className="kg-list" aria-label="Percorso delle evidenze">{nodes.map(n=><button key={n.key} className={selected===n.key?'active':''} onClick={()=>setSelected(n.key)}>{n.id} · {n.title}</button>)}</div>{isProofV2&&<p className="kg-limit">La Proof v2 collega crittograficamente il payload canonico al digest registrato su Sepolia. Non certifica automaticamente la veridicità delle competenze o delle dichiarazioni nella scheda.</p>}<footer>{nodes.length} nodi{isDynamic?' · dati pubblici MyZubster':''}</footer></main>;
}
