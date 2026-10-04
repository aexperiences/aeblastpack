// /api/connections — the one place anything asks "what is actually connected?"
// Accelerated Experiences LLC · Oct 3 2026
//
// Anthony, Oct 3 2026: "no more guessing." Before today every room that wanted to show a
// connection state had it written into the page by hand, which is how his room could say
// Facebook was connected while his browser held no connection at all, and how hers could say
// nothing was connected while Jessica was posting fine. Neither page was lying on purpose.
// Neither page had any way to know.
//
// So nothing is written into a page again. A room asks here and prints the answer.
//
//   GET /connections?ws=anthony    -> the state of every platform for that workspace
//
// It reads the VAULT, not a cookie, so the answer is the same on his laptop, on her phone,
// and in a scheduled job at two in the morning. It is readable from any origin (his office is
// on aexperiences.studio, hers is on aexperiences.com) and it carries no secret of any kind —
// only whether a door is open, to which account, and for how much longer.

import { load } from './_vault.mjs';
import { daysLeft, targetsFor } from './_meta.mjs';

/* What exists, and what honestly does not. A platform with no door says so plainly rather
   than sitting in the list looking like it is one sign-in away. */
const PLATFORMS = [
  { k: 'tiktok',    name: 'TikTok',    built: true },
  { k: 'meta',      name: 'Facebook and Instagram', built: true, covers: ['facebook', 'instagram'] },
  { k: 'youtube',   name: 'YouTube',   built: false, why: 'No door built yet. Nothing here can post to YouTube.' },
  { k: 'x',         name: 'X',         built: false, why: 'No door built yet, and X charges per post, so it is an add-on rather than included.' }
];

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('cache-control', 'no-store');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const ws = String((req.query && (req.query.ws || req.query.workspace)) || '').slice(0, 64).trim();
  if (!ws) return res.status(400).json({ ok: false, error: 'NEED_WS', message: 'Say which workspace to look at.' });

  const out = { ok: true, ws, checkedAt: new Date().toISOString(), platforms: [] };

  for (const p of PLATFORMS) {
    const row = { key: p.k, name: p.name, built: p.built, connected: false };
    if (p.covers) row.covers = p.covers;
    if (!p.built) { row.why = p.why; out.platforms.push(row); continue; }

    let tok = null;
    try { tok = await load(ws, p.k); } catch (e) { tok = null; }
    if (!tok) {
      row.why = 'Not connected yet. One sign-in from the room connects it everywhere, not just here.';
      out.platforms.push(row);
      continue;
    }

    if (p.k === 'tiktok') {
      row.connected = !!tok.at;
      row.account = tok.name || '';
      row.expiresInDays = tok.exp_at ? Math.max(0, Math.round((tok.exp_at - Date.now()) / 86400000)) : null;
      row.note = 'Until TikTok clears the app review, a post lands in the TikTok drafts instead of going straight out.';
    } else if (p.k === 'meta') {
      const left = daysLeft(tok);
      if (left === 0) {
        row.why = 'The sign-in ran out. Meta cannot renew it quietly, so it needs doing once more.';
        out.platforms.push(row);
        continue;
      }
      /* Pages are resolved live. A token that was revoked at Facebook still looks fine sitting
         in the vault; asking Graph is the only way to know, so we ask. */
      let targets = [];
      try { targets = await targetsFor(tok); } catch (e) { targets = []; }
      if (!targets.length) {
        row.why = 'The sign-in no longer reaches a Page. It was most likely removed at Facebook, so it needs doing once more.';
        out.platforms.push(row);
        continue;
      }
      row.connected = true;
      row.expiresInDays = left;
      row.account = targets.map((t) => t.pageName).filter(Boolean).join(', ');
      row.targets = targets.map((t) => ({
        page: t.pageName || '', instagram: t.igUsername || '', hasInstagram: !!t.igId
      }));
      if (!targets.some((t) => t.igId)) {
        row.note = 'Facebook is connected. Instagram is not reachable through it until the Page is linked to a Professional Instagram account.';
      }
    }
    out.platforms.push(row);
  }

  out.anyConnected = out.platforms.some((p) => p.connected);
  return res.status(200).json(out);
}
