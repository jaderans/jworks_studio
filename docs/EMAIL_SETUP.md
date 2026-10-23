# Studio email (designer invites, contracts, invoices, quotations)

JoshWorks Studio sends its emails from the studio Gmail (jworks1505@gmail.com). They have two jobs:

1. **Designers**: the team invite, so each designer can approve and join their account.
2. **Clients**: their **contracts, invoices and quotations**, with the PDF attached, plus acknowledgment receipts and payment reminders.

The app designs every email in the JoshWorks style: the logo, the teal-and-gold bar, a yellow button, and the payment details with your GCash / Maya **QR codes shown inside the email**. A small **Google Apps Script** that lives in the studio Gmail account delivers it ([apps-script/Mailer.gs](../apps-script/Mailer.gs)), the same way your Batch Nexus order emails were sent. No third-party email service is involved.

Because the email really leaves from your Gmail, it carries Gmail's own sender checks, which keeps it out of Spam. A free Gmail account can send about **100 emails a day**; Settings → Email shows how many are left after each send.

| Email | Sent from | Attached |
| --- | --- | --- |
| Team invite (approve your account) | Team → **Invite** | — |
| Quotation | Documents → Quotes → **Email** | Quote PDF |
| Contract | Documents → Contracts → **Email** | Contract PDF |
| Invoice and payment reminder | Money → Invoices (one click for overdue ones) | Invoice PDF |
| Acknowledgment receipt | Money → Payments → **Email the receipt** | Receipt PDF |

## Set it up (owner, once, about 5 minutes)

1. In the app: **Settings → Email → Copy the script**. The app makes a secret key and puts it in the script for you.
2. Signed in as **jworks1505@gmail.com**, open [script.google.com](https://script.google.com) → **New project**. Delete what is there, paste, and save (name it "JoshWorks mailer").
3. At the top, pick **authorize** next to the Run button and press **Run**. Google asks for permission: choose the studio account → **Advanced → Go to JoshWorks mailer** → **Allow**. (It's your own script, so Google shows this warning.)
4. **Deploy → New deployment** → the gear → **Web app**:
   - Description: `JoshWorks mailer`
   - Execute as: **Me (jworks1505@gmail.com)**
   - Who has access: **Anyone**

   Press **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Back in the app: paste it into **Mailer link**, and press **Save**.
6. Press **Check the connection**, then **Send a test** to yourself. The first email may land in Spam: open it, choose **Not spam**, and add the studio Gmail to your contacts.

"Anyone" only means the app can reach the script without signing in. The script refuses every request that doesn't carry your key, and the key is kept in the app's settings, which only the owner and managers can read.

### After changing the script

Apps Script keeps running the version you deployed. After any edit (or after **New key** in the app, then **Copy the script** again and pasting it), choose **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The link stays the same.

## If it doesn't send

- **"The mailer key doesn't match"**: the key in the app and the script's `KEY` line differ. Copy the script again from the app, paste it, and deploy a new version.
- **"The mailer link didn't answer like the JoshWorks mailer"**: the link is wrong, or the deployment isn't set to **Anyone**. Open Deploy → Manage deployments and copy the Web app URL again.
- **"Gmail's daily sending limit is used up"**: about 100 emails a day on a free account. It resets the next day.
- **No QR codes in the email**: add them in Settings → Payment methods (each method's QR picture), and turn the method on.
- **No logo in the email**: the logo is loaded from the live site (`/brand/email-logo.png`). It shows once the app is published at its address.

## Firebase's own emails (sign-up confirmation, password reset)

These come from Firebase, not the mailer. Make them look like JoshWorks and stay out of Spam: see "Make Firebase's emails look like JoshWorks" in [CLOUD_SETUP.md](CLOUD_SETUP.md). Signing in with **Continue with Google** skips the confirmation email entirely.
