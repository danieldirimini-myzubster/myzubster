export const normalizeEvidenceUrl=value=>{
  const raw=String(value||'').trim();
  if(!raw)return '';
  try{
    const url=new URL(raw);
    url.hash='';
    url.hostname=url.hostname.toLowerCase();
    url.protocol=url.protocol.toLowerCase();
    if((url.protocol==='https:'&&url.port==='443')||(url.protocol==='http:'&&url.port==='80'))url.port='';
    url.pathname=url.pathname.replace(/\/+$/,'')||'/';
    return url.toString();
  }catch{return raw.replace(/\/+$/,'');}
};

const stableHash=value=>{
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0').toUpperCase();
};

export const evidenceKey=(cardId,url)=>`evidence:${cardId}:${normalizeEvidenceUrl(url)}`;

export const buildEvidenceNodes=(cardId,evidence=[])=>{
  const seen=new Set();
  return evidence.filter(item=>item&&item.url).reduce((nodes,item)=>{
    const canonicalUrl=normalizeEvidenceUrl(item.url);
    const key=evidenceKey(cardId,canonicalUrl);
    if(!canonicalUrl||seen.has(key))return nodes;
    seen.add(key);
    nodes.push({key,id:`SRC-${stableHash(key)}`,type:'source',title:item.label||'Fonte',description:item.note||item.url,url:item.url,canonicalUrl});
    return nodes;
  },[]);
};
