# JoshWorks Studio

The operating app of JoshWorks, a graphic design studio in Iloilo City: jobs and deadlines, clients, quotes, contracts and invoices on the JoshWorks letterhead, client payments, designer payouts, BIR, and the studio's own marketing.

It is a web app that installs like a phone app (PWA). It works offline, keeps data on each device, and can sync the team through your own free Firebase project.

**Live app:** https://jaderans.github.io/jworks_studio/

## What's inside

**Jobs**
- **Job board**: inquiry → not started → in progress → for review → revisions → completed, with drag and drop on a computer.
- **All jobs, Deadlines and Workload**: what's late, what's due this week, and each designer's open jobs.
- **Each job**: client, dates, team, brief, a revision counter (extra rounds add +15% to the next invoice), a delivery checklist, links, and the money (price lines, team split, payments, invoices).
- **Inquiry intake**: a quick form for a Messenger message or a walk-in. It adds the client and the job in one step.

**Clients**: every kind (business, student org, school, individual, LGU), from inquiry to completed, with each client's jobs, quotes, contracts, invoices and payments, and a "Repeat" badge. Student orgs get student prices.

**Money**
- **Invoices** in the studio's own layout (JW-0032-2026 onward), on the letterhead, with payment details and QR codes. Paid, partly paid and overdue update themselves from the payments. Reminders go out by email in one click.
- **Payments**: each one gets an acknowledgment receipt (AR-0001-2026).
- **Payouts**: each client payment releases every designer's share after the 5% deduction, so the team can be paid as the money comes in. Designers add where they want to be paid (GCash, bank, QR code) under **My pay**.
- **Expenses, Reports and BIR**: the commission tracker's monthly and yearly summary, targets, top clients, and the 8% income tax estimate with the 1701Q/1701A schedule.

**Documents**: quotes from the price list (business and student prices, add-ons, ownership buy-outs, the REPYOURORG15 code), the 13 v1.0 contract templates, and the team's rates. Quote → contract → job → invoice carries everything forward, so nothing is typed twice.

**Marketing**: the content calendar (weekly themes, break weeks, Philippine holidays), the board, ideas and carousel scripts, campaigns, trends, results, and the assistant.

**People**: owner, manager and designer roles, sign-in with Google or email, invites by email, an activity log, backups and an owner PIN.

**Import**: the commission tracker (jobs, payments, splits, targets, BIR settings) and the content planner (.xlsx), read on the device.

## Data and privacy

- **Local first.** Everything lives in the browser on each device (IndexedDB) and works offline. Export a backup from Settings any time.
- **Team sync is optional.** It runs on your own Firebase project: [docs/CLOUD_SETUP.md](docs/CLOUD_SETUP.md). Designers never receive prices, quotes, contracts, invoices, client payments or other people's pay; the security rules enforce it.
- **Studio email** (designer invites; client contracts, invoices and quotations with the PDF attached) goes out from the studio Gmail through a Google Apps Script in that account: [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md).
- **The Claude API key never leaves the device** where it was entered. Without one, the assistant works through Claude.ai: the app writes the prompt, you paste the answer back.
- **Never store client passwords.** Ask clients for partner access in Meta Business Suite and TikTok Business Center instead.
- **This repository is public.** The commission tracker, planners, client documents, brand fonts and payment QR codes are git-ignored or stay in the app's own database. Keep client data out of commits.

How the money works, step by step: [docs/MONEY.md](docs/MONEY.md).

## Weekly trend report

`public/trends/latest.json` is the report everyone sees under Marketing → Trends. Run `/trend-report` in Claude Code each Monday to research and publish it. See [docs/TREND_REPORT.md](docs/TREND_REPORT.md).

## Development

Requires Node 22.

```sh
npm ci
npm run dev          # http://localhost:5173
npm run check        # type check + unit tests (Vitest)
npm run e2e          # production build + the owner journeys and layout checks in Chrome (Playwright)
npm run test:rules   # the Firestore security rules, in the emulator (needs Java)
npm run build        # dist/
```

Tests that read the owner's private files (the tracker and planners) skip themselves when the files aren't there, so CI runs without them. The e2e run saves screenshots of every screen in `test-results/shots`.

| Folder | What's there |
| --- | --- |
| `src/domain` | Pure logic with tests: money and payouts, BIR, pricing, the price list and contract templates, jobs, the tracker and planner readers, the calendar |
| `src/services` | Saving and loading records, imports, backups |
| `src/features` | One folder per screen |
| `src/db` | The IndexedDB schema (Dexie) and settings |
| `src/sync` | Firebase sign-in and sync |
| `src/email` | Branded email templates and sending |
| `src/reports` | PDFs on the letterhead: invoices, receipts, quotes, contracts, statements, reports |
| `firebase/firestore.rules` | Who can read and write what in the cloud |

## Deploy

Every push to `main` runs the checks and publishes to GitHub Pages (**Settings → Pages → Source: GitHub Actions**).
