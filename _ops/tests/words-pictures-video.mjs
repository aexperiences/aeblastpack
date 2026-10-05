process.env.META_APP_SECRET='x'; process.env.TIKTOK_CLIENT_SECRET='y'; process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_a_b_c_d';
const { kindOf } = await import(new URL('../../api/meta-post.mjs', import.meta.url).href);
let pass=0, fail=[];
const t=(n,c,got)=>{ if(c){pass++;console.log('  ok   '+n);} else {fail.push(n);console.log('  FAIL '+n+' -> '+JSON.stringify(got));} };
const asked=[];
globalThis.fetch = async (u, init) => { asked.push((init&&init.method)+' '+u); return { headers:{ get:(k)=> k==='content-type' ? globalThis.__ct : null } }; };

t('nothing at all is words', await kindOf('') === 'words');
t('an mp4 is a video', await kindOf('https://x/y.mp4') === 'video');
t('a jpg is a picture', await kindOf('https://x/y.JPG') === 'photo');
t('a png with a query string is still a picture', await kindOf('https://x/y.png?v=2') === 'photo');
t('a heic off an iPhone is a picture', await kindOf('https://x/IMG_1.heic') === 'photo');

globalThis.__ct='image/jpeg'; asked.length=0;
t('a signed AE OS link that serves an image is a picture', await kindOf('https://www.aexperiences.com/api/nd-files?f=abc.def') === 'photo');
t('and it was settled with one HEAD, not a download', asked.length===1 && asked[0].startsWith('HEAD '), asked);

globalThis.__ct='video/quicktime';
t('a signed link that serves video is a video', await kindOf('https://www.aexperiences.com/api/nd-files?f=abc.def') === 'video');

globalThis.__ct='text/html';
t('an unreadable type falls back to video, as before', await kindOf('https://x/thing') === 'video');

globalThis.fetch = async () => { throw new Error('offline'); };
t('a refused HEAD does not throw', await kindOf('https://x/thing') === 'video');

t('what the caller says wins over everything', await kindOf('https://x/y.mp4','photo') === 'photo');
t('and words can be forced', await kindOf('https://x/y.mp4','words') === 'words');
t('a nonsense hint is ignored', await kindOf('https://x/y.mp4','banana') === 'video');

console.log('\n'+(fail.length? 'FAILED '+fail.length : 'ALL '+pass+' PASSED')+'\n');
process.exit(fail.length?1:0);
