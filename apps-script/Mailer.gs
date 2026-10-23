/**
 * JoshWorks Studio mailer
 * =========================================================================
 * Sends the studio app's emails from this Gmail account (jworks1505@gmail.com):
 *   - team invites, so designers can approve and join their account
 *   - contracts, invoices and quotations for clients (plus receipts and
 *     payment reminders), with the PDF attached and the GCash / Maya QR codes
 *     shown inside the email
 *
 * The app designs every email (HTML with the JoshWorks logo and colors); this
 * script only delivers it through Gmail, so no third-party email service is
 * involved. Gmail allows about 100 emails a day on a free account.
 *
 * SETUP (once, about 5 minutes; full steps in docs/EMAIL_SETUP.md):
 *   1. Signed in as jworks1505@gmail.com, open script.google.com → New project.
 *   2. Paste this whole file, replacing what is there.
 *   3. In the app: Settings → Email → copy the mailer key, and paste it below
 *      between the quotes of KEY.
 *   4. Run "authorize" once (the ▶ Run button) and allow the permission.
 *   5. Deploy → New deployment → Web app. Execute as: Me. Who has access:
 *      Anyone. Copy the web app URL into Settings → Email in the app.
 *   After editing this file, Deploy → Manage deployments → Edit → New version.
 */

const KEY = 'PASTE-THE-KEY-FROM-THE-APP';

/** The app posts each email here. */
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (KEY.indexOf('PASTE') === 0 || req.key !== KEY) return reply_({ ok: false, error: 'key' });
    if (req.ping) return reply_({ ok: true, remaining: MailApp.getRemainingDailyQuota() });

    const to = String(req.to || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return reply_({ ok: false, error: 'to' });
    if (MailApp.getRemainingDailyQuota() < 1) return reply_({ ok: false, error: 'quota', remaining: 0 });

    const message = {
      to: to,
      subject: String(req.subject || 'JoshWorks'),
      body: String(req.text || ''),
      htmlBody: String(req.html || ''),
      name: String(req.name || 'JoshWorks Studio'),
      attachments: (req.attachments || []).map(blob_),
      inlineImages: {},
    };
    if (req.replyTo) message.replyTo = String(req.replyTo);
    if (req.bcc) message.bcc = String(req.bcc);
    Object.keys(req.inline || {}).forEach(function (cid) {
      message.inlineImages[cid] = blob_(req.inline[cid]);
    });

    MailApp.sendEmail(message);
    return reply_({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply_({ ok: false, error: 'failed', message: String((err && err.message) || err) });
  }
}

/** Opening the web app URL in a browser shows that it is running. */
function doGet() {
  return reply_({ ok: true, app: 'JoshWorks Studio mailer' });
}

/** Run once from the editor: Gmail asks for permission to send as this account. */
function authorize() {
  Logger.log('Ready. Emails left today: ' + MailApp.getRemainingDailyQuota());
}

/** { name, type, data (base64) } → a file Gmail can attach or show inline. */
function blob_(f) {
  return Utilities.newBlob(Utilities.base64Decode(f.data), f.type, f.name);
}

function reply_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
