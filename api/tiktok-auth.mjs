import crypto from 'node:crypto';
import { REDIRECT } from './_tt.mjs';

export default function handler(req, res){
  const key = process.env.TIKTOK_CLIENT_KEY;
  if (!key) return res.status(500).send('TIKTOK_CLIENT_KEY not set — paste it in Vercel env vars.');
  const state = crypto.randomBytes(16).toString('hex');
  const ws = String(req.query.ws || '').slice(0, 48);
  res.setHeader('Set-Cookie', [
    `bp_tt_state=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `bp_tt_ws=${encodeURIComponent(ws)}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`
  ]);
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.searchParams.set('client_key', key);
  u.searchParams.set('scope', 'user.info.basic,video.publish,video.upload');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', REDIRECT);
  u.searchParams.set('state', state);
  res.statusCode = 302;
  res.setHeader('Location', u.toString());
  res.end();
}
