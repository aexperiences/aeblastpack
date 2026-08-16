import { getToken } from './_tt.mjs';

export const config = { api: { bodyParser: false } };

function readBody(req, cap){
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', c => {
      n += c.length;
      if (n > cap) { reject(new Error('video too large for demo pipeline (4MB cap)')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res){
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    const tok = await getToken(req, res);
    if (!tok) return res.status(401).json({ ok: false, error: 'not connected' });

    const caption = String(req.query.caption || '').slice(0, 2200);
    const video = await readBody(req, 4 * 1024 * 1024);
    if (!video.length) return res.status(400).json({ ok: false, error: 'no video bytes' });

    // 1. creator_info — required step; also gives allowed privacy levels
    const ci = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok.at, 'Content-Type': 'application/json' }
    }).then(r => r.json());
    const cd = ci.data || {};
    const privacy = (cd.privacy_level_options || ['SELF_ONLY'])[0];

    // 2. init direct post (FILE_UPLOAD, single chunk)
    const init = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok.at, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_info: {
          title: caption,
          privacy_level: privacy,
          disable_duet: !!cd.duet_disabled,
          disable_comment: !!cd.comment_disabled,
          disable_stitch: !!cd.stitch_disabled
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: video.length,
          chunk_size: video.length,
          total_chunk_count: 1
        }
      })
    }).then(r => r.json());

    let initData = init.data;
    let mode = 'direct';

    // Unaudited clients cannot direct-post to public accounts. Fall back to the
    // creator's TikTok inbox (draft) — supported pre-review — rather than failing.
    if (!initData || !initData.upload_url) {
      const inbox = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tok.at, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: video.length,
            chunk_size: video.length,
            total_chunk_count: 1
          }
        })
      }).then(r => r.json());
      if (!inbox.data || !inbox.data.upload_url) {
        return res.status(200).json({
          ok: false,
          error: (init.error && (init.error.message || init.error.code)) || 'init failed',
          inboxError: (inbox.error && (inbox.error.message || inbox.error.code)) || null
        });
      }
      initData = inbox.data;
      mode = 'draft';
    }
    const init2 = { data: initData };

    // 3. upload the bytes
    const up = await fetch(init2.data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': req.headers['content-type'] || 'video/mp4',
        'Content-Range': `bytes 0-${video.length - 1}/${video.length}`
      },
      body: video
    });
    if (!up.ok && up.status !== 201) {
      return res.status(200).json({ ok: false, error: 'upload failed: HTTP ' + up.status });
    }

    res.status(200).json({ ok: true, publish_id: init2.data.publish_id, privacy, mode });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message });
  }
}
