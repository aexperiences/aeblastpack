import crypto from 'node:crypto';
import { REDIRECT, SCOPES } from './_yt.mjs';
// AE Blastpack — start the Google sign-in for YouTube. Oct 29 2026.
export default function handler(req, res){
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) return res.status(500).send('GOOGLE_CLIENT_ID not set — paste it in Vercel env vars.');
  const state = crypto.randomBytes(16).toString('hex');
  const ws = String(req.query.ws || '').slice(0, 48);
  res.setHeader('Set-Cookie', [
    `bp_yt_state=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `bp_yt_ws=${encodeURIComponent(ws)}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`
  ]);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', id);
  u.searchParams.set('redirect_uri', REDIRECT);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SCOPES.join(' '));
  u.searchParams.set('access_type', 'offline');   // the refresh token is the whole point
  u.searchParams.set('prompt', 'consent');        // and Google only hands it over on a consent prompt
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('state', state);
  res.statusCode = 302; res.setHeader('Location', u.toString()); res.end();
}
