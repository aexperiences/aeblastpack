import { BASE } from './_tt.mjs';
import { parseCookies, exchange, channelOf } from './_yt.mjs';
import { save as vaultSave } from './_vault.mjs';
// AE Blastpack — Google sends the browser back here; the refresh token goes into the vault. Oct 29 2026.
export default async function handler(req, res){
  const back = (params) => { res.statusCode = 302; res.setHeader('Location', BASE + (params ? '?' + params : '')); res.end(); };
  try {
    const c = parseCookies(req);
    const { code, state, error } = req.query;
    if (error) return back('youtube=error&reason=' + encodeURIComponent(error));
    if (!code || !state || state !== c.bp_yt_state) return back('youtube=error&reason=state_mismatch');
    const tj = await exchange(code);
    if (!tj.access_token) return back('youtube=error&reason=' + encodeURIComponent(tj.error_description || tj.error || 'token_exchange_failed'));
    if (!tj.refresh_token) return back('youtube=error&reason=no_refresh_token_remove_app_access_in_google_and_try_again');
    const ch = await channelOf(tj.access_token).catch(() => ({ channel: '', channelId: '' }));
    const ws = c.bp_yt_ws || '';
    const tok = { rt: tj.refresh_token, channel: ch.channel, channelId: ch.channelId, scope: tj.scope || '' };
    /* No expiry on a refresh token, so x is left at 0 and the room never counts it down. */
    if (ws) await vaultSave(ws, 'youtube', tok, { n: ch.channel || 'YouTube', x: 0 });
    res.setHeader('Set-Cookie', [
      'bp_yt_state=; Max-Age=0; Path=/',
      'bp_yt_ws=; Max-Age=0; Path=/'
    ].concat(ws ? ['bp_ws=' + encodeURIComponent(ws) + '; Max-Age=' + (60 * 24 * 3600) + '; Path=/; HttpOnly; Secure; SameSite=Lax'] : []));
    return back('youtube=connected&handle=' + encodeURIComponent(ch.channel || 'YouTube') + '&ws=' + encodeURIComponent(ws));
  } catch (e) {
    return back('youtube=error&reason=' + encodeURIComponent(e.message));
  }
}
