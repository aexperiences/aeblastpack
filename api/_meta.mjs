// AE Blastpack — Meta (Facebook Page + Instagram) helpers. Zero deps.
// The www host is load-bearing: aexperiences.com 301s to www and Meta matches host exactly
// with Strict Mode on for redirect URIs. Do not "simplify" this.
export const BASE = process.env.BP_BASE || 'https://www.aexperiences.com/apps/blastpack/';
export const REDIRECT = BASE + 'auth/meta/callback';

export const GRAPH = 'https://graph.facebook.com/v26.0';

// Scopes for: read the user's Pages, publish video to a Page, publish Reels to the
// Instagram Business account linked to that Page.
export const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'business_management',
  'instagram_basic',
  'instagram_content_publish'
].join(',');

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
  return `bp_fb=${b64e(tok)}; Max-Age=${60*60*24*55}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

// Meta long-lived user tokens last ~60 days and cannot be silently refreshed the way
// TikTok's can — the user re-consents. We return null past expiry so the UI can say so
// honestly rather than failing at post time.
export async function getToken(req){
  const c = parseCookies(req);
  const tok = c.bp_fb ? b64d(c.bp_fb) : null;
  if (!tok) return null;
  if (Date.now() > (tok.exp_at || 0)) return null;
  return tok;
}

export function daysLeft(tok){
  if (!tok || !tok.exp_at) return null;
  return Math.max(0, Math.round((tok.exp_at - Date.now()) / 86400000));
}

export async function graph(path, params = {}, init = {}){
  const url = new URL(GRAPH + path);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (j.error) {
    const e = new Error(j.error.message || 'graph error');
    e.graph = j.error;
    throw e;
  }
  return j;
}

// Exchange a short-lived token for the ~60-day long-lived one. Always do this at callback —
// the raw code-exchange token expires in about an hour.
export async function longLived(shortToken){
  return graph('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    fb_exchange_token: shortToken
  });
}

// Returns [{ pageId, pageName, pageToken, igId, igUsername }]
// Page tokens derived from a long-lived user token do not expire while the user token lives.
export async function listTargets(userToken){
  const pages = await graph('/me/accounts', {
    access_token: userToken,
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    limit: 100
  });
  return (pages.data || []).map(p => ({
    pageId: p.id,
    pageName: p.name,
    pageToken: p.access_token,
    igId: p.instagram_business_account ? p.instagram_business_account.id : null,
    igUsername: p.instagram_business_account ? p.instagram_business_account.username : null
  }));
}

export function bad(res, code, msg, extra){
  return res.status(200).json({ ok: false, code, error: msg, ...(extra || {}) });
}
