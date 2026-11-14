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
 * It also keeps JoshWorks POS files in this account's Google Drive, in a
 * "JoshWorks POS" folder it makes: "Custom stickers" (PNG designs named like
 * CS01-Couple.png that flash on the POS customer screen), "Booth photos" and
 * "Customer screen ads". It only ever reads and writes inside those folders.
 *
 * SETUP (once, about 5 minutes; full steps in docs/EMAIL_SETUP.md):
 *   1. Signed in as jworks1505@gmail.com, open script.google.com → New project.
 *   2. Paste this whole file, replacing what is there.
 *   3. In the app: Settings → Email → copy the mailer key, and paste it below
 *      between the quotes of KEY.
 *   4. Run "authorize" once (the ▶ Run button) and allow the permissions
 *      (Gmail, and Drive for the POS folders).
 *   5. Deploy → New deployment → Web app. Execute as: Me. Who has access:
 *      Anyone. Copy the web app URL into Settings → Email in the app.
 *   After editing this file, Deploy → Manage deployments → Edit → New version.
 */

const KEY = 'PASTE-THE-KEY-FROM-THE-APP';

/** The POS's folders in Drive, made when first needed. */
const ROOT = 'JoshWorks POS';
const FOLDERS = { stickers: 'Custom stickers', photos: 'Booth photos', ads: 'Customer screen ads' };
/** Files bigger than this aren't sent to the POS. */
const MAX_BYTES = 15 * 1024 * 1024;

/** The app posts each email here. */
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (KEY.indexOf('PASTE') === 0 || req.key !== KEY) return reply_({ ok: false, error: 'key' });
    if (req.ping) return reply_({ ok: true, remaining: MailApp.getRemainingDailyQuota(), drive: true });
    if (req.action) return reply_(drive_(req));

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

/** Run once from the editor: Google asks for permission to send as this account and to use its Drive. */
function authorize() {
  Object.keys(FOLDERS).forEach(folder_);
  Logger.log('Ready. Emails left today: ' + MailApp.getRemainingDailyQuota() + '. POS folders are in Drive → ' + ROOT + '.');
}

/**
 * The POS's Drive actions, only ever inside the POS folders:
 *   drive.folders              the folders' links
 *   drive.list   { folder }    images and videos in a folder, newest first
 *   drive.get    { folder, id } one file's bytes (base64)
 *   drive.save   { folder, file: { name, type, data } }
 */
function drive_(req) {
  if (req.action === 'drive.folders') {
    const out = {};
    Object.keys(FOLDERS).forEach(function (k) {
      out[k] = folder_(k).getUrl();
    });
    return { ok: true, folders: out };
  }
  const folder = folder_(String(req.folder || ''));
  if (req.action === 'drive.list') {
    const files = [];
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const type = f.getMimeType();
      if (f.isTrashed() || !/^(image|video)\//.test(type)) continue;
      files.push({ id: f.getId(), name: f.getName(), type: type, size: f.getSize(), updated: f.getLastUpdated().getTime() });
    }
    files.sort(function (a, b) { return b.updated - a.updated; });
    return { ok: true, files: files, folderUrl: folder.getUrl() };
  }
  if (req.action === 'drive.get') {
    const file = DriveApp.getFileById(String(req.id || ''));
    if (!inside_(file, folder)) return { ok: false, error: 'not-found' };
    if (file.getSize() > MAX_BYTES) return { ok: false, error: 'too-big' };
    return { ok: true, name: file.getName(), type: file.getMimeType(), data: Utilities.base64Encode(file.getBlob().getBytes()) };
  }
  if (req.action === 'drive.save') {
    const made = folder.createFile(blob_(req.file));
    return { ok: true, id: made.getId(), url: made.getUrl() };
  }
  return { ok: false, error: 'action' };
}

/** A POS folder by its key, made inside "JoshWorks POS" if it isn't there yet. */
function folder_(key) {
  const name = FOLDERS[key];
  if (!name) throw new Error('Unknown folder: ' + key);
  const roots = DriveApp.getFoldersByName(ROOT);
  const root = roots.hasNext() ? roots.next() : DriveApp.createFolder(ROOT);
  const subs = root.getFoldersByName(name);
  return subs.hasNext() ? subs.next() : root.createFolder(name);
}

function inside_(file, folder) {
  const parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) return true;
  return false;
}

/** { name, type, data (base64) } → a file Gmail can attach or show inline. */
function blob_(f) {
  return Utilities.newBlob(Utilities.base64Decode(f.data), f.type, f.name);
}

function reply_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
