// AE Blastpack — stage a video at a public HTTPS URL so Meta can fetch it.
//
// Why this exists: TikTok accepts a raw upload. Instagram and Facebook do NOT — they take
// a `video_url` and fetch the file themselves. The browser only has a blob: URL, which is
// local to the tab and unreachable from Meta's servers. So the file gets parked in Vercel
// Blob first and meta-post is handed the resulting public URL.
//
// Talks to the Blob REST API with plain fetch — no npm dependency, matching the rest of
// this codebase.
export const config = { api: { bodyParser: false } };

const MAX_BYTES = 200 * 1024 * 1024; // Meta's Reels ceiling is 1GB but Vercel's request
                                     // body limit is far lower; fail loudly, not silently.

async function readBody(req){
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > MAX_BYTES) throw new Error('too_large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(200).json({ ok: false, error: 'POST only' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(200).json({
      ok: false,
      code: 'no_blob_token',
      error: 'BLOB_READ_WRITE_TOKEN is not set. Create a Blob store on the Vercel project — Meta cannot fetch a local file.'
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(200).json({ ok: false, code: 'too_large', error: 'Video exceeds the 200 MB staging limit.' });
  }
  if (!body.length) return res.status(200).json({ ok: false, code: 'empty', error: 'No video received.' });

  const type = req.headers['content-type'] || 'video/mp4';
  const ext = type.includes('quicktime') ? 'mov' : 'mp4';
  // Random name, not user-supplied: never trust a filename into a path.
  const name = `blastpack/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const r = await fetch(`https://blob.vercel-storage.com/${name}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-version': '7',
        'x-content-type': type,
        'x-add-random-suffix': '0',
        // Meta needs to read this without credentials.
        'x-access': 'public'
      },
      body
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) {
      return res.status(200).json({ ok: false, code: 'blob_failed', error: j.error || `blob upload failed (${r.status})` });
    }
    return res.status(200).json({ ok: true, url: j.url, bytes: body.length });
  } catch (e) {
    return res.status(200).json({ ok: false, code: 'exception', error: e.message });
  }
}
