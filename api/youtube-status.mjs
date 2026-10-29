import { gate, notAllowed } from './_lane.mjs';
import { freshToken } from './_yt.mjs';
// AE Blastpack — is YouTube connected for this workspace, and to which channel? Oct 29 2026.
export default async function handler(req, res){
  if (!gate(req)) return notAllowed(res);
  const ws = String(req.query.ws || '');
  const t = await freshToken(ws);
  if (!t) return res.status(200).json({ connected: false });
  return res.status(200).json({ connected: true, channel: t.channel, channelId: t.channelId });
}
