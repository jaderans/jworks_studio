# Posting to Facebook, Instagram and TikTok

JoshWorks Studio uses a **link and copy** flow. The app writes, checks and stores the caption, then sends you to each platform's own composer to post or schedule. Nothing needs a developer account, tokens or a server, and it works the same for JoshWorks' pages and for clients' pages.

## How to post

1. Open the post, then the **Captions** tab. Write one caption, or a different one per platform. The checks catch problems before you post: length, too many hashtags (Instagram allows 5), a first line that gets cut off in the preview, links that won't be clickable, styled hashtags that won't work as tags, and a missing disclaimer on WHAT IF concepts.
2. Click **Copy**, then the composer button:
   - **Meta Business Suite** for Facebook and Instagram. One composer schedules both, at the best local times shown in the app (Facebook 6–8 PM, Instagram 8–10 PM).
   - **TikTok Studio** for TikTok uploads.
   - **Threads** and **X** open with the caption already filled in.
3. Upload the design from the post's asset link (the Drive folder).
4. Once it's live, go to **Publish & results**, paste each post's link, click **Mark as posted** and then **Save**.
5. **48–72 hours later**, log the results: views, reach, likes, comments, saves and shares. Saves show the content was worth keeping and shares show it reached new people. The Results and Trends pages flag posts that did twice the usual.

Instagram and TikTok captions can't hold clickable links, so end with a DM keyword ("DM us START") or point to the link in bio.

## Client pages: partner access, never passwords

Never store or ask for a client's password. Send the client JoshWorks' business portfolio ID (Meta: **Business settings → Business info**) and ask them to:

- **Facebook and Instagram:** at [business.facebook.com/settings](https://business.facebook.com/settings), go to **Users → Partners → Add → Give a partner access to your assets**. They enter the JoshWorks ID, then pick their Page and Instagram account and the permissions.
- **TikTok:** in TikTok Business Center, go to **Partners → Add partner**, enter JoshWorks' Business Center ID and choose the accounts to share.

They can remove the access any time, and nobody's personal login is shared. The contract template's client duties already include this.

## Why there's no "post for me" button yet

Publishing straight from the app is possible later, but each platform makes it a project of its own:

- **Facebook Pages:** posting needs a Meta developer app with the `pages_manage_posts` permission. To use it on pages you don't own (your clients'), the app needs Advanced Access, which means passing Meta App Review with a verified business.
- **Instagram:** the Content Publishing API only works for professional accounts. It fetches each image or video from a **public URL** at the moment of publishing ([Meta docs](https://developers.facebook.com/docs/instagram-platform/content-publishing)). Files on a designer's laptop or in a private Drive folder have to be uploaded somewhere public first.
- **TikTok:** until an app passes TikTok's audit, everything it posts is **private** (`SELF_ONLY`), and only a few accounts can use it ([TikTok docs](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)).
- **Tokens need a server.** Access tokens can't live in a public web app. Doing this safely needs a small backend, for example Firebase Cloud Functions on the pay-as-you-go Blaze plan, to hold tokens, host media and talk to the platforms.

**When it's worth it:** once there are enough SMM clients that copying and scheduling takes hours each week. Until then, Meta Business Suite's own scheduler does the same job for free.

The same setup would also let the app read insights automatically instead of logging results by hand.
