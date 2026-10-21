---
description: Research this week's trends and publish the JoshWorks Studio trend report (public/trends/latest.json)
---

You maintain the weekly trend report for JoshWorks Studio (this repository), the studio app of JoshWorks: a DTI-registered graphic design studio in Iloilo City, Philippines. JoshWorks does branding, packaging, merchandise, stickers, illustration, motion graphics, publications and website design, and runs social media for local businesses. Its weekly themes: Monday educational, Tuesday portfolio, Wednesday campaign or flex, Thursday a designer's story, Friday behind the scenes or fun. It posts on Facebook, Instagram and TikTok.

The report is the only thing you change. It never contains the team's posts, clients or numbers.

1. Work out this week's Monday in Asia/Manila as YYYY-MM-DD.
2. Read `src/domain/trendFeed.ts` (the format and its limits) and the current `public/trends/latest.json`. Don't repeat last week's items unless they are still growing.
3. Research with web search, preferring sources from the last 30 days:
   - TikTok, Instagram Reels and Facebook trends (sounds, formats, memes) that a design studio can use, and whether business accounts can use the sound;
   - platform changes that matter to small businesses (algorithm, features, limits);
   - graphic design, branding and packaging trends;
   - Philippine dates in the next 6 weeks: official holidays under the current proclamation, Iloilo and Western Visayas events, double-day sales, paydays, school calendars (student org clients).
4. Rewrite `public/trends/latest.json`:
   - `weekOf`: this Monday; `generatedAt`: the current time in ISO format;
   - `summary`: 2–3 sentences;
   - `items`: 5 to 8 objects with `id`, `title`, `platform` (facebook, instagram, tiktok, threads, x, youtube or any), `kind` (sound, format, meme, design, platform or local), `what`, `why`, `howJoshWorks` (one concrete JoshWorks post idea), `postIdea` (`{"title", "format": Reel, Carousel, Single image or Story, "themeKey": mon-edu, tue-portfolio, thu-designer or fri-behind}`, or null), `expires` (YYYY-MM-DD or null) and `sources` (`[{"title", "url"}]`, at least one);
   - `dates`: `[{"date", "name", "idea"}]` for the next 6 weeks;
   - `sources`: every page you used.
   Only cite pages you actually opened in this run; never invent a URL. Write plain, friendly English; Filipino words are fine where they're natural.
5. Run `npx vitest run tests/domain.test.ts`. The test "reads the published weekly report without dropping anything" must pass; fix the JSON until it does.
6. Show me the summary and the item titles. Then commit only `public/trends/latest.json` with the message "Trend report for the week of YYYY-MM-DD" and, after I confirm, push to `main`. The push redeploys the app, and the report appears under Trends for the whole team a few minutes later.

$ARGUMENTS
