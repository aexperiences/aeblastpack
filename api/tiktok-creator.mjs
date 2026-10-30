/* /api/tiktok-creator — what TikTok says this creator may do, read fresh before every post.
 * Accelerated Experiences LLC · Oct 30 2026
 * TikTok's Direct Post rules require the posting screen to show the creator's name and to
 * offer only the privacy levels and interaction settings TikTok returns here. The confirm
 * sheet calls this when it opens; nothing is guessed or remembered. */
import { getToken } from './_tt.mjs';
import { gate, notAllowed } from './_lane.mjs';

export default async function handler(req, res){
  try {
    if (!gate(req)) return notAllowed(res);
    const tok = await getToken(req, res);
    if (!tok) return res.status(200).json({ ok: false, connected: false });
    const r = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok.at, 'Content-Type': 'application/json' }
    }).then(x => x.json());
    const d = r.data || {};
    if (!d.privacy_level_options) {
      return res.status(200).json({ ok: false, error: (r.error && (r.error.message || r.error.code)) || 'TikTok did not answer', code: r.error && r.error.code });
    }
    return res.status(200).json({ ok: true,
      nickname: d.creator_nickname || tok.name || '', username: d.creator_username || '', avatar: d.creator_avatar_url || tok.avatar || '',
      privacy: d.privacy_level_options, commentOff: !!d.comment_disabled, duetOff: !!d.duet_disabled, stitchOff: !!d.stitch_disabled,
      maxSeconds: d.max_video_post_duration_sec || null });
  } catch (e) { return res.status(200).json({ ok: false, error: String(e && e.message || e) }); }
}
