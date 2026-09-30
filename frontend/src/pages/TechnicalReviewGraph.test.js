import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {technicalReviews} from '../data/technicalReviews';
import TechnicalReviewGraph from './TechnicalReviewGraph';
import KnowledgeGraphPage from './KnowledgeGraphPage';
let host,root;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();jest.restoreAllMocks();window.history.replaceState({},'', '/');});
test('attributes source and keeps implementation pending',()=>{
 act(()=>root.render(<TechnicalReviewGraph review={technicalReviews[0]}/>));
 expect(host.textContent).toContain('Mike Dabydeen');
 expect(host.textContent).toContain('proposte da implementare');
 act(()=>host.querySelector('[aria-label="Nodi della revisione"] button:nth-child(3)').click());
 expect(host.querySelector('aside a').href).toBe(technicalReviews[0].source);
 act(()=>host.querySelector('[aria-label="Nodi della revisione"] button:last-child').click());
 expect(host.querySelector('aside').textContent).toContain('ancora da completare');
 expect(host.querySelector('aside a').href).toBe(technicalReviews[0].task);
});
test('review remains discoverable when public card catalog fails',async()=>{
 window.history.replaceState({},'', '/conoscenze');
 global.fetch=jest.fn().mockRejectedValue(new Error('offline'));
 await act(async()=>root.render(<KnowledgeGraphPage/>));
 expect(host.textContent).toContain('Il catalogo non è disponibile');
 expect(host.querySelector(`a[href="/conoscenze?review=${technicalReviews[0].id}"]`)).not.toBeNull();
});
test('direct review opens without public cards; unknown review is rejected',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({cards:[]})});
 window.history.replaceState({},'', '/conoscenze?review='+technicalReviews[0].id);
 await act(async()=>root.render(<KnowledgeGraphPage/>));
 expect(host.querySelector('svg').getAttribute('aria-label')).toContain('Mike Dabydeen');
 window.history.replaceState({},'', '/conoscenze?review=missing');
 await act(async()=>root.render(<KnowledgeGraphPage/>));
 expect(host.textContent).toContain('Revisione non trovata');
});
