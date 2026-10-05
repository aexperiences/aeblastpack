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

import { peek, why as vaultWhy } from './_vault.mjs';
import { gate } from './_lane.mjs';

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

  /* Is the vault actually working? It writes a marker under a reserved name, reads the facts
     back the same way a room does, and throws it away. No real connection is touched and
     nothing secret comes back out. */
  if (ws === '__selftest') {
    /* Oct 5 2026 — and is the lane key actually in this build? Setting it on the project is
       not enough: a Vercel function only sees an environment variable from the deployment it
       was built with, so a key set after the last deploy is a key the posting doors do not
       have. That cost one quiet cron run. Now it can be asked. Nothing is revealed to anyone
       who does not already hold the key, and it answers only here. */
    const laneSet = !!String(process.env.BP_LANE_KEY || '').trim();
    /* gate() refuses a lane caller that names no workspace, so the check has to name one.
       Nothing is posted here; the name is only there for the gate to hand back. */
    const laneOk = !!gate({ headers: req.headers || {}, query: { ws: '__selftest' } });
    const d = await vaultWhy();
    const steps = d.steps || [];
    const saved = steps.some((x) => x.step === 'save' && x.ok);
    const readBack = steps.some((x) => x.step === 'peek' && x.matched);
    return res.status(200).json({
      ok: true, selftest: true, wrote: saved, roundTrip: readBack, detail: readBack ? null : d,
      laneKeySet: laneSet, laneKeyAccepted: laneOk,
      lane: !laneSet ? 'BP_LANE_KEY is not in this build. The drainer cannot post until it is.'
          : laneOk ? 'The lane key in this build matches the one you sent.'
          : 'BP_LANE_KEY is in this build. You did not send a matching one, which is the right answer to a stranger.',
      verdict: readBack ? 'The vault writes and reads. A connection made now will be seen everywhere.'
             : saved ? 'It wrote but could not read it back. Connections would not survive.'
             : 'It could not write. Connections would still only live in the browser that made them.'
    });
  }

  const out = { ok: true, ws, checkedAt: new Date().toISOString(), platforms: [] };

  for (const p of PLATFORMS) {
    const row = { key: p.k, name: p.name, built: p.built, connected: false };
    if (p.covers) row.covers = p.covers;
    if (!p.built) { row.why = p.why; out.platforms.push(row); continue; }

    let found = null;
    try { found = await peek(ws, p.k); } catch (e) { found = null; }
    if (!found) {
      row.why = 'Not connected yet. One sign-in from the room connects it everywhere, not just here.';
      out.platforms.push(row);
      continue;
    }

    const f = found.facts || {};
    const left = f.x ? Math.max(0, Math.round((f.x - Date.now()) / 86400000)) : null;
    if (left === 0) {
      row.why = p.k === 'meta'
        ? 'The sign-in ran out. Meta cannot renew it quietly, so it needs doing once more.'
        : 'The sign-in ran out and needs doing once more.';
      out.platforms.push(row);
      continue;
    }

    row.connected = true;
    row.account = f.n || '';
    row.connectedAt = found.at || null;
    if (left != null) row.expiresInDays = left;
    if (p.k === 'tiktok') {
      row.note = 'Until TikTok clears the app review, a post lands in the TikTok drafts instead of going straight out.';
    } else if (p.k === 'meta') {
      if (Array.isArray(f.t)) row.targets = f.t;
      if (Array.isArray(f.t) && !f.t.some((t) => t.instagram)) {
        row.note = 'Facebook is connected. Instagram is not reachable through it until the Page is linked to a Professional Instagram account.';
      }
    }
    out.platforms.push(row);
  }

  out.anyConnected = out.platforms.some((p) => p.connected);
  return res.status(200).json(out);
}
