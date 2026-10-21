# Branded email (invoices, receipts, reminders, invites)

JoshWorks Studio sends its emails from the studio Gmail (jworks1505@gmail.com) through **EmailJS**, in the JoshWorks design: the logo, the teal-and-gold bar, a yellow button and the payment details. The free EmailJS plan covers 200 emails a month.

Because the email really leaves from your Gmail account, it carries Gmail's own sender checks, which keeps it out of Spam far better than Firebase's default emails.

What it sends:

| Email | From where |
| --- | --- |
| Team invite | Team → **Invite** |
| Quote | Documents → Quotes → **Email** |
| Contract ready to sign | Documents → Contracts → **Email** |
| Invoice and payment reminder | Money → Invoices (one click for overdue ones) |
| Acknowledgment receipt | Money → Payments → **Email the receipt** |

PDFs aren't attached (the free plan limits the size). Use the **PDF** button to share the file in Messenger or attach it yourself.

## Set it up (owner, once, about 10 minutes)

1. Go to [emailjs.com](https://www.emailjs.com) and sign up with the studio Gmail.
2. **Email Services → Add New Service → Gmail → Connect Account**, choose the studio Gmail, allow sending, then **Create Service**. Copy the **Service ID** (`service_…`).
3. **Email Templates → Create New Template**:
   - **Subject**: `{{subject}}`
   - **Content**: click **Edit Content → Code Editor**, delete everything, and put only `{{{html}}}` (three braces, so the design comes through as a design and not as text). Save.
   - On the right: **To Email** `{{to_email}}`, **From Name** `{{from_name}}`, **From Email** leave as the default (your Gmail), **Reply To** `{{reply_to}}`, **Bcc** `{{cc_email}}`.
   - Save, then copy the **Template ID** (`template_…`).
4. **Account → General**: copy the **Public Key**.
5. In the app: **Settings → Email**. Paste the three values, check the sender name (`JoshWorks Studio`) and where replies go, and **Save**.
6. **Send a test** to yourself. The first one may land in Spam: open it, choose **Not spam**, and add the studio Gmail to your contacts.

The public key is meant to be public; it only lets this template be sent. Managers can send emails too; designers can't see these settings.

## If it doesn't send

- **"EmailJS didn't accept the request"**: one of the three IDs is wrong, or the template was deleted. Copy them again.
- **"EmailJS blocked this site"**: in EmailJS → **Account → Security**, allow `jaderans.github.io` (or turn off the domain list).
- **"Too many emails at once"**: wait a minute. The free plan also stops at 200 a month; the count resets monthly.
- **The design shows as code**: the template content must be `{{{html}}}` with three braces, not two.
- **No logo in the email**: the logo is loaded from the live site (`/brand/email-logo.png`). It shows once the app is published at its address.

## Firebase's own emails (sign-up confirmation, password reset)

These come from Firebase, not EmailJS. Make them look like JoshWorks and stay out of Spam: see "Make Firebase's emails look like JoshWorks" in [CLOUD_SETUP.md](CLOUD_SETUP.md). Signing in with **Continue with Google** skips the confirmation email entirely.
