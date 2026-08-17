// AE Blastpack — start the Meta OAuth flow.
import { REDIRECT, SCOPES } from './_meta.mjs';

export default function handler(req, res){
  if (!process.env.META_APP_ID) {
    return res.status(500).send('META_APP_ID not set');
  }
  const ws = (req.query && req.query.ws) || '';
  const state = Buffer.from(JSON.stringify({ ws, n: Math.random().toString(36).slice(2) })).toString('base64url');

  const url = new URL('https://www.facebook.com/v26.0/dialog/oauth');
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_type', 'code');

  res.setHeader('Set-Cookie', `bp_fb_state=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`);
  res.writeHead(302, { Location: url.toString() });
  res.end();
}
