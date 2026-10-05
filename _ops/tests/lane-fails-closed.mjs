process.env.BP_LANE_KEY = 'test-lane-key-0123456789';
const { gate } = await import(new URL('../../api/_lane.mjs', import.meta.url).href);
let pass=0, fail=[];
const t=(n,c,got)=>{ if(c){pass++;console.log('  ok   '+n);} else {fail.push(n);console.log('  FAIL '+n+' -> '+JSON.stringify(got));} };

// a request whose query cannot be rewritten must be refused, not let through
const frozen = { headers:{cookie:'bp_ws=anthony'}, query: Object.freeze({ ws:'nd' }) };
let g;
try { g = gate(frozen); } catch (e) { g = 'THREW: '+e.message; }
t('a query that cannot be rewritten fails closed, and never throws', g === null, g);

const frozenLane = { headers:{'x-bp-lane':'test-lane-key-0123456789'}, query: Object.freeze({ ws:'nd' }) };
try { g = gate(frozenLane); } catch (e) { g = 'THREW: '+e.message; }
t('and the lane gets no exception from it either', g === null, g);

// no query object at all (a bare node request)
const bare = { headers:{cookie:'bp_ws=nd'} };
g = gate(bare);
t('a request with no query object still works', g && g.ws==='nd' && bare.query.ws==='nd', [g, bare.query]);

console.log('\n'+(fail.length? 'FAILED '+fail.length : 'ALL '+pass+' PASSED')+'\n');
process.exit(fail.length?1:0);
