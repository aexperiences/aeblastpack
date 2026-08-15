import { BASE, REDIRECT, parseCookies, tokenCookie } from './_tt.mjs';

export default async function handler(req, res){
  const back = (params) => {
    res.statusCode = 302;
    res.setHeader('Location', BASE + (params ? '?' + params : ''));
    res.end();
  };
  try {
    const c = parseCookies(req);
    const { code, state, error, error_description } = req.query;
    if (error) return back('tiktok=error&reason=' + encodeURIComponent(error_description || error));
    if (!code || !state || state !== c.bp_tt_state) return back('tiktok=error&reason=state_mismatch');

    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT
    });
    const tr = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const tj = await tr.json();
    if (!tj.access_token) return back('tiktok=error&reason=' + encodeURIComponent(tj.error_description || tj.error || 'token_exchange_failed'));

    let name = 'tiktok', avatar = '';
    try {
      const ur = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
        headers: { Authorization: 'Bearer ' + tj.access_token }
      });
      const uj = await ur.json();
      if (uj.data && uj.data.user) { name = uj.data.user.display_name || name; avatar = uj.data.user.avatar_url || ''; }
    } catch {}

    const tok = {
      at: tj.access_token,
      rt: tj.refresh_token,
      exp_at: Date.now() + (tj.expires_in || 86400) * 1000,
      open_id: tj.open_id,
      name, avatar
    };
    res.setHeader('Set-Cookie', [
      tokenCookie(tok),
      'bp_tt_state=; Max-Age=0; Path=/',
      'bp_tt_ws=; Max-Age=0; Path=/'
    ]);
    const ws = c.bp_tt_ws || '';
    return back('tiktok=connected&handle=' + encodeURIComponent(name) + '&ws=' + encodeURIComponent(ws));
  } catch (e) {
    return back('tiktok=error&reason=' + encodeURIComponent(e.message));
  }
}
