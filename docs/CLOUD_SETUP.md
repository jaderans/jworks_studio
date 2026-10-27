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
> **October 2026 updates:** publish the rules once more. They add **team logins made by the owner** (email + temporary password, no email confirmation) and **client links** (Documents → Contracts → Client link). They let a client open one contract with its link, answer the questionnaire and sign, and nothing else: no account, no other records, and only once before the link expires.

## 2. Make Firebase's password-reset email look like JoshWorks

Nobody confirms their email any more: the owner makes each login in the app. Firebase only sends an email when someone taps **Forgot password?**. By default they come from "noreply@your-project.firebaseapp.com" with the project's code name, which looks like spam. Fix it once:

1. **Project settings → General → Public-facing name**: `JoshWorks Studio`. This replaces "joshworks-campaigns" in every email.
2. **Authentication → Templates → Password reset**, click the pencil:
   - **Sender name**: `JoshWorks Studio`
   - **Reply to**: `jworks1505@gmail.com`
   - **Subject**: for example "Reset your JoshWorks Studio password".
   - Click **Customize action URL** and enter `https://jaderans.github.io/jworks_studio/`. The link in the email then opens the app's own "Set a new password" page in the JoshWorks design.
   - Save.

## 3. Connect the owner's device

1. In the app: **Settings → Cloud sync and team accounts**.
2. Paste the `firebaseConfig` block. Keep the team name `joshworks`; every device on the team uses the same one.
3. Click **Connect this device**, choose **Create the owner account**, and enter your email and a password. No confirmation email. (Set the owner account up with Google before? The small **Continue with Google** link under the form still works for you.)

Everything already on this device uploads once you're signed in.

## 4. Add the team

1. **Team → Add person**. Enter their **name** and a **working email**. They're **Managers** by default: they see and run everything happening at the studio (jobs, clients, documents, money, marketing) and their own **My pay**; only the owner changes the team and settings. (**Designer** is still there for someone who should only see their jobs, the calendar and their own pay.)
2. Press **Save**. The app makes their login with a **temporary password** and shows it once, with the app link:
   - **Email it** sends it from the studio Gmail ([EMAIL_SETUP.md](EMAIL_SETUP.md)), or
   - **Copy message** to paste in Messenger or Viber.
3. They open the link, sign in with their email and the temporary password, **choose their own password**, and get a short **welcome guide** to the app. No Google account and no email confirmation.

The Team page shows where each person is: **No login yet** (press **Make login**), **Temporary password** (press **Send login** to show it again on the device that made it), or **Signed in**.

A login only works for the account the app made: someone who registers the same email elsewhere gets nothing. If a person forgets their password, they tap **Forgot password?** on the sign-in screen.

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
- **Forgot the password**: **Forgot password** on the sign-in form sends a reset link.
- **Moving to a new phone**: open the invite link again (or ask the owner for a new one) and sign in.
