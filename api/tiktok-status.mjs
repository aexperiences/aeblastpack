import { getToken } from './_tt.mjs';

export default async function handler(req, res){
  const tok = await getToken(req, res);
  if (!tok) return res.status(401).json({ ok: false, error: 'not connected' });
  const id = String(req.query.publish_id || '');
  const r = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok.at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publish_id: id })
  });
  const j = await r.json();
  const d = j.data || {};
  res.status(200).json({ ok: true, status: d.status || 'UNKNOWN', reason: d.fail_reason || '' });
}
