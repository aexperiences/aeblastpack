# AE BLASTPACK — FULL HANDOFF BRIEF
### Accelerated Experiences LLC · Post Falls, Idaho
**Written 15 August 2026 · for the weekend team picking this up cold**
**Author: the Cowork instance that built it. Everything below was verified live, in a browser, at the time of writing.**

---

## 0. READ THIS FIRST — HOW TO WORK HERE

Before touching anything, load these in order. They are not optional; skipping them is how instances waste hours.

1. **`aehub/system-sot.md`** — *THE AE CONSTITUTION*. The one Source of Truth. 17 Articles. Anthony is the sole authority. Read it in full.
2. **`CLAUDE.md`** at the root of the `Strictly Research` folder — people, terms, preferences.
3. **Project memory** — call `project_memory_read`. The files that matter for this project:
   - `ae-blastpack.md` — the product, the constraints, the decisions
   - `ae-blastpack-live.md` — URLs, repo, Vercel, and the deploy technique
   - `aehub-api-contracts.md` — ⛔ **read before writing anything to the hub**
   - `lane-discipline.md`, `ae-app-icon-standard.md`, `ae-brand`(skill)

### The rules that will bite you if you ignore them
| Rule | Why it exists |
|---|---|
| **Anthony is the only authority.** Draft and propose; he disposes. | SSOT Art. I |
| **Ghost Mode.** Nothing sends, spends, publishes or deploys without his OK. **He enters every credential himself.** | Art. III |
| **He has NO terminal.** Never hand him a command. Anything needing a CLI gets rebuilt as a click. | Art. III.3 |
| **Never fabricate.** No invented number, client, result or logo. Blank beats confident-wrong. | Art. IV |
| **Live, not local.** `Strictly Research/` is a **stale mirror**. Fetch the live file before editing. The repo wins. | Art. V |
| **Never say done until VERIFIED LIVE with your own eyes.** | Art. VI.2 |
| **Full company name every time: "Accelerated Experiences LLC."** | Art. VII.1 |
| **Green mark, never blue.** In `aexperiences-site`, `ae-mark.png` is BLUE; the green one is **`ae-disc.png`**. | Art. VII.2 |
| **Every app is sold in the store. No landing pages.** | Art. IX.3 |
| **No walls of text to Anthony.** He is autistic/ADHD/dyslexic. ≤5 bullets, one action each. Show, don't tell. | CLAUDE.md |

**Lane discipline:** Anthony runs 4–5 Cowork instances at once and they have clobbered each other before. **One repo, one instance.** This project owns **`aeblastpack`**. It has touched `aehub` once and `aexperiences-site` once (both documented below). Before editing either of those, check `aehub/session-logs/` for entries dated today.

---

## 1. WHAT WE ARE BUILDING, AND WHY

**AE Blastpack** is a consumer + small-business cross-poster. One video goes to **TikTok, Instagram, Facebook, YouTube and X**.

**Origin:** Anthony's wife **Jessica** runs a TikTok account — *"So you wanna be a Home Health Nurse?"* She wanted her TikToks to land on the other platforms without redoing the work. That's the whole seed. She is the acceptance test for this product; if it doesn't work for her, it doesn't ship.

**Positioning:** standalone product first, sold in the AE App Shop (SSOT Art. IX.3 — the store is the front door, never a landing page). Then an additive room in AE OS so Barry and the AE social team can run client accounts from the hub.

### The market research that shaped it
~47 competing tools were reviewed (Buffer, Later, Hootsuite, Publer, Postiz, Blotato, Metricool, Repurpose.io, SocialBee, Vista Social, Sprout, Loomly, Planable, OneUp, Post Planner, Sendible, ContentStudio, Hypefury, post-bridge, Upload-Post, bundle.social, Ayrshare, Mixpost, Repostify, and others), plus G2, Capterra, Trustpilot and App Store review corpora.

**The finding that matters: everyone already has the features. Everyone fails silently.**

- Hootsuite: **4.3 on G2, 1.3 on Trustpilot.** Later: **4.5 on G2, 1.4 on Trustpilot.** G2 collects reviews at the happy moment; Trustpilot is where people go after they've been billed.
- App Store review of the category leader, verbatim: *"You'd be better off posting each piece of content individually to each platform than dealing with the problems this app causes."*
- On token expiry, verbatim: *"Having to refresh social media connections daily defeats the purpose of scheduling."*

**So the product promise is reliability, not features:**
> **You hear it from us the second it breaks.** Plus a proactive *"your Instagram connection expires in 3 days — tap to renew"* **before** the queue goes dark. Nobody in the category does this.

---

## 2. ⛔ THE CONSTRAINT THAT DEFINES THE PRODUCT

**TikTok cannot be the source of the video. This is not a design choice; it is a hard API fact.**

TikTok's Display API `/v2/video/list/` returns only:
`id, create_time, cover_image_url, share_url, video_description, duration, height, width, title, embed_html, embed_link` + like/comment/share/view counts.

**There is no video file URL. None.** `cover_image_url` is a static image that expires; `share_url` is a tiktok.com page.

- **Repurpose.io** is the only mainstream tool claiming TikTok-as-source. Their own pages sell a *"TikTok downloader without watermark"* — i.e. an undocumented path outside the documented API. **TikTok Developer Terms §III.3.k prohibits it.** Their reviews show the consequences: 1080p downgraded to 720p, and *"repeated scheduled posts that never went live."* **Do not copy this.**
- **The Data Portability API** *does* return real `.mp4` files (field: *"Posted Video Download Link"*, scopes `portability.postsandprofile.single` / `.ongoing`). But it is a 3-step async archive export with **no date filtering, no completion webhook, and hours-to-days latency.** It is a **back-catalogue import feature only. Never the main loop.**

### So the actual flow is a toggle, not an API
1. In TikTok: **Post screen → More options → Save to device → ON.** Sticky. One time. Forever.
2. Every video she posts then lands in her camera roll — **a clean copy, no watermark.**
3. Blastpack picks it up and publishes to the other four.

**Timing matters and only in this one way:** the clean file only happens if that toggle is on **at the moment she posts**. TikTok changed this in **July 2024** — you must *post* to save clean. Saving later from her profile stamps the watermark on.

**Why the watermark matters (verified, and be precise about this):** Instagram's own creator guidelines require **"no visible watermarks"** for recommendation eligibility, and class watermarks as a low-effort edit. It affects reach to **new** audiences, not existing followers. **YouTube has NO watermark policy — that part is folklore. Do not claim it.**

### ⛔ Do not build an editor. Not even Cutlabs.
We can match TikTok's cutting, text and captions. We can **never** match their **sounds** — that library is licensed to TikTok alone, and Instagram's API cannot attach music either. Any editor we ship sends her back to TikTok for audio anyway. **Decision is locked: make it where the sounds are.**

---

## 3. WHERE WE ARE — VERIFIED LIVE, 15 AUG 2026

### It is live and working
| Thing | Where | Status |
|---|---|---|
| **The app** | **https://aexperiences.com/apps/blastpack/** | **200 — LIVE** (canonical URL) |
| Direct | https://aeblastpack.vercel.app | LIVE |
| Privacy policy | /apps/blastpack/privacy.html | 200 |
| Terms of service | /apps/blastpack/terms.html | 200 |
| Icon / manifest | /apps/blastpack/icon-180.png, /manifest.webmanifest | 200 |
| **Repo** | github.com/aexperiences/**aeblastpack** — **PUBLIC** | 6 files, last push 15 Aug 15:31 UTC |
| **Vercel** | project `aeblastpack` · `prj_eA0ylHoJP0qgUmA9xoH2v75iggST` · team `team_DS31ziicQKYPquaj70yTrYKJ` | git-linked to `main`; push = deploy |
| **Skin Machine** | `blastpack-light` + `blastpack-deep` in `skin-machine.js` BUILT_INS | LIVE, verified rendering at aexperiences.studio/machines.html |

Repo contents: `index.html`, `icon-180.png`, `icon-512.png`, `manifest.webmanifest`, `privacy.html`, `terms.html`.

### Filed in AE OS (the Hall of Records)
- **Project** via `/api/projects`, id `0267aabc` — "AE Blastpack", line "Standalone tools"
- **Calendar** — **18 milestones**, `dept:"Production"`, `tag:"AE Blastpack"`, 17 Aug → 15 Sep 2026
- **Documents** — `ae-blastpack-brief` (main brief) and `ae-blastpack-profiles` (workspaces spec). Re-passing the same `id` upserts.
- **PDF** — `aehub/brand/blastpack/AE-Blastpack.pdf` (4pp: cover / how it works / linking accounts / alerts)

### The two edits made outside our lane (both intentional, both verified)
1. **`aehub/skin-machine.js`** — commit `f307698`, added `blastpack-light` + `blastpack-deep` to `BUILT_INS`. 5 skins → 7. Originals untouched, API intact, validated by parsing before upload.
2. **`aexperiences-site/vercel.json`** — commit "Store: route /apps/blastpack/ to AE Blastpack". Added 2 rewrites (31 → 33). The 5 redirects were left exactly as they were.

---

## 4. WHAT IS ACTUALLY BUILT — AND WHAT ISN'T

**Be honest with Anthony about this line. Do not blur it.**

### Built and working
- **Onboarding** — the TikTok "Save to device" instruction, then create the first profile (name + colour + optional logo).
- **Multi-profile / workspaces** — create, rename, recolour, upload a logo, delete. **Persisted in `localStorage`**, so profiles survive closing the app.
- **Profile switching** — overlapping avatars in the top bar; one tap switches. A colour sweep in the destination brand's colour, a pill naming the brand (with its logo), and a haptic tick. Honours `prefers-reduced-motion`.
- **Accounts screen** — per-profile connection state for all five platforms, with the real-world help text (Instagram Professional requirement, Facebook Page-only rule, X being a paid add-on).
- **Composer** — pick a video from the camera roll, one caption, per-platform caption overrides, per-platform on/off toggles.
- **Per-platform previews** — 9:16 vs 1:1 framing shown side by side before publishing.
- **Confirm sheet** — names the profile in large type before anything publishes. This does double duty: it is TikTok's mandatory consent step **and** the "am I in the right brand" check.
- **Activity** — a line per destination per post, with Retry on failures.
- **Alert settings** — push and email on by default; **SMS opt-in only**.
- **Two skins** — Light (default) and Deep, per profile, driven entirely by the AE Skin Machine `--sm-*` token contract.
- **Black glass nav bar**, top and bottom, `backdrop-filter` with a solid fallback.
- **PWA bits** — manifest, real `apple-touch-icon` file that resolves (see the icon trap in §7).

### NOT built — the honest gap
- **The five OAuth connections are UI flows, not live API calls.** Tapping "Connect" marks the platform connected locally so the rest of the app can be used and demonstrated. **No token is fetched, and nothing actually publishes yet.** This is gated on §5.
- **No backend.** No server, no database, no accounts system. State is entirely on-device.
- **The publish pipeline is simulated** — it walks destinations and marks them posted so the Activity screen and alert model can be exercised.
- **Alerts are UI only** — no push service, no email sender, no SMS provider wired.
- **Full Apple + Google icon kit not built** — only 180 and 512 exist. The standard (13 iOS sizes, Android adaptive at 66%, maskable, `_qa` previews) is on the calendar for 19 Aug and specified in `ae-app-icon-standard`.

> **If anyone asks "does it post yet?" the answer is no, and the reason is §5, not the code.**

---

## 5. THE PLATFORM GATES — THE REAL CRITICAL PATH

Four of the five APIs are free. **The audits are the cost, not the licences.** This is the long pole and it is why nothing publishes yet.

### ⛔ TikTok — start here, it is the only one with an unbounded clock
- Two gates: **Product Access** (days) → **Content Audit** (days to weeks, **no published SLA**).
- **Until the audit passes, every post the app publishes is forced to PRIVATE — permanently — even after you later pass.** And **the API returns `success` at every step while this happens.** This is the single most dangerous fact in the whole project.
- **Therefore: no customer publishes through Blastpack until TikTok's audit clears.** Not Jessica, not a beta user, nobody.
- Scopes: `user.info.basic`, **`video.publish`** (Direct Post). `video.upload` only lands in drafts — request publish.
- Access tokens expire in **24 hours**; refresh infrastructure is required.
- TikTok **requires explicit user consent before upload**, so a fully zero-touch auto-poster is out of compliance. Our confirm sheet satisfies this — show it in the demo.
- `PULL_FROM_URL` requires domain-ownership verification.
- Common rejection reasons: demo that doesn't show the full auth flow; not respecting the creator's duet/stitch/comment settings; no visible confirmation screen; unreachable privacy policy; requesting scopes you don't demonstrably use.

### Meta — Instagram + Facebook
- Needs **full App Review + Business Verification**. Verification is usually the slower half and needs **EIN + a business document**. Start both the same day.
- **One screen recording per permission** — Meta rejects bundled demos.
- Instagram: **Professional (Business or Creator) accounts only.** Personal API access ended Sep 2025. Free to switch, in Instagram Settings → Account type and tools.
- Facebook: **posts to a Page, never a personal profile.**
- Media must be at a **public HTTPS URL** — no direct file upload. This has an architectural consequence: we will need somewhere to host the file for the duration of the post.
- Reels via API: **9:16, 5–90 seconds, 100 MB, `moov` atom at the front.** Music, trending sounds and collaborator tags are **impossible via API** — don't promise them.
- Limit: 100 API-published posts per rolling 24h.

### YouTube
- Free. Default quota **100 `videos.insert`/day** — fine to launch on. Only file the Quota Extension form if exceeded.
- `youtube.upload` is a **sensitive scope** → triggers OAuth verification; expect a demo video request.
- `aexperiences.com` must be domain-verified in Search Console **under the same Google account**. Search Console is already set up — use that account.
- Vertical video becomes a Short automatically.

### X — the only one that costs money
- **$0.015 per post, but $0.20 if the post contains a link** (13×).
- **Later dropped X entirely on 28 Aug 2025; Hypefury dropped it too**, rather than absorb the cost.
- **Decision: X ships as a paid add-on**, not included.

### ⚠️ The blocker on submitting these
All three require **creating a developer account and accepting developer legal terms.** Under SSOT Art. III.2 an instance may not create accounts or accept terms on Anthony's behalf — and the safety layer independently blocked navigation to the TikTok developer portal.

**The agreed split:** Anthony logs in and accepts the terms; the instance fills every field and stops with hands off Submit.
**A complete answer sheet with every field pre-written already exists:** `AE-Blastpack-Application-Answer-Sheet.html` (delivered to Anthony 15 Aug). Every URL on it is live and resolving — that's normally what holds these applications up.

---

## 6. ARCHITECTURE

### Data model — the thing you must not get wrong
**Every record is keyed by `workspace_id` from the first line of code.** Anthony was explicit on 15 Aug: multi-profile is day-one architecture, not v2. Retro-fitting multi-tenancy later is a rewrite.

```
state = {
  v, onboarded, activeWs,
  alerts: { push, email, sms, phone, emailAddr },   // account-level
  workspaces: [{
    id, name, color, skin, logo,                    // logo = 160px square data URL
    connections: { tiktok|instagram|facebook|youtube|x :
                   { connected, handle, expiresInDays } },
    posts: [{ id, at, caption, results:{ platform: 'sending'|'ok'|'failed' } }],
    created
  }]
}
```
Stored under `localStorage` key **`aeblastpack_v1`**. Roughly 7 KB with 3 profiles and a logo.
**The video is never persisted** — it lives in a transient `draft` object as an object URL and is revoked on reset. Do not put media in storage.

### A Workspace owns
Its own five platform connections and tokens, its own expiry clocks, its own post history and failure log, its own alert routing, and its own **name, avatar/logo and skin.** One login owns many workspaces.

### ⭐ The skin is a safety feature, not decoration
The nightmare in this category is **posting to the wrong brand.** An agency running six brands will eventually put a client's Reel on another client's feed. So:
- Every workspace wears its own skin/colour; the chrome repaints on switch.
- The workspace name sits in the top bar at all times.
- The publish confirm names the workspace in large type.

### Skins — use the machine, don't invent one
Skins follow the **AE Skin Machine 8-token core contract**: `--bg --card --ink --mut --line --primary --accent --good`, from which `tokens()` derives the `--sm-*` set including contrast-aware `--sm-on-primary` / `--sm-on-accent`. The app's CSS references **only `--sm-*`**, which is why one tap repaints everything.

```
blastpack-light  bg #FDF9F0  card #FFFFFF  ink #1C3D4F  mut #5E6D73
                 line #E4DAC4  primary #1C3D4F  accent #F0A3A9  good #3C7C53
blastpack-deep   bg #14323F  card #1C3D4F  ink #FDF9F0  mut #9FB4BD
                 line #2F5567  primary #7BAEA6  accent #F0A3A9  good #7FD4C8
```
Both are live in `skin-machine.js` BUILT_INS, so the machine's gallery and factory can see and fork them. **Inside the app only these two are offered** — a nurse doesn't need Maroon & Gold.

### Brand
Palette sampled from **Jessica's own TikTok thumbnail** and contrast-gated **before** any art was drawn:
| Token | Hex | Source | Contrast |
|---|---|---|---|
| Sage | `#7BAEA6` | the bubble letters | 2.37 — decorative only, never small text |
| Cream | `#FDF9F0` | the fat outline | — |
| Sand | `#F4EBD4` | letter shadow | — |
| Deep teal | `#1C3D4F` | the wordmark | **10.9:1 on cream** — all text and every outline |
| Coral | `#F0A3A9` | the hearts | ink on it **5.8:1** — the CTA |
| Mint | `#7FD4C8` | the highlight | success only |

**Icon = the jetpack.** Twin cone-topped tanks splayed apart, swept fins, harness + buckle, twin flames. Chunky geometric.
*Silhouette lesson, recorded so nobody repeats it: parallel capsules read as **binoculars**; one strap loop reads as a **handbag**; two vertical straps read as **rabbit ears**. **Cone tops + splay + fins** are what make it a jetpack.* SVG master lives in the session workspace; regenerate sizes with `cairosvg`.

---

## 7. TRAPS AND SCARS — READ BEFORE YOU TOUCH ANYTHING

These each cost real time. They are written down so they cost you none.

### ⛔ Hub writes silently clobber each other
`/api/calendar` `add` is read-modify-write on a Vercel Blob, and **the read lags several seconds.** Fifteen sequential adds all returned **`200`** and **one row landed.** *A 200 does not mean it saved.*
- Leave **≥10 s** between hub writes. 1.4 s and 6 s both dropped rows.
- Verify with a cache-busted read: `fetch('/api/calendar?_='+Date.now(), {cache:'no-store'})`. A plain GET is served stale and will lie to you.
- Make it **idempotent** — build the desired set, re-read live, post only what's missing, keyed on title.
- CDP `Runtime.evaluate` times out at **45 s**, so a long sleep-loop won't fit in one call. **Fire an async background loop in the page** that writes to `window.__status`, then poll it.

### ⭐ Moving big files with ZERO context cost
Do not paste a 50 KB app through `javascript_tool` or `deploy_to_vercel` — it costs ~30k tokens and truncates.
1. `SendUserFile` the build (content never enters context).
2. Copy the same files to **`/mnt/user-data/outputs/<name>/`** in the container.
3. Open GitHub's upload page, `find` the file input, then **`mcp__claude-in-chrome__file_upload`** with the **`/mnt/user-data/...`** paths.
4. Set `#commit-summary-input`, then dispatch a real `MouseEvent('click')` on the submit button.
5. Verify via `api.github.com/repos/<owner>/<repo>/contents/`.

⚠️ `file_upload` **rejects device paths** (`/Users/...`) even for connected folders — only `/mnt/user-data/...` works.
⚠️ **`api.github.com` IS reachable** from the container and the browser. The old memory saying it was blocked is **stale**.
⚠️ GitHub's Commit button often ignores a synthetic `.click()` — dispatch a real `MouseEvent`, then confirm via the API, not the page.
⚠️ **Never use `computer:type` on GitHub forms.** A mistargeted click sends keystrokes to hotkeys — it landed us in Copilot and mangled the repo description. Set values with the native `value` setter + an `input` event.

### ⛔ Two bugs that nearly shipped, both caught by LOOKING
1. **A unary-plus bug of my own making.** A continuation line written as `+ +'style="…"'` inside a `.map()` return evaluated to **`NaN`**, so the onboarding colour swatches rendered as blank grey pills. Invisible in code review; obvious in a screenshot.
2. **terser mangles concatenated style strings** — `--minify-js` reproduced the same `NaN`. **Minify CSS + whitespace only, never the JS.** Then screenshot again.

> **The rule this proves: render it, open the PNG, and actually look. Every time.**

### ⛔ The iOS icon killer
An `apple-touch-icon` href pointing at a file that does not exist: **iOS does not warn and does not fall back to the manifest — it screenshots the page** and uses that as the Home Screen icon. KangaToDo shipped like this once. Always fetch the href and confirm 200. Ours resolves.

### ⛔ Store rewrites come in pairs
`aexperiences.com/apps/<slug>/` needs **both** entries in `aexperiences-site/vercel.json`:
```json
{"source":"/apps/<slug>/",       "destination":"https://<project>.vercel.app/index.html"}
{"source":"/apps/<slug>/:path*", "destination":"https://<project>.vercel.app/:path*"}
```
Without the wildcard, icons, manifest and sub-pages 404.

### Other live landmines
- **`deploy_to_vercel` sends a FULL SNAPSHOT** — deploying a subset **deletes everything else**. It 404'd AE Comply once. For an existing project, push to git instead.
- **The blue mark.** `ae-mark.png` in `aexperiences-site` is the **retired blue** logo. The green one is **`ae-disc.png`** (512×512, 149,774 bytes). Verify by counting pixels, never by filename. The bundled asset in the old `ae-brand` skill was also blue — an updated skill file was delivered to Anthony on 14 Aug; confirm he saved it.
- **Retired names never reappear:** Homestead, Draftline, Datum, Marquee, Reel, Encore, Cartwheel, Driveline, Motorcade. Seeing one is a bug to fix, not to copy.

---

## 8. THE WORK, IN ORDER

All 18 milestones are already on the hub calendar under `dept:Production`, `tag:"AE Blastpack"`. This is the same list with the reasoning attached.

### Immediate — unblocks everything
1. **Submit the TikTok developer application.** Anthony logs in and accepts terms; the instance fills the form from the answer sheet and stops at Submit. Longest, least predictable clock.
2. **Submit Meta App Review + start Business Verification** the same day. Verification needs EIN + a business doc.
3. **Submit the YouTube / Google Cloud OAuth consent + sensitive scope.**

### Then — the real backend
4. **Auth + accounts.** Decide the model. Free stack first (SSOT Art. XVII — never invent a cost).
5. **OAuth callbacks** for all five, per workspace. Redirect URIs are already written on the answer sheet:
   `https://aeblastpack.vercel.app/auth/{tiktok|meta|google}/callback`
6. **Token storage + refresh.** TikTok's 24-hour expiry makes this non-optional. Store per workspace.
7. **Media hosting for the publish window.** Instagram requires a **public HTTPS URL** — the file needs a temporary home. Delete it after the post; the privacy policy already promises exactly that, so honour it.
8. **The publish pipeline** — per-destination status, retries, never a silent partial success.
9. **⭐ THE WEDGE — the failure alarm.** Push + email; SMS opt-in. Plus token-expiry warnings 3 days out. **This is the entire differentiator. Do not let it slip to v2.**

### Then — commerce and reach
10. **AE App Shop listing** — store, not a landing page. Build the full purchase path; **Stripe stays OFF until Anthony personally says go.**
11. **Hub room** in AE OS for Barry and the social team — one workspace per client.
12. **Full Apple + Google icon kit** → `aehub/brand/blastpack/` per `ae-app-icon-standard`.
13. **Jessica beta** — one real week of real posts. **Gated on the TikTok audit.**
14. **Public launch** — gated on the same.

### Pricing — a real decision, not a detail
Every competitor prices **per connected social account** (Buffer $5/channel/mo, Publer, OneUp, Vista Social). An agency with 6 brands × 5 platforms = **30 channels**, which turns a $5 tool into $150/mo. **Pricing per workspace instead of per channel is the differentiator** and lands directly on the loudest complaint in the review corpus. The market gap is **$5–$15/mo** for reliable video to all five. Anthony sets the number.

---

## 9. DECISIONS ALREADY LOCKED — DO NOT RELITIGATE

| Decision | Locked because |
|---|---|
| **Blastpack is the origin, not TikTok** | TikTok's API returns no video file; the alternative is a ToS violation |
| **No editor, not even Cutlabs** | TikTok's sounds are licensed to TikTok alone |
| **The jetpack icon** | Anthony chose it explicitly |
| **Light is the default skin**, Deep one tap away | Anthony chose it — it matches Jessica's own thumbnail |
| **Only two skins inside the app** | Anthony: "not the whole skin show" |
| **Multi-workspace from day one** | Anthony, twice, unprompted |
| **Phone number never required** | Anthony asked; push + email are the default |
| **X is a paid add-on** | It is the only API that charges per post |
| **Store URL is `aexperiences.com/apps/blastpack/`** | Matches the existing `/apps/<slug>/` fleet pattern |

### Open — Anthony's calls only
- Pricing, and when Stripe flips on.
- Whether the **iOS native app** (Share Extension + `PHPhotoLibraryChangeObserver` for near-automatic "new video detected, post it?") goes on the roadmap now or after the web app proves out. **Note: Web Share Target does not exist on iOS Safari** — WebKit bug 194593, open since 2019, still NEW as of May 2026. Native is the only route to that feel.
- ⚠️ **UNVERIFIED and worth 30 minutes on a real device before anything is built on it:** whether TikTok's share sheet emits a `video/*` **file** or just a `text/plain` **URL**. Almost certainly a URL. Phases 2 and 3 of the input roadmap hinge on it.

---

## 10. WHERE EVERYTHING LIVES

| What | Where |
|---|---|
| Live app | https://aexperiences.com/apps/blastpack/ |
| Repo | github.com/aexperiences/aeblastpack (public) |
| Vercel | project `aeblastpack`, team `team_DS31ziicQKYPquaj70yTrYKJ` |
| Store rewrite | `aexperiences-site/vercel.json` |
| Skins | `aehub/skin-machine.js` BUILT_INS |
| Hub project | `/api/projects` id `0267aabc` |
| Hub calendar | 18 events, `tag:"AE Blastpack"` |
| Hub documents | `ae-blastpack-brief`, `ae-blastpack-profiles` |
| Marketing PDF | `aehub/brand/blastpack/AE-Blastpack.pdf` |
| Local mirror | `Strictly Research/aeblastpack/` (**mirror — the repo wins**) |
| Memory | `ae-blastpack.md`, `ae-blastpack-live.md`, `aehub-api-contracts.md` |
| Answer sheet | `AE-Blastpack-Application-Answer-Sheet.html` (with Anthony) |

**Hub API auth:** `/api/*` is founder-gated by edge middleware, so a brand-new endpoint is **founder-gated for free** — write the handler, add no auth code, don't touch `PUBLIC_PATHS`. You cannot reach the hub from the container; drive it through Anthony's authed Chrome with same-origin `fetch`, and confirm `/api/me` returns `{authed:true, role:"founder"}` first.

---

## 11. THE ONE-PARAGRAPH VERSION

AE Blastpack is live at **aexperiences.com/apps/blastpack/** as a complete, working front end with multi-brand profiles, logo upload, instant profile switching, per-platform previews and captions, an activity log and the two Blastpack skins — all persisted on device. **It does not publish yet, and that is a platform-permission problem, not a code problem.** TikTok, Meta and Google each require a developer application that only Anthony can submit, because each demands creating an account and accepting legal terms. Every field for all three is pre-written and every URL they ask for is live. **Submit TikTok first** — its Content Audit has no published turnaround and, until it clears, anything published through the app is forced private forever while the API cheerfully reports success. Once the audits are in, the build order is auth → OAuth callbacks → token refresh → temporary media hosting → the publish pipeline → **the failure alarm, which is the entire reason this product beats the incumbents.**

---

*Accelerated Experiences LLC · Post Falls, Idaho · an Esposito family business*
*Every URL, commit and status in this brief was verified live on 15 August 2026 before it was written down. Anything that could not be verified is marked UNVERIFIED and is not asserted as fact.*
