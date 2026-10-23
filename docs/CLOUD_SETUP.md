# Connecting the team (cloud sync)

Without cloud sync, JoshWorks Studio works on one device. With it, every designer opens the same jobs and calendar on their own phone or laptop. Status changes, comments and payments arrive live, and everything is backed up.

Sync runs on your own Firebase project, separate from JoshWorks POS, so the two apps never share accounts or data. The free Spark plan is enough for a five-person team.

## 1. Create the Firebase project (owner, once, about 10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), sign in with the JoshWorks Google account and choose **Add project**. Google Analytics isn't needed.
2. **Build → Authentication → Get started**. Under **Sign-in method**, turn on **Google** (choose the studio Gmail as the support email) and **Email/Password**.
3. **Build → Firestore Database → Create database**. Choose **asia-southeast1 (Singapore)** and start in **production mode**.
4. In Firestore, open **Rules**, replace everything with the JoshWorks rules and click **Publish**. Copy them from **Settings → Cloud sync → Copy the security rules** in the app, or from [`firebase/firestore.rules`](../firebase/firestore.rules).
5. **Project settings → Your apps → Web (`</>`)**, register an app (no hosting needed) and copy the `firebaseConfig` block.
6. **Authentication → Settings → Authorized domains**: make sure `jaderans.github.io` is listed.

The `firebaseConfig` values aren't secret: they only say which project to talk to. The security rules decide who can read and write.

> **Already set up?** After updating to JoshWorks Studio, publish the rules again (step 4). The new rules add jobs, payments, invoices and designer pay; until they're published, those don't sync.
>
> **October 2026 update:** publish the rules once more for **client links** (Documents → Contracts → Client link). They let a client open one contract with its link, answer the questionnaire and sign, and nothing else: no account, no other records, and only once before the link expires.

## 2. Make Firebase's emails look like JoshWorks

Firebase sends the sign-up confirmation and password-reset emails. By default they come from "noreply@your-project.firebaseapp.com" with the project's code name, which looks like spam. Fix it once:

1. **Project settings → General → Public-facing name**: `JoshWorks Studio`. This replaces "joshworks-campaigns" in every email.
2. **Authentication → Templates**. For **Email address verification** and **Password reset**, click the pencil:
   - **Sender name**: `JoshWorks Studio`
   - **Reply to**: `jworks1505@gmail.com`
   - **Subject**: for example "Confirm your email for JoshWorks Studio" and "Reset your JoshWorks Studio password".
   - Click **Customize action URL** and enter `https://jaderans.github.io/jworks_studio/`. The links in the emails then open the app's own page ("Email confirmed" or "Set a new password") in the JoshWorks design instead of Firebase's plain page.
   - Save.

Firebase doesn't let you change the email's design or the sending address on the free plan, so the best fix is to skip the email: **Continue with Google** signs people in with no confirmation email at all. Ask designers with Gmail accounts to use it.

## 3. Connect the owner's device

1. In the app: **Settings → Cloud sync and team accounts**.
2. Paste the `firebaseConfig` block. Keep the team name `joshworks`; every device on the team uses the same one.
3. Click **Connect this device**, then **Continue with Google** (or create an email and password account and confirm it).

Everything already on this device uploads once you're signed in.

## 4. Invite the team

1. **Team → Add person** (or edit someone the imports already added). Enter their **sign-in email**: their Google account, or any email they'll use with a password. Choose a role:
   - **Designer**: their jobs and deadlines (status, revisions, delivery checklist, links), the content calendar, board, ideas, trends and results, and **My pay** (their own earnings, payouts and payout details). No prices, quotes, contracts, invoices, client payments or other people's pay.
   - **Manager**: everything a designer can do, plus jobs' money, clients, quotes, contracts, invoices, payments, payouts, expenses, reports and BIR. Not the team or settings.
   - **Owner**: everything, including settings, team access and the activity log.
2. Click **Invite**. With email set up ([EMAIL_SETUP.md](EMAIL_SETUP.md)) it sends a branded invite; the link icon shares the invite link instead (Messenger, Viber).
3. They open the link and sign in with Google or that same email. Their device then fills with what their role can see.

**Changing someone's email** moves their access: the old address stops working and the new one can sign in. Send them a new invite. **To pause someone**, edit them and mark them inactive; their access stops right away and their work stays.

## What syncs and what doesn't

| Syncs to the team | Stays on the device |
| --- | --- |
| Jobs and their progress; posts, comments, ideas, campaigns, trends, results | The Claude API key and assistant chats |
| Clients, quotes, contracts, invoices, payments, payouts, expenses (owner and managers only) | Light or dark, the collapsed menu, the brand filter |
| Each designer's own earnings, payouts and payout details (only to them, the owner and managers) | |
| Settings: business, voice, rhythm, checklist; money, BIR, payment methods and email keys (owner and managers) | |

Nothing waits for the internet: changes save on the device first and upload when there's a connection. If two people edit the same record, the latest save wins, and the activity log shows who changed what. A change the rules refuse stays on the device and is shown under the sync status, so nothing is lost silently.

## If something goes wrong

- **"Missing or insufficient permissions"**: the rules weren't published (or are the old ones), or this person's email isn't on the Team page with access.
- **"This site isn't allowed to sign in yet"**: add `jaderans.github.io` under **Authentication → Settings → Authorized domains**.
- **The Google window doesn't open**: allow pop-ups for the site, or sign in with email and password.
- **Forgot the password**: **Forgot password** on the sign-in form sends a reset link.
- **Moving to a new phone**: open the invite link again (or ask the owner for a new one) and sign in.
