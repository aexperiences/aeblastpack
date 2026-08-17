// AE Blastpack — is Meta connected, and to what?
import { getToken, daysLeft, targetsFor } from './_meta.mjs';

export default async function handler(req, res){
  const tok = await getToken(req);
  if (!tok) return res.status(200).json({ connected: false });
  // Pages are resolved live, not read from the cookie — see tokenCookie() in _meta.mjs.
  const targets = await targetsFor(tok);
  return res.status(200).json({
    connected: true,
    expiresInDays: daysLeft(tok),
    targets: targets.map(t => ({
      pageId: t.pageId,
      pageName: t.pageName,
      igId: t.igId,
      igUsername: t.igUsername
    }))
  });
}
