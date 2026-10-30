import { useState } from 'react';
import { Download, Mail, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, Callout, Segmented, Toggle } from '../../components/ui';
import { Field, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { useClients, usePackages, useSettingRows } from '../../hooks/data';
import { getSetting, setSetting, settingValue } from '../../db/settings';
import { DEFAULT_RATE_CARD, rateCardSections, rateText, sectionOf } from '../../domain/rateCard';
import { CATEGORIES } from '../../domain/packages';
import { emailReady, sendEmail } from '../../email/send';
import { rateCardEmail } from '../../email/templates';
import { safeFileName } from '../../lib/files';
import { addDays, todayISO } from '../../lib/time';
import type { RateCardSend } from '../../reports/rateCard';
import type { RateCardSettings } from '../../db/types';

type Part = 'for' | 'intro' | 'portfolio' | 'prices' | 'notes';

/**
 * The studio profile & rate card for a client or agency: who it's for, the
 * introduction, portfolio and credentials, which price list sections and
 * prices, and notes. Download it, or email it with the PDF attached. The
 * owner can save the setup for next time.
 */
export function RateCardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const rows = useSettingRows();
  const packages = usePackages() ?? [];
  const clients = useClients() ?? [];
  const [s, setS] = useState<RateCardSettings | null>(null);
  const [send, setSend] = useState<RateCardSend>({
    preparedFor: '',
    attention: '',
    date: todayISO(),
    confidential: true,
  });
  const [to, setTo] = useState('');
  const [part, setPart] = useState<Part>('for');
  const [busy, setBusy] = useState('');
  if (open && !s && rows) setS(structuredClone(settingValue(rows, 'rateCard')));
  if (!open && s) {
    setS(null);
    setPart('for');
  }
  if (!open || !s) return null;

  const owner = app.can('settings');
  const canEmail = emailReady(settingValue(rows, 'email'));
  const who = send.preparedFor.trim();
  const fileName = `${safeFileName(`${settingValue(rows, 'business').name || 'JoshWorks'} ${s.title || 'Rate Card'}${who ? ` - ${who}` : ''}`)}.pdf`;
  const shown = rateCardSections(packages, s);
  const itemCount = shown.reduce((a, x) => a + x.items.length + x.addOns.length, 0);
  const allSections = [...new Set(packages.filter((p) => p.active === 1).map(sectionOf))].sort((a, b) => (CATEGORIES.indexOf(a) + 1 || 999) - (CATEGORIES.indexOf(b) + 1 || 999));
  const set = (patch: Partial<RateCardSettings>) => setS({ ...s, ...patch });
  const text = (key: 'about' | 'services' | 'process' | 'why' | 'credentials' | 'clients' | 'notes', label: string, height: number, hint?: string) => (
    <Field label={label} htmlFor={`rc-${key}`} hint={hint}>
      <TextArea id={`rc-${key}`} rows={height} value={s[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </Field>
  );

  const makePdf = async () => {
    const [{ buildRateCardPdf }, business] = await Promise.all([import('../../reports/rateCard'), getSetting('business')]);
    return buildRateCardPdf(s, send, { business, packages });
  };
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Something went wrong', {
        tone: 'bad',
      });
    } finally {
      setBusy('');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="xwide"
      fullPhone
      title="Studio profile & rate card"
      footer={
        <>
          {owner ? (
            <Button
              variant="ghost"
              disabled={!!busy}
              onClick={() =>
                run('save', async () => {
                  await setSetting('rateCard', s);
                  app.toast('Rate card setup saved for next time', {
                    tone: 'good',
                  });
                })
              }
            >
              <Save size={16} /> Save setup
            </Button>
          ) : null}
          <span className="grow" />
          <Button
            disabled={!!busy || !canEmail || !/\S+@\S+\.\S+/.test(to)}
            title={canEmail ? 'Enter their email under “For”' : 'Connect the studio Gmail in Settings → Email to send it from here'}
            onClick={() =>
              run('email', async () => {
                const [{ renderPdf }, business] = await Promise.all([import('../../reports/pdf'), getSetting('business')]);
                const blob = await renderPdf(await makePdf());
                await sendEmail(
                  {
                    email: to.trim(),
                    name: send.attention.trim() || undefined,
                  },
                  rateCardEmail(business, {
                    name: send.attention.trim(),
                    company: who,
                    validUntil: addDays(send.date, s.validDays || 30),
                    portfolioUrl: s.portfolioUrl,
                    confidential: send.confidential,
                  }),
                  {
                    what: `rate card${who ? ` for ${who}` : ''}`,
                    attachments: [{ name: fileName, blob }],
                  },
                );
                app.toast(`Rate card emailed to ${to.trim()}`, {
                  tone: 'good',
                });
              })
            }
          >
            <Mail size={16} /> {busy === 'email' ? 'Sending…' : 'Email it'}
          </Button>
          <Button
            variant="primary"
            disabled={!!busy || (!s.parts.intro && !s.parts.prices && !s.parts.portfolio)}
            onClick={() =>
              run('pdf', async () => {
                const { deliverPdf } = await import('../../reports/pdf');
                await deliverPdf(await makePdf(), fileName);
              })
            }
          >
            <Download size={16} /> {busy === 'pdf' ? 'Making…' : 'Download PDF'}
          </Button>
        </>
      }
    >
      <Segmented<Part>
        label="Part"
        value={part}
        onChange={setPart}
        options={[
          { value: 'for', label: 'For' },
          { value: 'intro', label: 'Introduction' },
          { value: 'portfolio', label: 'Portfolio' },
          { value: 'prices', label: `Price list · ${itemCount}` },
          { value: 'notes', label: 'Notes' },
        ]}
      />

      {part === 'for' ? (
        <div className="stack">
          <div className="form-grid">
            <Field label="Prepared for" htmlFor="rc-for" hint="Company or person. Leave empty for a general rate card.">
              <TextInput
                id="rc-for"
                list="rc-clients"
                value={send.preparedFor}
                onChange={(e) => {
                  const v = e.target.value;
                  const c = clients.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
                  setSend({
                    ...send,
                    preparedFor: v,
                    attention: c?.contactName && !send.attention ? c.contactName : send.attention,
                  });
                  if (c?.email && !to) setTo(c.email);
                }}
              />
              <datalist id="rc-clients">
                {clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Attention (contact person)" htmlFor="rc-att">
              <TextInput id="rc-att" value={send.attention} onChange={(e) => setSend({ ...send, attention: e.target.value })} />
            </Field>
            <Field label="Their email (to send it)" htmlFor="rc-to">
              <TextInput id="rc-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Date on the cover" htmlFor="rc-date">
              <TextInput id="rc-date" type="date" value={send.date} onChange={(e) => setSend({ ...send, date: e.target.value || todayISO() })} />
            </Field>
            <Field label="Rates valid for (days)" htmlFor="rc-days">
              <TextInput id="rc-days" type="number" min={1} value={s.validDays} onChange={(e) => set({ validDays: Math.max(1, Number(e.target.value) || 30) })} />
            </Field>
            <Field label="Title on the cover" htmlFor="rc-title">
              <TextInput id="rc-title" value={s.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
          </div>
          <Toggle id="rc-conf" checked={send.confidential} onChange={(v) => setSend({ ...send, confidential: v })} label="Mark it confidential: for their internal reference only" />
          {!canEmail ? <Callout tone="info">To email it from the studio Gmail, connect it in Settings → Email. You can always download the PDF and attach it yourself.</Callout> : null}
        </div>
      ) : null}

      {part === 'intro' ? (
        <div className="stack">
          <Toggle id="rc-p-intro" checked={s.parts.intro} onChange={(v) => set({ parts: { ...s.parts, intro: v } })} label="Include the introduction" />
          {text('about', 'About JoshWorks (one paragraph per line)', 5)}
          {text('services', 'What we do', 8, 'One service per line: “Name: what it covers”.')}
          {text('process', 'How we work', 5, 'One step per line: “Step: what happens”.')}
          {text('why', 'Why JoshWorks (one point per line)', 4)}
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                set({
                  about: DEFAULT_RATE_CARD.about,
                  services: DEFAULT_RATE_CARD.services,
                  process: DEFAULT_RATE_CARD.process,
                  why: DEFAULT_RATE_CARD.why,
                })
              }
            >
              <RotateCcw size={15} /> Use the starting text
            </Button>
          </div>
        </div>
      ) : null}

      {part === 'portfolio' ? (
        <div className="stack">
          <Toggle id="rc-p-port" checked={s.parts.portfolio} onChange={(v) => set({ parts: { ...s.parts, portfolio: v } })} label="Include portfolio & credentials" />
          <Field label="Portfolio link" htmlFor="rc-url" hint="Behance, Google Drive, your website or Facebook album. It prints as a QR code to scan.">
            <TextInput id="rc-url" value={s.portfolioUrl} placeholder="behance.net/joshworks" onChange={(e) => set({ portfolioUrl: e.target.value })} />
          </Field>
          {text('credentials', 'Credentials (one per line)', 4, 'e.g. “120+ projects since 2019”, “Official designer of …”, awards, certifications.')}
          {text('clients', 'Notable clients & industries (one per line)', 4, 'Only names you have permission to mention.')}
        </div>
      ) : null}

      {part === 'prices' ? (
        <div className="stack">
          <Toggle id="rc-p-prices" checked={s.parts.prices} onChange={(v) => set({ parts: { ...s.parts, prices: v } })} label="Include the price list" />
          <Segmented<RateCardSettings['prices']>
            label="Prices"
            value={s.prices}
            onChange={(v) => set({ prices: v })}
            options={[
              { value: 'business', label: 'Business' },
              { value: 'student', label: 'Student orgs' },
              { value: 'both', label: 'Both' },
            ]}
          />
          <div className="stack tight">
            <div className="row between wrap">
              <span className="label">Sections ({s.sections.length ? `${s.sections.length} of ${allSections.length}` : 'all'})</span>
              {s.sections.length ? (
                <Button size="sm" variant="ghost" onClick={() => set({ sections: [] })}>
                  Every section
                </Button>
              ) : null}
            </div>
            <div className="chip-row">
              {allSections.map((c) => {
                const on = !s.sections.length || s.sections.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => {
                      const current = s.sections.length ? s.sections : allSections;
                      const next = on ? current.filter((x) => x !== c) : [...current, c];
                      set({
                        sections: next.length === allSections.length ? [] : next,
                      });
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="small muted">
            {itemCount} items in {shown.length} sections. Untick single items below to leave them out. The price list’s own notes never print.
          </p>
          {allSections
            .filter((c) => !s.sections.length || s.sections.includes(c))
            .map((c) => {
              const list = packages.filter((p) => p.active === 1 && sectionOf(p) === c);
              const hiddenHere = list.filter((p) => s.hidden.includes(p.id)).length;
              return (
                <details key={c} className="disclosure">
                  <summary className="small strong">
                    {c} · {list.length - hiddenHere} of {list.length}
                  </summary>
                  <div className="stack tight">
                    {list.map((p) => (
                      <Toggle
                        key={p.id}
                        id={`rc-i-${p.id}`}
                        checked={!s.hidden.includes(p.id)}
                        onChange={(v) =>
                          set({
                            hidden: v ? s.hidden.filter((x) => x !== p.id) : [...s.hidden, p.id],
                          })
                        }
                        label={`${p.name} · ${rateText(p, s.prices === 'student' ? 'student' : 'business')}`}
                      />
                    ))}
                  </div>
                </details>
              );
            })}
          {!packages.length ? <Callout tone="info">The price list is empty. Load it first: Documents → Price list.</Callout> : null}
        </div>
      ) : null}

      {part === 'notes' ? (
        <div className="stack">
          <Toggle id="rc-p-notes" checked={s.parts.notes} onChange={(v) => set({ parts: { ...s.parts, notes: v } })} label="Include notes & terms" />
          {text('notes', 'Notes & terms (one per line)', 7)}
        </div>
      ) : null}
    </Dialog>
  );
}
