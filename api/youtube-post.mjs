// AE Blastpack — publish a video to YouTube from a public link. Accelerated Experiences LLC · Oct 29 2026
//
// POST ?ws=…  { mediaUrl, title, caption, privacy? }   (lane key or the connecting browser, see _lane.mjs)
//
// The file is fetched from its public address and streamed straight into a YouTube resumable
// upload — it never lands on disk and never passes through a request body, so the platform's
// body cap does not apply. A vertical file becomes a Short on YouTube's side by itself.
// Title: the first line of the caption, cut to YouTube's hundred characters, unless one is given.
import { gate, notAllowed } from './_lane.mjs';
import { freshToken } from './_yt.mjs';

export const config = { maxDuration: 300 };

const bad = (res, code, msg) => res.status(200).json({ ok: false, code, error: msg });

export function titleFrom(caption, title){
  const t = String(title || '').trim() || String(caption || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || 'New video';
  return t.replace(/[<>]/g, '').slice(0, 100);
}

export default async function handler(req, res){
  if (req.method !== 'POST') return bad(res, 'method', 'POST only');
  if (!gate(req)) return notAllowed(res);
  const ws = String(req.query.ws || '');
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } } body = body || {};
  const mediaUrl = String(body.videoUrl || body.mediaUrl || body.media || '').trim();
  if (!/^https:\/\//.test(mediaUrl)) return bad(res, 'bad_media_url', 'A video has to sit at a public https URL.');
  const t = await freshToken(ws);
  if (!t) return bad(res, 'not_connected', 'YouTube not connected for this workspace. Connect it from the room.');

  const title = titleFrom(body.caption, body.title);
  const description = String(body.caption || '').slice(0, 5000);
  const privacy = ['public', 'unlisted', 'private'].includes(body.privacy) ? body.privacy : 'public';

  /* 1. the file: its size and type, then its bytes as a stream */
  const src = await fetch(mediaUrl, { redirect: 'follow' });
  if (!src.ok || !src.body) return bad(res, 'bad_media_url', 'The file could not be fetched (' + src.status + ').');
  const type = String(src.headers.get('content-type') || 'video/mp4').split(';')[0];
  const size = Number(src.headers.get('content-length') || 0);
  if (!type.startsWith('video/')) return bad(res, 'not_video', 'YouTube takes video only; this link is ' + type + '.');

  /* 2. open the resumable upload */
  const open = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + t.at, 'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': type, ...(size ? { 'x-upload-content-length': String(size) } : {})
    },
    body: JSON.stringify({ snippet: { title, description, categoryId: '22' }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } })
  });
  if (!open.ok) {
    const e = await open.text().catch(() => '');
    return bad(res, 'youtube_refused', 'YouTube would not open the upload (' + open.status + '): ' + e.slice(0, 300));
  }
  const where = open.headers.get('location');
  if (!where) return bad(res, 'youtube_refused', 'YouTube gave no upload address.');

  /* 3. pour the bytes in */
  const up = await fetch(where, {
    method: 'PUT',
    headers: { 'content-type': type, ...(size ? { 'content-length': String(size) } : {}) },
    body: src.body, duplex: 'half'
  });
  const j = await up.json().catch(() => ({}));
  if (!up.ok || !j.id) return bad(res, 'youtube_failed', 'The upload did not finish (' + up.status + '): ' + JSON.stringify(j).slice(0, 300));
  return res.status(200).json({ ok: true, id: j.id, url: 'https://youtu.be/' + j.id, channel: t.channel, title, privacy,
    results: { youtube: { ok: true, id: j.id, url: 'https://youtu.be/' + j.id } } });
}
