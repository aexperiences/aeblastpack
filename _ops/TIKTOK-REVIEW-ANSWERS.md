# TikTok app review — the answers (Oct 30 2026)

Filled into developers.tiktok.com by the lane; Anthony presses Submit.

## App
- Name: AE Blastpack
- Category: Social media management / cross-posting
- Website: https://www.aexperiences.com/apps/blastpack/
- Terms of Service: https://www.aexperiences.com/apps/blastpack/terms.html
- Privacy Policy: https://www.aexperiences.com/apps/blastpack/privacy.html
- Platform: Web
- Redirect URI: https://www.aexperiences.com/apps/blastpack/auth/tiktok/callback  (check against the value already saved on the app)

## Products and scopes
- Login Kit — user.info.basic: shows the creator's TikTok name and avatar on the connect card and the confirm sheet, so she can see which account she is posting to.
- Content Posting API, Direct Post — video.publish: posts the video she chose to her own TikTok account after she confirms on the confirm sheet.
- video.upload: fallback that places the video in her TikTok inbox as a draft when Direct Post is not available, so she finishes the post in the TikTok app.

## Use case (paste into "Describe your app")
AE Blastpack lets a small creator post one finished video to the platforms she uses (TikTok, Instagram, Facebook, YouTube) from one screen. She connects her own TikTok account with Login Kit, picks a video from her device, writes the caption, and opens the confirm sheet. For TikTok the sheet shows her TikTok name and avatar, asks her to choose who can see the video (no option is preselected), lets her allow or block comments, duets and stitches (settings she has turned off in TikTok stay off), lets her disclose promotional or branded content, and shows TikTok's Music Usage Confirmation. Nothing is posted until she presses "Yes — blast it". The app then uploads the file with the Content Posting API and checks the publish status until TikTok confirms it, and shows a failure if it does not. Each person only ever posts to their own account.

## Demo video must show (one take, phone width)
1. Open the app, tap Connect TikTok, log in on TikTok's page, approve the scopes, land back connected (name + avatar shown).
2. Pick a video, write a caption, turn TikTok on.
3. Tap Blast: confirm sheet shows the creator name, "Choose who can see it" with nothing chosen, Blast disabled until chosen.
4. Choose an audience, show the comment / duet / stitch boxes and the disclosure toggle (tick "Your brand", show the "Promotional content" label; tick "Branded content", show "Only me" go away and the Branded Content Policy link).
5. Show the Music Usage Confirmation line, press Yes — blast it.
6. Show the post status reach "posted", then the post in the TikTok app.
