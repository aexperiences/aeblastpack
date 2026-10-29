// AE Blastpack — YouTube, the shared bits. Accelerated Experiences LLC · Oct 29 2026
//
// Anthony, Oct 29 2026: "Facebook, Instagram, and YouTube are the most important thing for me."
// YouTube had no door. This is the door: Google sign-in once per workspace, the refresh token
// kept in the vault (never in a browser), a fresh access token minted on every post, and a
// resumable upload fed from the file's public address — the same address Facebook fetches.
//
// Keys (his to paste in Vercel): GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from a Google Cloud
// OAuth client of type "Web application" with the redirect below. The upload scope is a
// "sensitive" one, so Google shows an unverified-app screen until the consent screen is
// verified; his own account can go through it in Testing mode meanwhile.
import { BASE } from './_tt.mjs';
import { load as vaultLoad } from './_vault.mjs';

export const REDIRECT = BASE + 'auth/youtube/callback';
export const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

export function parseCookies(req){
  const out = {};
  String((req.headers && req.headers.cookie) || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export async function exchange(code){
  const body = new URLSearchParams({
    code, client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: REDIRECT, grant_type: 'authorization_code'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  return r.json();
}

/* A fresh access token from the refresh token kept in the vault. Google's access tokens last
   an hour; the refresh token lasts until he revokes it (or six months of no use in Testing mode). */
export async function freshToken(ws){
  const tok = await vaultLoad(ws, 'youtube');
  if (!tok || !tok.rt) return null;
  const body = new URLSearchParams({
    refresh_token: tok.rt, client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    grant_type: 'refresh_token'
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json();
  if (!j.access_token) return null;
  return { at: j.access_token, channel: tok.channel || '', channelId: tok.channelId || '' };
}

export async function channelOf(at){
  const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { authorization: 'Bearer ' + at } });
  const j = await r.json();
  const c = (j.items || [])[0];
  return c ? { channel: (c.snippet && c.snippet.title) || '', channelId: c.id || '' } : { channel: '', channelId: '' };
}
