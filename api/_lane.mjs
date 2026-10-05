/* AE Blastpack — who is allowed to name a workspace.
 *
 * Oct 5 2026. Until Oct 3 the only way to reach a posting door was the cookie this browser
 * was handed when it connected, so "?ws=" did not exist and nothing could be aimed at
 * somebody else's account. The vault made "?ws=" mean something real, and for two days that
 * meant a stranger who typed ?ws=nd could have posted to Jessica's Facebook Page the moment
 * it was connected. Nothing had been connected yet, so nothing happened. This is the proof
 * that was missing, written before the first connection rather than after.
 *
 * Two callers are legitimate, and no third one is:
 *
 *   the lane    x-bp-lane matches BP_LANE_KEY. That is AE OS's own proxy (/api/nd-blast on
 *               aexperiences.com, behind her ND OS sign-in) and the drainer that sends the
 *               queue out on a schedule. The lane may name any workspace, because AE OS has
 *               already proven who is asking. The key is a machine key, it belongs to no
 *               person, and it is only ever in the two Vercel projects.
 *
 *   a browser   it holds the cookie it was given when it connected. The workspace comes from
 *               that cookie and never from the query string, so a browser can only ever
 *               reach the connection it made itself. This is exactly what was true before
 *               the vault, kept working so the Blastpack app on his phone does not break.
 *
 * A browser that connected before Oct 3 2026 holds bp_fb or bp_tt and no bp_ws at all. It
 * names nobody, so it is let through with an empty workspace and the old cookie path picks
 * it up. Losing those would mean asking him to reconnect for no reason.
 */
import { timingSafeEqual } from 'node:crypto';

const LANE = () => String(process.env.BP_LANE_KEY || '').trim();

function same(a, b) {
  const x = Buffer.from(String(a), 'utf8'), y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length || !x.length) return false;
  try { return timingSafeEqual(x, y); } catch (e) { return false; }
}

function cookies(req) {
  const h = (req && req.headers && req.headers.cookie) || '';
  const out = {};
  String(h).split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) {} }
  });
  return out;
}

const qws = (req) => String((req && req.query && (req.query.ws || req.query.workspace)) || '')
  .slice(0, 64).trim();

/* Returns { via, ws } for a caller that is allowed, or null.
   It also rewrites req.query.ws to the workspace the caller has actually proven, so every
   door downstream reads the authorized one through the same wsOf() it already used. */
export function gate(req) {
  let out = null;
  const key = LANE(), given = String((req && req.headers && req.headers['x-bp-lane']) || '').trim();

  if (key && given && same(given, key)) {
    const ws = qws(req);
    out = ws ? { via: 'lane', ws } : null;
  } else {
    const c = cookies(req);
    const ws = String(c.bp_ws || c.bp_tt_ws || c.bp_fb_ws || '').slice(0, 64).trim();
    if (ws) out = { via: 'browser', ws };
    else if (c.bp_fb || c.bp_tt) out = { via: 'legacy', ws: '' };
  }

  /* The rewrite is the whole safety property, not a convenience: if the query cannot be
     overwritten then wsOf() downstream would read the caller's own ?ws= again and the hole
     would be back. So it fails closed. This runs fine on Vercel today — proved live before
     this was written — and if the runtime ever changes, posting stops instead of opening. */
  try {
    if (!req.query || typeof req.query !== 'object') req.query = {};
    req.query.ws = out ? out.ws : '';
    delete req.query.workspace;
    if (req.query.ws !== (out ? out.ws : '')) return null;
  } catch (e) { return null; }
  return out;
}

/* The one refusal, worded the same everywhere so nothing has to guess. */
export function notAllowed(res) {
  res.statusCode = 401;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({
    ok: false,
    error: 'not_allowed',
    message: 'This door needs either the browser that connected the account, or AE OS asking on your behalf. Open it from your own office or from the Blastpack app.'
  }));
  return;
}
