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
import { put, head, del } from '@vercel/blob';

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

/* The path is an HMAC, so the record cannot be found by guessing a workspace name even if the
   store were ever made public by mistake. Private access is the lock; this is the second one. */
export function pathFor(ws, platform) {
  const h = createHmac('sha256', key()).update(String(ws || '') + '\u0000' + String(platform || '')).digest('hex');
  return 'conn/' + h.slice(0, 48) + '.bin';
}

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

export async function save(ws, platform, tok) {
  if (!ready() || !ws) return false;
  try {
    await put(pathFor(ws, platform), seal({ ...tok, ws, platform, savedAt: Date.now() }), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/octet-stream', cacheControlMaxAge: 0, token: TOKEN()
    });
    return true;
  } catch (e) { return false; }
}

/* A public blob is served through a CDN, and the CDN keys on the URL. Reconnecting an account
   overwrites the record at the same path, so a plain read can come back with the PREVIOUS
   token — which would look exactly like "connected", post to the wrong account, and be
   impossible to see from outside. cacheControlMaxAge: 0 is not enough on its own, so every
   read carries a value that has never been requested before and therefore cannot be cached. */
export async function load(ws, platform) {
  if (!ready() || !ws) return null;
  try {
    const meta = await head(pathFor(ws, platform), { token: TOKEN() });
    if (!meta || !meta.downloadUrl) return null;
    const fresh = meta.downloadUrl + (meta.downloadUrl.indexOf('?') < 0 ? '?' : '&')
                + 'nocache=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const r = await fetch(fresh, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) return null;
    return unseal(Buffer.from(await r.arrayBuffer()));
  } catch (e) { return null; }
}

export async function drop(ws, platform) {
  if (!ready() || !ws) return false;
  try { await del(pathFor(ws, platform), { token: TOKEN() }); return true; }
  catch (e) { return false; }
}

/* Diagnostics only. Everything above hides its errors on purpose, because a vault that
   throws must never take a room down with it — but a vault that quietly refuses every write
   looks exactly like "nothing is connected", so there has to be one way to ask it why. */
export async function why() {
  const out = { hasStoreToken: !!TOKEN(), hasKeyMaterial: SECRETS().length > 8, steps: [] };
  if (!out.hasStoreToken || !out.hasKeyMaterial) return out;
  const path = pathFor('__selftest', 'probe');
  try {
    const r = await put(path, seal({ at: 'not-a-token', probe: 1 }), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/octet-stream', cacheControlMaxAge: 0, token: TOKEN()
    });
    out.steps.push({ step: 'put', ok: true, pathname: r && r.pathname });
  } catch (e) {
    out.steps.push({ step: 'put', ok: false, error: String((e && e.message) || e).slice(0, 300),
                     name: String((e && e.name) || '') });
    return out;
  }
  let h = null;
  try { h = await head(path, { token: TOKEN() }); out.steps.push({ step: 'head', ok: true, size: h && h.size, hasDownloadUrl: !!(h && h.downloadUrl), hasUrl: !!(h && h.url) }); }
  catch (e) { out.steps.push({ step: 'head', ok: false, error: String((e && e.message) || e).slice(0, 300) }); }
  /* The whole read, end to end, saying what came back at every stage. The put/head pair was
     passing while the round trip failed, which means the answer is in here and nowhere else. */
  for (const which of ['downloadUrl', 'url']) {
    const base = h && h[which];
    if (!base) { out.steps.push({ step: 'fetch:' + which, ok: false, error: 'not returned by head' }); continue; }
    try {
      const fresh = base + (base.indexOf('?') < 0 ? '?' : '&') + 'nocache=' + Date.now().toString(36);
      const r = await fetch(fresh, { cache: 'no-store' });
      const buf = Buffer.from(await r.arrayBuffer());
      const row = { step: 'fetch:' + which, ok: r.ok, status: r.status, bytes: buf.length,
                    firstByte: buf.length ? buf[0] : null,
                    type: r.headers.get('content-type') || '',
                    head16: buf.subarray(0, 16).toString('hex') };
      if (r.ok) {
        try { const o = unseal(buf); row.unsealed = !!o; row.sawProbe = o ? o.probe : null; }
        catch (e) { row.unsealed = false; row.unsealError = String((e && e.message) || e).slice(0, 160); }
      } else {
        row.body = buf.subarray(0, 160).toString('utf8');
      }
      out.steps.push(row);
    } catch (e) {
      out.steps.push({ step: 'fetch:' + which, ok: false, error: String((e && e.message) || e).slice(0, 300) });
    }
  }
  try { await del(path, { token: TOKEN() }); out.steps.push({ step: 'del', ok: true }); }
  catch (e) { out.steps.push({ step: 'del', ok: false, error: String((e && e.message) || e).slice(0, 300) }); }
  return out;
}

/* Which workspace is this request about? The room says so in the query; the app says so in the
   cookie it set when the connect started. Anything else is a guess, and we do not guess. */
export function wsOf(req, cookies) {
  const q = (req && req.query && (req.query.ws || req.query.workspace)) || '';
  const c = (cookies && (cookies.bp_ws || cookies.bp_tt_ws || cookies.bp_fb_ws)) || '';
  return String(q || c || '').slice(0, 64).trim();
}
