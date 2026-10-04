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
// project's own Blob store, written private (not readable by URL) and sealed on top of that
// with AES-256-GCM. The seal key is derived from two secrets this project already holds, so
// nothing new has to be issued, pasted or stored anywhere.
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
      access: 'private', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/octet-stream', cacheControlMaxAge: 0, token: TOKEN()
    });
    return true;
  } catch (e) { return false; }
}

export async function load(ws, platform) {
  if (!ready() || !ws) return null;
  try {
    const meta = await head(pathFor(ws, platform), { token: TOKEN() });
    if (!meta || !meta.downloadUrl) return null;
    const r = await fetch(meta.downloadUrl, { cache: 'no-store' });
    if (!r.ok) return null;
    return unseal(Buffer.from(await r.arrayBuffer()));
  } catch (e) { return null; }
}

export async function drop(ws, platform) {
  if (!ready() || !ws) return false;
  try { await del(pathFor(ws, platform), { token: TOKEN() }); return true; }
  catch (e) { return false; }
}

/* Which workspace is this request about? The room says so in the query; the app says so in the
   cookie it set when the connect started. Anything else is a guess, and we do not guess. */
export function wsOf(req, cookies) {
  const q = (req && req.query && (req.query.ws || req.query.workspace)) || '';
  const c = (cookies && (cookies.bp_ws || cookies.bp_tt_ws || cookies.bp_fb_ws)) || '';
  return String(q || c || '').slice(0, 64).trim();
}
