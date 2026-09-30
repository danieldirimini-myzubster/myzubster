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

const field=(item,...names)=>{
  for(const name of names)if(item&&item[name]!=null&&String(item[name]).trim())return String(item[name]).trim();
  return '';
};
const proofVersion=item=>{
  const structured=field(item,'proofVersion','proof_version','version');
  if(/^v?\d+$/i.test(structured))return structured.replace(/^v/i,'');
  const kind=field(item,'type','kind','category','evidenceType').toLowerCase();
  if(kind.includes('proof')){
    const match=`${field(item,'label','title','name')} ${field(item,'note','description')}`.match(/\bproof\s*v?(\d+)\b/i);
    return match?.[1]||'';
  }
  const match=`${field(item,'label','title','name')} ${field(item,'note','description')}`.match(/\bproof\s*v(\d+)\b/i);
  return match?.[1]||'';
};
export const isProofEvidence=item=>Boolean(proofVersion(item)||field(item,'type','kind','category','evidenceType').toLowerCase()==='proof');

export const buildEvidenceNodes=(cardId,evidence=[])=>{
  const seen=new Set();
  return evidence.filter(item=>item&&item.url).reduce((nodes,item)=>{
    const canonicalUrl=normalizeEvidenceUrl(item.url);
    const key=evidenceKey(cardId,canonicalUrl);
    if(!canonicalUrl||seen.has(key))return nodes;
    seen.add(key);
    const version=proofVersion(item);
    const proof=isProofEvidence(item);
    nodes.push({
      key,id:`SRC-${stableHash(key)}`,type:proof?'proof':'source',
      title:item.label||item.title||(version?`Proof v${version}`:'Fonte'),
      description:item.note||item.description||item.url,url:item.url,canonicalUrl,
      proofVersion:version||undefined,
      digest:field(item,'digest','sha256','hash')||undefined,
      contract:field(item,'contract','contractAddress','contract_url')||undefined,
      transaction:field(item,'transaction','transactionHash','tx','txHash')||undefined,
      documentation:field(item,'documentation','documentationUrl','docs')||undefined
    });
    return nodes;
  },[]);
};
