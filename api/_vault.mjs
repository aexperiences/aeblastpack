// AE Blastpack — the vault. Where a connection actually lives.
// Accelerated Experiences LLC · Oct 3 2026
//
// Anthony, Oct 3 2026: "no more guessing. I'm not on a fucking scavenger hunt."
//
// WHY THIS EXISTS. Until today a connection lived in a browser cookie (bp_tt, bp_fb). That
// made three things true at once, and all three looked like bugs somewhere else:
//   · "Connected" meant "connected in this one browser." Jessica's browser said yes, his said
//     no, and both were telling the truth about nothing anyone cares about.
//   · One cookie served EVERY workspace in that browser, so his workspace could have posted
//     to her account without either of them doing anything wrong.
//   · A scheduler has no browser, so it had no token — which is why nothing ever drained the
//     queue. That was never a missing drainer. It was a missing vault.
//
// So a connection is kept here instead: one record per workspace per platform, in this
// project's own Blob store, sealed with AES-256-GCM under a key derived from two secrets this
// project already holds. Nothing new has to be issued, pasted or stored anywhere.
//
// ON THE STORE BEING PUBLIC. Blastpack's Blob store was created public, and a store cannot be
// switched after the fact — a private one has to be made, which this lane does not have the
// permission to do. A public store means an object can be read by anyone who knows its exact
// URL. It does NOT mean anyone can list it. So two things carry the weight instead, and both
// have to fail before anything leaks:
//   1. The pathname is an HMAC of the workspace and platform under the same derived key —
//      192 bits with no structure to attack. It cannot be guessed or walked.
//   2. The body is AES-256-GCM. A URL alone yields ciphertext and nothing else, and a single
//      altered byte makes it refuse to open rather than hand back something half-trusted.
// When a private store can be created, this becomes a one-word change: 'public' -> 'private'
// in save(), and nothing else moves.
//
// It is deliberately FAIL-SOFT. Every call swallows its own errors and returns null. If the
// store is cold, the key material is missing, or anything at all goes wrong, the caller falls
// back to the cookie and the app behaves exactly as it did before. The vault can make this
// better; it is not allowed to make it worse.

import { createHmac, createCipheriv, createDecipheriv, hkdfSync } from 'node:crypto';
import { put, head, del, list } from '@vercel/blob';

const SECRETS = () => String(process.env.META_APP_SECRET || '') + '|' + String(process.env.TIKTOK_CLIENT_SECRET || '');
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || '';

function ready() { return !!TOKEN() && SECRETS().length > 8; }

/* One key, derived. Never written down, never an env var of its own, never printed. */
let KEY = null;
function key() {
  if (KEY) return KEY;
  KEY = Buffer.from(hkdfSync('sha256', Buffer.from(SECRETS()), Buffer.from('ae-blastpack-vault-v1'),
    Buffer.from('connection seal'), 32));
  return KEY;
}

/* THE SHAPE, AND WHY IT IS THIS SHAPE.
   A freshly written public blob is known to the API at once but is not fetchable at its URL
   for a long while — long enough that a room asking "is this connected?" right after a
   sign-in got a 404 and said no. That is precisely the ghost this vault exists to end, and no
   amount of retrying fixes it.
   So a record is kept as a FOLDER, not a file:
       conn/<hmac of workspace+platform>/<the plain facts, base64url>.bin
   The folder name is an HMAC, so it cannot be guessed. The plain facts — which account, when
   the sign-in runs out — ride in the FILE NAME, and a file name comes back from list(), which
   is an API call and answers immediately. The secret itself is the body, sealed, and the body
   is only ever read when something is actually about to post, by which time it has long since
   settled. The status door therefore never touches a secret and never waits on the edge. */
export function prefixFor(ws, platform) {
  const h = createHmac('sha256', key()).update(String(ws || '') + '\u0000' + String(platform || '')).digest('hex');
  return 'conn/' + h.slice(0, 48) + '/';
}
const tagOf = (facts) => Buffer.from(JSON.stringify(facts || {}), 'utf8').toString('base64url').slice(0, 700);
const factsOf = (tag) => { try { return JSON.parse(Buffer.from(String(tag || ''), 'base64url').toString('utf8')); } catch (e) { return {}; } };

function seal(obj) {
  const iv = Buffer.from(createHmac('sha256', key()).update(String(Date.now()) + Math.random()).digest()).subarray(0, 12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), 'utf8')), c.final()]);
  return Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), body]);   // 1 | iv(12) | tag(16) | body
}
function unseal(buf) {
  if (!buf || buf.length < 30 || buf[0] !== 1) return null;
  const iv = buf.subarray(1, 13), tag = buf.subarray(13, 29), body = buf.subarray(29);
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
}

export async function save(ws, platform, tok, facts) {
  if (!ready() || !ws) return false;
  const prefix = prefixFor(ws, platform);
  try {
    /* One record per person per platform. Reconnecting replaces the old one rather than
       leaving two, which is how a stale token would otherwise survive a re-sign-in. */
    try {
      const old = await list({ prefix, token: TOKEN() });
      for (const b of (old.blobs || [])) await del(b.url, { token: TOKEN() });
    } catch (e) {}
    await put(prefix + tagOf(facts) + '.bin', seal({ ...tok, ws, platform, savedAt: Date.now() }), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/octet-stream', cacheControlMaxAge: 0, token: TOKEN()
    });
    return true;
  } catch (e) { return false; }
}

/* Is it connected, and to what? Answered from the file name through list(), so it is true the
   instant a sign-in finishes and it never reads a secret to tell you. */
export async function peek(ws, platform) {
  if (!ready() || !ws) return null;
  try {
    const r = await list({ prefix: prefixFor(ws, platform), token: TOKEN() });
    const b = (r.blobs || [])[0];
    if (!b) return null;
    const tag = b.pathname.slice(prefixFor(ws, platform).length).replace(/\.bin$/, '');
    return { facts: factsOf(tag), at: b.uploadedAt || null, url: b.url };
  } catch (e) { return null; }
}

export async function load(ws, platform, trace) {
  if (!ready() || !ws) return null;
  const found = await peek(ws, platform);
  if (!found || !found.url) { if (trace) trace.push({ step: 'peek', error: 'no record' }); return null; }
  /* The body is only needed when something is about to post. It can still be a moment behind
     the edge right after a sign-in, so it gets a few tries — but nothing a person looks at
     ever waits on this. */
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((go) => setTimeout(go, 500));
    try {
      const fresh = found.url + (found.url.indexOf('?') < 0 ? '?' : '&')
                  + 'nocache=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const r = await fetch(fresh, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
      if (!r.ok) { if (trace) trace.push({ attempt, step: 'fetch', status: r.status }); continue; }
      const out = unseal(Buffer.from(await r.arrayBuffer()));
      if (out) return out;
      if (trace) trace.push({ attempt, step: 'unseal', error: 'did not open' });
    } catch (e) {
      if (trace) trace.push({ attempt, step: 'fetch', error: String((e && e.message) || e).slice(0, 120) });
    }
  }
  return null;
}

export async function drop(ws, platform) {
  if (!ready() || !ws) return false;
  try {
    const r = await list({ prefix: prefixFor(ws, platform), token: TOKEN() });
    for (const b of (r.blobs || [])) await del(b.url, { token: TOKEN() });
    return true;
  } catch (e) { return false; }
}

/* Diagnostics only. Everything above hides its errors on purpose, because a vault that
   throws must never take a room down with it — but a vault that quietly refuses every write
   looks exactly like "nothing is connected", so there has to be one way to ask it why. */
export async function why() {
  const out = { hasStoreToken: !!TOKEN(), hasKeyMaterial: SECRETS().length > 8, steps: [] };
  if (!out.hasStoreToken || !out.hasKeyMaterial) return out;
  const facts = { n: 'self check', x: 0 };
  try {
    const ok = await save('__selftest', 'probe', { at: 'not-a-token' }, facts);
    out.steps.push({ step: 'save', ok });
  } catch (e) { out.steps.push({ step: 'save', ok: false, error: String((e && e.message) || e).slice(0, 200) }); return out; }
  try {
    const p = await peek('__selftest', 'probe');
    out.steps.push({ step: 'peek', ok: !!p, facts: p && p.facts, matched: !!(p && p.facts && p.facts.n === 'self check') });
  } catch (e) { out.steps.push({ step: 'peek', ok: false, error: String((e && e.message) || e).slice(0, 200) }); }
  try { await drop('__selftest', 'probe'); out.steps.push({ step: 'drop', ok: true }); }
  catch (e) { out.steps.push({ step: 'drop', ok: false, error: String((e && e.message) || e).slice(0, 200) }); }
  return out;
}

/* Which workspace is this request about? The room says so in the query; the app says so in the
   cookie it set when the connect started. Anything else is a guess, and we do not guess. */
export function wsOf(req, cookies) {
  const q = (req && req.query && (req.query.ws || req.query.workspace)) || '';
  const c = (cookies && (cookies.bp_ws || cookies.bp_tt_ws || cookies.bp_fb_ws)) || '';
  return String(q || c || '').slice(0, 64).trim();
}
