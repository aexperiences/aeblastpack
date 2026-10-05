process.env.BP_LANE_KEY = 'test-lane-key-0123456789';
const { gate } = await import(new URL('../../api/_lane.mjs', import.meta.url).href);
let pass=0, fail=[];
const t=(n,c,got)=>{ if(c){pass++;console.log('  ok   '+n);} else {fail.push(n);console.log('  FAIL '+n+' -> '+JSON.stringify(got));} };
const req=(o)=>({ headers:o.headers||{}, query:Object.assign({},o.query||{}) });

let r=req({ query:{ws:'nd'} });
let g=gate(r);
t('a stranger naming ?ws=nd is refused', g===null, g);
t('and the workspace is wiped so nothing downstream reads it', r.query.ws==='', r.query);

r=req({ query:{ws:'nd'}, headers:{'x-bp-lane':'test-lane-key-0123456789'} });
g=gate(r);
t('the lane may name nd', g && g.via==='lane' && g.ws==='nd', g);
t('and it stays nd downstream', r.query.ws==='nd', r.query);

r=req({ query:{ws:'nd'}, headers:{'x-bp-lane':'test-lane-key-0123456788'} });
g=gate(r);
t('a wrong lane key is refused', g===null, g);

r=req({ query:{ws:'nd'}, headers:{'x-bp-lane':'short'} });
t('a short wrong key is refused, not crashed', gate(r)===null);

r=req({ query:{}, headers:{'x-bp-lane':'test-lane-key-0123456789'} });
t('the lane with no workspace named is refused', gate(r)===null);

r=req({ query:{ws:'nd'}, headers:{cookie:'bp_ws=anthony; bp_fb=xyz'} });
g=gate(r);
t('his browser cannot aim at her workspace', g && g.ws==='anthony', g);
t('the query string is overruled by the cookie', r.query.ws==='anthony', r.query);

r=req({ query:{workspace:'nd'}, headers:{cookie:'bp_ws=anthony'} });
gate(r);
t('?workspace= is no back door', r.query.ws==='anthony' && !('workspace' in r.query), r.query);

r=req({ query:{}, headers:{cookie:'bp_fb=oldcookie'} });
g=gate(r);
t('a browser from before the vault still works, naming nobody', g && g.via==='legacy' && g.ws==='', g);

r=req({ query:{ws:'nd'}, headers:{cookie:'bp_fb=oldcookie'} });
g=gate(r);
t('and that old browser cannot borrow a name either', g && g.ws==='' && r.query.ws==='', [g,r.query]);

r=req({ query:{ws:'nd'}, headers:{cookie:'nothing=1'} });
t('a cookie that proves nothing is refused', gate(r)===null);

delete process.env.BP_LANE_KEY;
r=req({ query:{ws:'nd'}, headers:{'x-bp-lane':'anything'} });
t('with no key set on the server, no lane key opens it', gate(r)===null);

console.log('\n'+(fail.length? 'FAILED '+fail.length : 'ALL '+pass+' PASSED')+'\n');
process.exit(fail.length?1:0);
