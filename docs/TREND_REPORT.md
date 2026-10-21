# The weekly trend report

[`public/trends/latest.json`](../public/trends/latest.json) is the report the whole team sees under **Marketing → Trends → This week**. It's published with the app, so reading it needs no API key, and devices keep the last one for offline use. Each item has **Make a post** and **Save** (to the trend board) buttons.

There are four ways to update it.

## 1. `/trend-report` in Claude Code (recommended)

Open this repository in Claude Code (your Claude Pro plan covers it) and run `/trend-report` on Monday morning. Claude researches the week with web search, rewrites `public/trends/latest.json`, runs the format test, shows you the summary, and pushes after you confirm. The push redeploys the app, and the report reaches everyone's phone a few minutes later.

The command is in [`.claude/commands/trend-report.md`](../.claude/commands/trend-report.md). It only ever changes that one file and never sees the team's jobs, clients or numbers.

## 2. A scheduled routine

To run it without opening Claude Code, run `/schedule` in Claude Code and ask for a weekly routine on **Mondays at 8:00 AM Asia/Manila** that does what `.claude/commands/trend-report.md` says, with push access to `jaderans/jworks_studio`. A routine may use more of your plan than running it by hand.

## 3. Claude.ai, from the app (no API key)

**Marketing → Trends → Research in Claude.ai** copies the research prompt and opens Claude.ai. Turn on web search there, paste and send. When Claude finishes, copy its whole answer and paste it back into the app. The report is saved in the app and syncs to the team, but it doesn't change the published file.

## 4. With an API key, in the app

With a Claude API key on the device (Settings → Assistant), **Research trends now** does the same in one click. A run takes a minute or two and costs about 10–30 US cents; the app shows the actual cost afterwards.

## By hand

Edit `public/trends/latest.json` in GitHub's web editor, keep the same shape and commit to `main`. If the deploy's checks fail, something in the file doesn't match the format (a missing source, a bad date or a typo in the JSON); compare it with the previous version in the file's history.
