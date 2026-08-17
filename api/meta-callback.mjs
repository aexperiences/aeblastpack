// AE Blastpack — Meta OAuth callback: code -> short token -> long-lived token -> targets.
import { BASE, REDIRECT, graph, longLived, listTargets, tokenCookie, parseCookies } from './_meta.mjs';

function back(res, params){
  const url = new URL(BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  res.writeHead(302, { Location: url.toString() });
  res.end();
}

export default async function handler(req, res){
  try {
    const q = req.query || {};
    if (q.error) return back(res, { meta: 'error', reason: q.error_description || q.error });
    if (!q.code) return back(res, { meta: 'error', reason: 'no_code' });

    // CSRF: the state we set at /auth/meta/start must come back untouched.
    const cookies = parseCookies(req);
    if (!cookies.bp_fb_state || cookies.bp_fb_state !== q.state) {
      return back(res, { meta: 'error', reason: 'state_mismatch' });
    }
    let ws = '';
    try { ws = JSON.parse(Buffer.from(q.state, 'base64url').toString()).ws || ''; } catch {}

    const short = await graph('/oauth/access_token', {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: REDIRECT,
      code: q.code
    });
    if (!short.access_token) return back(res, { meta: 'error', reason: 'no_token' });

    const long = await longLived(short.access_token);
    const at = long.access_token || short.access_token;
    const ttl = (long.expires_in || 60 * 24 * 3600) * 1000;

    const targets = await listTargets(at);
    if (!targets.length) {
      return back(res, { meta: 'error', reason: 'no_pages' });
    }

    const tok = { at, exp_at: Date.now() + ttl, targets };
    res.setHeader('Set-Cookie', [
      tokenCookie(tok),
      'bp_fb_state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'
    ]);

    const first = targets[0];
    return back(res, {
      meta: 'connected',
      ws,
      page: first.pageName,
      ig: first.igUsername || '',
      n: String(targets.length)
    });
  } catch (e) {
    return back(res, { meta: 'error', reason: (e && e.message) || 'exception' });
  }
}
