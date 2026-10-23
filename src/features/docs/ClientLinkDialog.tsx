import { useState } from 'react';
import { Copy, Eye, FileSignature, ListChecks, Mail, PowerOff } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout } from '../../components/ui';
import { TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { useSyncStatus } from '../../sync/useSync';
import { contractEmail, questionnaireEmail } from '../../email/templates';
import { emailReady, sendEmail } from '../../email/send';
import { copyText } from '../../lib/text';
import { fmtDateTime, fmtIsoDate, isoDate } from '../../lib/time';
import { ClientLinkView } from '../clientlink/ClientLinkView';
import type { LinkKind, LinkSnapshot } from '../../domain/clientLink';
import type { BusinessSettings, Contract, ContractTemplate, EmailSettings, StudioPayMethod } from '../../db/types';

const links = () => import('../../sync/clientLinks');

const STATUS: Record<NonNullable<Contract['link']>['status'], { label: string; tone?: 'good' | 'yellow' | 'teal' }> = {
  open: { label: 'Waiting for the client', tone: 'yellow' },
  responded: { label: 'Answered, merging…', tone: 'teal' },
  applied: { label: 'Received', tone: 'good' },
  off: { label: 'Turned off' },
};

/**
 * Share a contract with the client: a link to answer the questionnaire, or to
 * review and sign the contract, on their phone. Their answers and signature come
 * back into this contract by themselves.
 */
export function ClientLinkDialog({
  open,
  onClose,
  contract,
  template,
  business,
  payMethods,
  email,
  totals,
  beforeShare,
  onChange,
  pdf,
}: {
  open: boolean;
  onClose: () => void;
  contract: Contract;
  template: ContractTemplate;
  business: BusinessSettings;
  payMethods: StudioPayMethod[];
  email: EmailSettings;
  totals: { net: number; down: number };
  /** Saves the editor's changes first; returns the saved contract. */
  beforeShare: () => Promise<Contract>;
  onChange: (c: Contract) => void;
  /** The contract PDF, attached to the signing email. */
  pdf: () => Promise<{ name: string; blob: Blob }>;
}) {
  const app = useApp();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<{ kind: LinkKind; snapshot: LinkSnapshot } | null>(null);
  const cloudOk = sync.enabled && !!sync.access && sync.access.role !== 'designer';
  const link = contract.link;
  const clientEmail = contract.fields['client.email'];

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'That didn’t work', { tone: 'bad', ms: 9000 });
    } finally {
      setBusy('');
    }
  };

  const make = (kind: LinkKind) =>
    run(kind, async () => {
      const saved = await beforeShare();
      const next = await (await links()).makeClientLink(saved, kind);
      onChange(next);
      if (next.link && (await copyText(next.link.url))) app.toast('Link made and copied. Paste it in Messenger, or email it from here.', { tone: 'good' });
    });

  const emailIt = () =>
    run('email', async () => {
      if (!link || !clientEmail) return;
      const name = contract.fields['client.contact'] || contract.fields['client.name'];
      if (link.kind === 'sign') {
        const file = await pdf();
        await sendEmail(
          { email: clientEmail, name },
          contractEmail(business, { clientName: name, number: contract.number, title: contract.title || template.name, total: totals.net, down: totals.down, signUrl: link.url }, payMethods),
          { what: `signing link for ${contract.number}`, attachments: [file] },
        );
      } else {
        await sendEmail({ email: clientEmail, name }, questionnaireEmail(business, { clientName: name, title: template.briefTitle || 'project questionnaire', url: link.url }), { what: `questionnaire link for ${contract.number}` });
      }
      app.toast(`Link emailed to ${clientEmail}`, { tone: 'good' });
    });

  const showPreview = (kind: LinkKind) =>
    run(`preview-${kind}`, async () => {
      const saved = await beforeShare();
      setPreview({ kind, snapshot: await (await links()).buildSnapshot(saved) });
    });

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Client link" size="wide" fullPhone>
        <div className="stack">
          <p className="small">
            Send the client a link to answer the <b>{template.briefTitle || 'questionnaire'}</b> on their phone, or to <b>review and sign</b> this contract online. What they send comes back into this contract by itself: answers into the questionnaire, and their name and signature onto the signature line.
          </p>
          {!cloudOk ? (
            <Callout tone="info" title="Needs cloud sync">
              Client links travel through the studio’s cloud. Turn on cloud sync in Settings → Cloud sync and sign in as the owner. You can still preview what the client will see.
            </Callout>
          ) : null}
          {link ? (
            <section className="card stack tight">
              <div className="row wrap between">
                <b>{link.kind === 'sign' ? 'Signing link' : 'Questionnaire link'}</b>
                <Badge tone={STATUS[link.status].tone}>{STATUS[link.status].label}</Badge>
              </div>
              <span className="tiny muted">
                Made {fmtDateTime(link.createdAt)}
                {link.status === 'open' ? ` · works until ${fmtIsoDate(isoDate(link.expiresAt))}` : ''}
                {link.respondedAt ? ` · received ${fmtDateTime(link.respondedAt)}` : ''}
              </span>
              {link.status === 'open' ? (
                <>
                  <TextInput aria-label="Client link" readOnly value={link.url} onFocus={(e) => e.target.select()} />
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Button onClick={async () => app.toast((await copyText(link.url)) ? 'Link copied' : 'Couldn’t copy; select the link and copy it', { tone: 'good' })}>
                      <Copy size={16} /> Copy
                    </Button>
                    <Button disabled={!!busy || !clientEmail || !emailReady(email)} title={!clientEmail ? 'Add the client’s email first' : !emailReady(email) ? 'Connect the studio Gmail in Settings → Email' : undefined} onClick={emailIt}>
                      <Mail size={16} /> {busy === 'email' ? 'Sending…' : 'Email it'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() =>
                        run('off', async () => {
                          onChange(await (await links()).turnOffClientLink(contract));
                        })
                      }
                    >
                      <PowerOff size={16} /> Turn off
                    </Button>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}
          <span className="eyebrow">{link ? 'Make a new link' : 'Make a link'}</span>
          <div className="row wrap" style={{ gap: 8 }}>
            <Button variant="primary" disabled={!cloudOk || !!busy} onClick={() => make('sign')}>
              <FileSignature size={16} /> {busy === 'sign' ? 'Making…' : 'Review & sign link'}
            </Button>
            <Button disabled={!cloudOk || !!busy} onClick={() => make('questionnaire')}>
              <ListChecks size={16} /> {busy === 'questionnaire' ? 'Making…' : 'Questionnaire only'}
            </Button>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => showPreview('sign')}>
              <Eye size={15} /> Preview the signing page
            </Button>
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => showPreview('questionnaire')}>
              <Eye size={15} /> Preview the questionnaire page
            </Button>
          </div>
          <p className="tiny muted">A new link turns off the old one. Links stop working a week after the prices’ valid-until date. Edits you save to this contract update an open link.</p>
        </div>
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} title="What the client sees" size="xwide" fullPhone>
        {preview ? (
          <ClientLinkView
            snapshot={preview.snapshot}
            kind={preview.kind}
            preview
            onSubmit={async () => {
              throw new Error('This is a preview: nothing was sent. Make a link to send it to the client.');
            }}
          />
        ) : null}
      </Dialog>
    </>
  );
}
