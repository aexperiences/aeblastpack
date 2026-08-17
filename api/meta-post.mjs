// AE Blastpack — publish to Facebook Page and/or Instagram Reels.
//
// Two very different pipelines behind one call:
//   Facebook Page video  -> POST /{page-id}/videos with file_url, one shot.
//   Instagram Reels      -> create container -> POLL status_code until FINISHED -> publish.
//     Instagram will NOT accept a raw upload here; it fetches video_url itself, so the
//     video must already be at a public HTTPS URL. That is why this endpoint takes a URL
//     and not a file body, unlike the TikTok path.
import { getToken, graph, bad } from './_meta.mjs';

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

export default async function handler(req, res){
  if (req.method !== 'POST') return bad(res, 'method', 'POST only');

  const tok = await getToken(req);
  if (!tok) return bad(res, 'not_connected', 'Meta not connected, or the 60-day token expired. Reconnect.');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const { videoUrl, caption, pageId, targets = ['facebook', 'instagram'] } = body;
  if (!videoUrl || !/^https:\/\//.test(videoUrl)) {
    return bad(res, 'bad_video_url', 'videoUrl must be a public https URL — Meta fetches the file itself.');
  }

  const target = (tok.targets || []).find(t => !pageId || t.pageId === pageId) || (tok.targets || [])[0];
  if (!target) return bad(res, 'no_target', 'No Page available on this connection.');

  const results = {};

  if (targets.includes('facebook')) {
    try {
      results.facebook = { ok: true, ...await postPageVideo({ ...target, videoUrl, caption }) };
    } catch (e) {
      results.facebook = { ok: false, error: e.message, graph: e.graph || null };
    }
  }

  if (targets.includes('instagram')) {
    if (!target.igId) {
      results.instagram = { ok: false, error: 'No Instagram Business account is linked to Page "' + target.pageName + '". Link it in Meta Business Suite.' };
    } else {
      try {
        results.instagram = { ok: true, ...await postIgReel({ ...target, videoUrl, caption }) };
      } catch (e) {
        results.instagram = { ok: false, error: e.message, graph: e.graph || null };
      }
    }
  }

  const anyOk = Object.values(results).some(r => r && r.ok);
  return res.status(200).json({ ok: anyOk, page: target.pageName, ig: target.igUsername || null, results });
}
