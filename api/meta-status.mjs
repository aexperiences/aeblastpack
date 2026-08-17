// AE Blastpack — is Meta connected, and to what?
import { getToken, daysLeft } from './_meta.mjs';

export default async function handler(req, res){
  const tok = await getToken(req);
  if (!tok) return res.status(200).json({ connected: false });
  return res.status(200).json({
    connected: true,
    expiresInDays: daysLeft(tok),
    targets: (tok.targets || []).map(t => ({
      pageId: t.pageId,
      pageName: t.pageName,
      igId: t.igId,
      igUsername: t.igUsername
    }))
  });
}
