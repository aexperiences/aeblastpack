import { getToken } from './_tt.mjs';
import { gate, notAllowed } from './_lane.mjs';

export const config = { api: { bodyParser: false }, maxDuration: 300 };

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
    /* Who is asking, and which workspace they are allowed to name — see _lane.mjs. */
    if (!gate(req)) return notAllowed(res);
    const tok = await getToken(req, res);
    if (!tok) return res.status(401).json({ ok: false, error: 'not connected' });

    /* TWO WAYS IN (Oct 29 2026). The phone app still pours raw bytes in (small, demo-sized).
       The drains send JSON { mediaUrl, caption }: the file is fetched from its public address
       and uploaded to TikTok in chunks, so a real phone video (hundreds of megabytes) goes
       through without ever touching a request body. */
    let caption = String(req.query.caption || '').slice(0, 2200);
    let video, ctype = req.headers['content-type'] || 'video/mp4';
    if (/application\/json/i.test(String(req.headers['content-type'] || ''))) {
      let b = {}; try { b = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}'); } catch {}
      const mediaUrl = String(b.videoUrl || b.mediaUrl || b.media || '').trim();
      if (!/^https:\/\//.test(mediaUrl)) return res.status(200).json({ ok: false, code: 'bad_media_url', error: 'A video has to sit at a public https URL.' });
      if (b.caption) caption = String(b.caption).slice(0, 2200);
      const src = await fetch(mediaUrl, { redirect: 'follow' });
      if (!src.ok) return res.status(200).json({ ok: false, code: 'bad_media_url', error: 'The file could not be fetched (' + src.status + ').' });
      ctype = String(src.headers.get('content-type') || 'video/mp4').split(';')[0];
      const MAX = 500 * 1024 * 1024;
      const buf = Buffer.from(await src.arrayBuffer());
      if (buf.length > MAX) return res.status(200).json({ ok: false, code: 'too_large', error: 'TikTok through here takes up to five hundred megabytes.' });
      video = buf;
    } else {
      video = await readBody(req, 4 * 1024 * 1024);
    }
    if (!video || !video.length) return res.status(400).json({ ok: false, error: 'no video bytes' });

    /* TikTok's chunking rule: one chunk if the file is under sixty-four megabytes; otherwise
       chunks of thirty-two megabytes, the last one carrying the remainder. */
    const CHUNK = video.length <= 64 * 1024 * 1024 ? video.length : 32 * 1024 * 1024;
    const chunks = Math.max(1, Math.floor(video.length / CHUNK));

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
          chunk_size: CHUNK,
          total_chunk_count: chunks
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
            chunk_size: CHUNK,
            total_chunk_count: chunks
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

    // 3. upload the bytes, chunk by chunk (the last chunk takes the remainder)
    for (let i = 0; i < chunks; i++) {
      const start = i * CHUNK;
      const end = i === chunks - 1 ? video.length - 1 : start + CHUNK - 1;
      const up = await fetch(init2.data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': ctype, 'Content-Range': `bytes ${start}-${end}/${video.length}` },
        body: video.subarray(start, end + 1)
      });
      if (!up.ok && up.status !== 201 && up.status !== 206) {
        return res.status(200).json({ ok: false, error: 'upload failed on chunk ' + (i + 1) + ' of ' + chunks + ': HTTP ' + up.status });
      }
    }

    res.status(200).json({ ok: true, publish_id: init2.data.publish_id, privacy, mode,
      results: { tiktok: { ok: true, mode, note: mode === 'draft' ? 'Landed in the TikTok drafts (app review not cleared yet) — open TikTok and post it from there.' : 'Posted.' } } });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message });
  }
}
