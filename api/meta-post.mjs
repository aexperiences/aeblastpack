// AE Blastpack — publish to Facebook Page and/or Instagram Reels.
//
// Two very different pipelines behind one call:
//   Facebook Page video  -> POST /{page-id}/videos with file_url, one shot.
//   Instagram Reels      -> create container -> POLL status_code until FINISHED -> publish.
//     Instagram will NOT accept a raw upload here; it fetches video_url itself, so the
//     video must already be at a public HTTPS URL. That is why this endpoint takes a URL
//     and not a file body, unlike the TikTok path.
import { getToken, graph, bad, targetsFor } from './_meta.mjs';
import { gate, notAllowed } from './_lane.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function postPageVideo({ pageId, pageToken, videoUrl, caption }){
  const j = await graph(`/${pageId}/videos`, {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: videoUrl, description: caption || '', access_token: pageToken })
  });
  return { id: j.id, url: j.id ? `https://www.facebook.com/${j.id}` : null };
}

async function postIgReel({ igId, pageToken, videoUrl, caption }){
  const container = await graph(`/${igId}/media`, {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption || '',
      share_to_feed: true,
      access_token: pageToken
    })
  });
  if (!container.id) throw new Error('ig_container_failed');

  // Instagram transcodes asynchronously. Publishing before FINISHED returns a misleading
  // "media not ready" error, so poll. ~90s ceiling covers normal Reels; longer means a
  // real problem worth surfacing rather than hanging the request.
  let status = '', lastErr = '';
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const s = await graph(`/${container.id}`, {
      fields: 'status_code,status',
      access_token: pageToken
    });
    status = s.status_code || '';
    lastErr = s.status || '';
    if (status === 'FINISHED') break;
    if (status === 'ERROR') throw new Error('ig_transcode_failed: ' + lastErr);
  }
  if (status !== 'FINISHED') throw new Error('ig_timeout: still ' + (status || 'unknown'));

  const pub = await graph(`/${igId}/media_publish`, {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: pageToken })
  });
  return { id: pub.id, url: pub.id ? `https://www.instagram.com/reel/${pub.id}` : null };
}

/* ── words on their own, and pictures ─────────────────────────────────────────────────
   Oct 5 2026. Jessica could not queue a written post at all, and when that was fixed in her
   room this door still refused it: it demanded an https video URL and nothing else. A
   Facebook Page takes words with no file, and both Facebook and Instagram take a picture.
   So the door now looks at what it was actually given instead of insisting on one shape.
   Instagram is the one that genuinely cannot take words alone, and it says so by name. */
const PHOTO = /\.(jpe?g|png|webp|gif|heic|heif)(\?|#|$)/i;
const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)(\?|#|$)/i;
export async function kindOf(url, told){   // exported so it can be tested on its own
  if (told === 'words' || told === 'photo' || told === 'video') return told;
  if (!url) return 'words';
  if (PHOTO.test(url)) return 'photo';
  if (VIDEO.test(url)) return 'video';
  /* AE OS hands over a signed link with no file name on the end of it, so the name cannot
     be read for a clue. One HEAD request settles it, and if that is refused the old
     assumption stands rather than guessing a picture is a video or the other way round. */
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const t = String(r.headers.get('content-type') || '').toLowerCase();
    if (t.startsWith('image/')) return 'photo';
    if (t.startsWith('video/')) return 'video';
  } catch (e) {}
  return 'video';            // an unmarked link is treated as a video, as it always was
}

async function postPageWords({ pageId, pageToken, caption }){
  const j = await graph(`/${pageId}/feed`, {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: caption || '', access_token: pageToken })
  });
  return { id: j.id, url: j.id ? `https://www.facebook.com/${j.id}` : null };
}

async function postPagePhoto({ pageId, pageToken, photoUrl, caption }){
  const j = await graph(`/${pageId}/photos`, {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: photoUrl, caption: caption || '', access_token: pageToken })
  });
  const id = j.post_id || j.id;
  return { id, url: id ? `https://www.facebook.com/${id}` : null };
}

async function postIgPhoto({ igId, pageToken, photoUrl, caption }){
  const container = await graph(`/${igId}/media`, {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: photoUrl, caption: caption || '', access_token: pageToken })
  });
  if (!container.id) throw new Error('ig_container_failed');
  /* A picture is ready almost at once, but "almost" is not "always", and publishing early
     returns the same misleading "media not ready". Half a minute of patience, then say so. */
  let status = '';
  for (let i = 0; i < 10; i++) {
    const sres = await graph(`/${container.id}`, { fields: 'status_code,status', access_token: pageToken });
    status = sres.status_code || '';
    if (status === 'FINISHED') break;
    if (status === 'ERROR') throw new Error('ig_photo_failed: ' + (sres.status || ''));
    await sleep(3000);
  }
  if (status && status !== 'FINISHED') throw new Error('ig_timeout: still ' + status);
  const pub = await graph(`/${igId}/media_publish`, {}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: pageToken })
  });
  return { id: pub.id, url: pub.id ? `https://www.instagram.com/p/${pub.id}` : null };
}

export default async function handler(req, res){
  if (req.method !== 'POST') return bad(res, 'method', 'POST only');

  /* Who is asking, and which workspace they are allowed to name — see _lane.mjs. */
  if (!gate(req)) return notAllowed(res);

  const tok = await getToken(req);
  if (!tok) return bad(res, 'not_connected', 'Meta not connected, or the 60-day token expired. Reconnect.');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const { caption, pageId, targets = ['facebook', 'instagram'] } = body;
  const mediaUrl = String(body.videoUrl || body.mediaUrl || body.media || '').trim();
  if (mediaUrl && !/^https:\/\//.test(mediaUrl)) {
    return bad(res, 'bad_media_url', 'A file has to sit at a public https URL — Meta fetches it itself.');
  }
  const kind = await kindOf(mediaUrl, body.kind);
  if (kind === 'words' && !String(caption || '').trim()) {
    return bad(res, 'nothing_to_post', 'There is nothing to post: no words and no file.');
  }

  // Pages are resolved live, not read from the cookie — see tokenCookie() in _meta.mjs.
  const all = await targetsFor(tok);
  const target = all.find(t => !pageId || t.pageId === pageId) || all[0];
  if (!target) return bad(res, 'no_target', 'No Page available on this connection.');

  const results = {};

  if (targets.includes('facebook')) {
    try {
      const out = kind === 'words' ? await postPageWords({ ...target, caption })
                : kind === 'photo' ? await postPagePhoto({ ...target, photoUrl: mediaUrl, caption })
                :                    await postPageVideo({ ...target, videoUrl: mediaUrl, caption });
      results.facebook = { ok: true, kind, ...out };
    } catch (e) {
      results.facebook = { ok: false, kind, error: e.message, graph: e.graph || null };
    }
  }

  if (targets.includes('instagram')) {
    if (!target.igId) {
      results.instagram = { ok: false, error: 'No Instagram Business account is linked to Page "' + target.pageName + '". Link it in Meta Business Suite.' };
    } else if (kind === 'words') {
      results.instagram = { ok: false, kind, error: 'Instagram will not take words on their own. Add a picture or a video, or send this one to Facebook by itself.' };
    } else {
      try {
        const out = kind === 'photo' ? await postIgPhoto({ ...target, photoUrl: mediaUrl, caption })
                                     : await postIgReel({ ...target, videoUrl: mediaUrl, caption });
        results.instagram = { ok: true, kind, ...out };
      } catch (e) {
        results.instagram = { ok: false, kind, error: e.message, graph: e.graph || null };
      }
    }
  }

  const anyOk = Object.values(results).some(r => r && r.ok);
  return res.status(200).json({ ok: anyOk, page: target.pageName, ig: target.igUsername || null, results });
}
