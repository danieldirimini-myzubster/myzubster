import React, {useState} from 'react';

export default function TechnicalReviewGraph({review}) {
  const nodes = [
    {id:'review', label:'REVIEW', title:review.title, type:'article', description:review.status},
    {id:'author', label:'MIKE', title:review.author, type:'person', description:'Autore attribuito al commento originale. Identità GitHub/MyZubster non collegata.'},
    {id:'source', label:'FONTE', title:'Commento su Coder Legion', type:'source', description:'Fonte pubblica della revisione tecnica.', url:review.source},
    ...review.observations.map(o=>({...o, label:o.id.toUpperCase(), type:'concept'})),
    {id:'task', label:'MYZ-214', title:'Attività di sviluppo', type:'source', description:'Proposte registrate nella roadmap. Implementazione e test ancora da completare.', url:review.task}
  ];
  const [selected,setSelected]=useState('review');
  const active=nodes.find(n=>n.id===selected)||nodes[0];
  const colors={article:'#ff4d8d',person:'#f59e0b',source:'#21d4b4',concept:'#8d7cff'};
  const positions=nodes.map((n,i)=>i===0?{x:390,y:235}:{x:390+Math.cos((i-1)*Math.PI*2/(nodes.length-1)-Math.PI/2)*240,y:235+Math.sin((i-1)*Math.PI*2/(nodes.length-1)-Math.PI/2)*160});
  return <main className="kg-shell">
    <header><a href="/conoscenze" className="kg-back">← Tutte le conoscenze</a><p className="kg-eye">CONTRIBUTO DI CONOSCENZA · REVISIONE TECNICA</p><h1>{review.title}</h1><p>{review.summary}</p><p>{review.author} · {review.date} · {review.status}</p></header>
    <section className="kg-work"><div className="kg-canvas"><svg viewBox="0 0 780 470" role="img" aria-label="Grafo della revisione tecnica di Mike Dabydeen">
      {nodes.slice(1).map((n,i)=><line key={n.id} x1="390" y1="235" x2={positions[i+1].x} y2={positions[i+1].y}/>)}
      {nodes.map((n,i)=><g key={n.id} className="kg-node" transform={`translate(${positions[i].x} ${positions[i].y})`} role="button" aria-label={n.title} tabIndex="0" onClick={()=>setSelected(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(n.id)}}}><circle r={i===0?52:41} fill={selected===n.id?colors[n.type]:'#10182d'} stroke={colors[n.type]} strokeWidth="3"/><text y="-3">{n.label}</text><text className="type" y="17">{n.type}</text></g>)}
    </svg></div><aside><span className={`kg-badge ${active.type}`}>{active.type}</span><h2>{active.title}</h2><p>{active.description}</p>{active.url&&<a href={active.url} target="_blank" rel="noreferrer">Apri riferimento originale ↗</a>}</aside></section>
    <div className="kg-list" aria-label="Nodi della revisione">{nodes.map(n=><button key={n.id} className={selected===n.id?'active':''} onClick={()=>setSelected(n.id)}>{n.title}</button>)}</div>
    <p className="kg-limit">Questo contributo documenta osservazioni tecniche pubbliche. Non rappresenta codice consegnato, competenze certificate o una verifica indipendente già svolta.</p>
  </main>;
}
