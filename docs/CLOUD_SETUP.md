# Connecting the team (cloud sync)

Without cloud sync, JoshWorks Studio works on one device. With it, every designer opens the same jobs and calendar on their own phone or laptop. Status changes, comments and payments arrive live, and everything is backed up.

Sync runs on your own Firebase project, separate from JoshWorks POS, so the two apps never share accounts or data. The free Spark plan is enough for a five-person team.

## 1. Create the Firebase project (owner, once, about 10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), sign in with the JoshWorks Google account and choose **Add project**. Google Analytics isn't needed.
2. **Build → Authentication → Get started**. Under **Sign-in method**, turn on **Email/Password**. That is the only sign-in the team needs (Google isn’t used).
3. **Build → Firestore Database → Create database**. Choose **asia-southeast1 (Singapore)** and start in **production mode**.
4. In Firestore, open **Rules**, replace everything with the JoshWorks rules and click **Publish**. Copy them from **Settings → Cloud sync → Copy the security rules** in the app, or from [`firebase/firestore.rules`](../firebase/firestore.rules).
5. **Project settings → Your apps → Web (`</>`)**, register an app (no hosting needed) and copy the `firebaseConfig` block.
6. **Authentication → Settings → Authorized domains**: make sure `jaderans.github.io` is listed.

The `firebaseConfig` values aren't secret: they only say which project to talk to. The security rules decide who can read and write.

> **Already set up?** After updating to JoshWorks Studio, publish the rules again (step 4). The new rules add jobs, payments, invoices and designer pay; until they're published, those don't sync.
>
> **October 2026 updates:** publish the rules once more. They add **team logins made by the owner** (email + temporary password, no email confirmation), **new passwords from the Team page** (the sign-in pointers in `signin`) and **client links** (Documents → Contracts → Client link). Client links let a client open one contract, answer the questionnaire and sign, and nothing else: no account, no other records, and only once before the link expires.

## 2. No Firebase emails

Firebase sends nobody an email: there's no email confirmation and no "Forgot password" link. The owner makes every login in the app, and when someone loses or forgets a password the owner gives them a new temporary one (see below). Optional: **Project settings → General → Public-facing name** `JoshWorks Studio`.

## 3. Connect the owner's device

1. In the app: **Settings → Cloud sync and team accounts**.
2. Paste the `firebaseConfig` block. Keep the team name `joshworks`; every device on the team uses the same one.
3. Click **Connect this device**, choose **Create the owner account**, and enter your email and a password. No confirmation email. (Set the owner account up with Google before? The small **Continue with Google** link under the form still works for you.)

Everything already on this device uploads once you're signed in.

## 4. Add the team

1. **Team → Add person**. Enter their **name** and a **working email**. They're **Managers** by default: they see and run everything happening at the studio (jobs, clients, documents, money, marketing) and their own **My pay**; only the owner changes the team and settings. (**Designer** is still there for someone who should only see their jobs, the calendar and their own pay.)
2. Press **Save**. The app makes their login with a **temporary password** and shows it once, with the team sign-in link (their email already filled in):
   - **Email it** sends it from the studio Gmail ([EMAIL_SETUP.md](EMAIL_SETUP.md)), or
   - **Copy message** to paste in Messenger or Viber.
3. They open the link and sign in with their email and the temporary password. **Choosing their own password comes first**, wherever they sign in (nothing else opens until they do), then a short **welcome guide** to the app. No Google account and no email confirmation.

### The team sign-in link

**Team → Copy sign-in link** copies one link for the whole team. Pin it in the team chat: it opens the app's **Sign in** screen (email and password) on any phone or laptop and connects that device to the studio. A designer who opened the plain app address instead taps **Team member? Sign in** on the welcome screen and pastes the link there. After the first sign-in, the device remembers them.

**Optional: no link at all.** In **Settings → Cloud sync**, open *Optional: show Sign in at the app’s own address* and press **Copy for GitHub**. On GitHub, open the repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**, name it `STUDIO_CLOUD` and paste the value. Then **Actions → Deploy to GitHub Pages → Run workflow**. From then on, `jaderans.github.io/jworks_studio` itself opens Sign in on a new device. The value is your Firebase project's public config, the same thing the sign-in link carries; the security rules and each person's password protect the data.

The Team page shows where each person is: **No login yet** or **Old invite** (press **Make login**), **Temporary password** (press **Send login** to show it again on the device that made it), or **Signed in**.

### New passwords

- **One person** lost their temporary password or forgot their own: press **New password** (the key) next to their name.
- **Everyone at once**: **Team → New passwords for everyone**. You get one list with each person's email and new temporary password: **Copy the list** for yourself, then send each person **only their own** (Copy or Email on their row).

Their old password stops working right away; anyone signed in on a phone is asked to sign in again with the new one, then chooses their own password. Behind the scenes Firebase doesn't let an app change someone else's password, so a new password is a fresh login on a tagged copy of their email (for example `kaye+jw4k7p@example.com`). They still sign in with their own email; the app finds the right login. The old logins stay unused under Firebase → Authentication → Users; you may delete them there, but you don't have to.

A login only works for the account the app made: someone who registers the same email elsewhere gets nothing.

**Changing someone's email** moves their access: the old address stops working, and the new one gets a fresh login to send. **To pause someone**, edit them and mark them inactive; their access stops right away and their work stays.

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
- **Forgot the password**: the owner presses **New password** next to their name in Team and sends them the new temporary one.
- **"The owner made a new temporary password"**: sign in again (Settings → Cloud sync, or the team sign-in link) with your email and the new temporary password.
- **Moving to a new phone**: open the team sign-in link (pinned in the team chat) and sign in.
