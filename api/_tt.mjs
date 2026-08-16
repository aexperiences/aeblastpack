// AE Blastpack — TikTok helpers (free stack, zero deps)
export const BASE = process.env.BP_BASE || 'https://www.aexperiences.com/apps/blastpack/';
export const REDIRECT = BASE + 'auth/tiktok/callback';

export function parseCookies(req){
  const h = req.headers.cookie || '';
  const out = {};
  h.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function b64e(obj){ return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
export function b64d(str){ try { return JSON.parse(Buffer.from(str, 'base64url').toString()); } catch { return null; } }

export function tokenCookie(tok){
  return `bp_tt=${b64e(tok)}; Max-Age=${60*60*24*30}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function getToken(req, res){
  const c = parseCookies(req);
  let tok = c.bp_tt ? b64d(c.bp_tt) : null;
  if (!tok) return null;
  if (Date.now() > (tok.exp_at || 0) - 60_000) {
    // refresh
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tok.rt
    });
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const j = await r.json();
    if (!j.access_token) return null;
    tok = { ...tok, at: j.access_token, rt: j.refresh_token || tok.rt, exp_at: Date.now() + (j.expires_in || 86400) * 1000 };
    if (res) res.setHeader('Set-Cookie', tokenCookie(tok));
  }
  return tok;
}
