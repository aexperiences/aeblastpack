/* /api/blob-token — a one-time pass for the browser to put a video straight into Blob.
 * Accelerated Experiences LLC · Oct 30 2026
 *
 * WHY. A Vercel function refuses any request body over about four and a half megabytes, so a
 * real phone video can never be poured through meta-upload or tiktok-post. The browser gets
 * this short-lived pass instead, uploads the file to Blob itself (in parts, so it can be big),
 * and then hands the posting door the file's public address — the path YouTube already used.
 *
 * The pass names one random path, video types only, up to five hundred megabytes, and dies in
 * fifteen minutes. Same gate as every other door (_lane.mjs).
 */
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { gate, notAllowed } from './_lane.mjs';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!gate(req)) return notAllowed(res);
  const rw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!rw) return res.status(200).json({ ok: false, code: 'no_blob_token', error: 'BLOB_READ_WRITE_TOKEN is not set.' });
  const type = String(req.query.type || 'video/mp4');
  const ext = /quicktime/.test(type) ? 'mov' : 'mp4';
  const pathname = `blastpack/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  try {
    const token = await generateClientTokenFromReadWriteToken({
      token: rw,
      pathname,
      allowedContentTypes: ['video/*'],
      maximumSizeInBytes: 500 * 1024 * 1024,
      validUntil: Date.now() + 15 * 60 * 1000,
    });
    return res.status(200).json({ ok: true, pathname, token });
  } catch (e) {
    return res.status(200).json({ ok: false, code: 'token_failed', error: String((e && e.message) || e) });
  }
}
