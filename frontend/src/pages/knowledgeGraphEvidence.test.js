import {buildEvidenceNodes, evidenceKey, isProofEvidence, normalizeEvidenceUrl} from './knowledgeGraphEvidence';

const card='6abaaefb3a7460c4574a45fd';

test('uses stable card plus normalized URL identity instead of source index',()=>{
  const url='https://github.com/example/project/commit/abc';
  const first=buildEvidenceNodes(card,[{label:'A',url},{label:'B',url:'https://example.com/b'}]);
  const reordered=buildEvidenceNodes(card,[{label:'B',url:'https://example.com/b'},{label:'A updated',url}]);
  expect(first.find(n=>n.url===url).key).toBe(reordered.find(n=>n.url===url).key);
  expect(first.find(n=>n.url===url).id).toBe(reordered.find(n=>n.url===url).id);
  expect(first.find(n=>n.url===url).key).toBe(evidenceKey(card,url));
});

test('normalizes harmless URL differences and deduplicates a reimport',()=>{
  const nodes=buildEvidenceNodes(card,[{label:'Proof',url:'HTTPS://Example.COM/path/'},{label:'Proof imported again',url:'https://example.com/path#section'}]);
  expect(nodes).toHaveLength(1);
  expect(normalizeEvidenceUrl('HTTPS://Example.COM/path/#x')).toBe('https://example.com/path');
});

test('classifies structured versioned attestations as proof and preserves metadata',()=>{
  const item={type:'proof',proofVersion:'3',label:'Attestazione',url:'https://example.com/proof-v3',digest:'abc',contract:'0x123',transaction:'0xtx',documentation:'https://example.com/docs'};
  expect(isProofEvidence(item)).toBe(true);
  const node=buildEvidenceNodes(card,[item])[0];
  expect(node.type).toBe('proof');
  expect(node.proofVersion).toBe('3');
  expect(node.digest).toBe('abc');
  expect(node.contract).toBe('0x123');
  expect(node.transaction).toBe('0xtx');
  expect(node.documentation).toBe(item.documentation);
});

test('recognizes explicitly versioned proof labels when structured type is unavailable',()=>{
  const nodes=buildEvidenceNodes(card,[{label:'Proof v2 documentation',url:'https://example.com/v2'},{label:'Proof v3 contract',url:'https://example.com/v3'},{label:'Normal source',url:'https://example.com/source'}]);
  expect(nodes.filter(n=>n.type==='proof').map(n=>n.proofVersion)).toEqual(['2','3']);
  expect(nodes.find(n=>n.title==='Normal source').type).toBe('source');
});

test('v2 and v3 coexist while duplicate URLs are removed and identities survive refresh',()=>{
  const evidence=[{type:'proof',proofVersion:2,label:'Proof v2',url:'https://example.com/v2'},{type:'proof',proofVersion:3,label:'Proof v3',url:'https://example.com/v3'},{type:'proof',proofVersion:3,label:'Proof v3 duplicate',url:'https://example.com/v3#again'}];
  const first=buildEvidenceNodes(card,evidence), refreshed=buildEvidenceNodes(card,[...evidence].reverse());
  expect(first.filter(n=>n.type==='proof')).toHaveLength(2);
  for(const node of first)expect(refreshed.find(n=>n.canonicalUrl===node.canonicalUrl).id).toBe(node.id);
});

test('updates metadata for a stable source without changing its identity',()=>{
  const url='https://example.com/evidence';
  const before=buildEvidenceNodes(card,[{label:'Old label',note:'Old note',url}])[0];
  const after=buildEvidenceNodes(card,[{label:'New label',note:'New note',url}])[0];
  expect(after.key).toBe(before.key); expect(after.id).toBe(before.id); expect(after.title).toBe('New label'); expect(after.description).toBe('New note');
});

test('removed public evidence is not retained in the rebuilt current graph',()=>{
  const a={label:'A',url:'https://example.com/a'},b={label:'B',url:'https://example.com/b'};
  expect(buildEvidenceNodes(card,[a,b])).toHaveLength(2);
  const republished=buildEvidenceNodes(card,[b]);
  expect(republished).toHaveLength(1); expect(republished[0].url).toBe(b.url);
});

test('different cards do not share an evidence identity even for the same URL',()=>{
  const url='https://example.com/shared';
  expect(evidenceKey(card,url)).not.toBe(evidenceKey('another-card',url));
});
