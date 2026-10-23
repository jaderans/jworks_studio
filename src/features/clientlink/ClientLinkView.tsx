import { useState } from 'react';
import { CheckCircle2, FileDown, PenLine, Send } from 'lucide-react';
import lockup from '../../assets/brand/lockup-on-light.png';
import { Button, Callout } from '../../components/ui';
import { Check, Field, TextInput } from '../../components/form';
import { QuestionnaireForm } from '../../components/QuestionnaireForm';
import { SignaturePad } from '../../components/SignaturePad';
import { AUTHORITY_STATEMENT } from '../../domain/contractTemplates';
import { fillTemplate } from '../../domain/contract';
import { docTotals } from '../../domain/pricing';
import { applyLinkResponse, type LinkKind, type LinkResponse, type LinkSnapshot } from '../../domain/clientLink';
import { answeredCount } from '../../domain/questionnaire';
import { peso } from '../../lib/money';
import { fmtIsoDate } from '../../lib/time';
import { safeFileName } from '../../lib/files';
import type { BriefAnswer, Contract, Payment } from '../../db/types';

/**
 * What the client sees on their phone: the contract at a glance, the
 * questionnaire, and (for a signing link) the terms, the agreement and a place
 * to sign. The editor's Preview shows the same page.
 */
export function ClientLinkView({ snapshot, kind, onSubmit, preview }: { snapshot: LinkSnapshot; kind: LinkKind; onSubmit: (r: LinkResponse) => Promise<void>; preview?: boolean }) {
  const c = snapshot.contract;
  const tpl = snapshot.template;
  const [answers, setAnswers] = useState<BriefAnswer[]>(c.brief ?? []);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState(c.fields.signer || c.fields['client.contact'] || '');
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState<'' | 'send' | 'pdf'>('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState<LinkResponse | null>(null);
  const totals = docTotals(c.items ?? [], c.discountAmount ?? 0);
  const down = Math.round((totals.net * (c.downPct ?? 50)) / 100);
  const count = answeredCount(tpl.brief, answers);
  const signing = kind === 'sign';
  const title = c.title || tpl.name;

  const pdf = async (contract: Contract) => {
    setBusy('pdf');
    try {
      const [{ buildTemplateContractPdf }, { deliverPdf }] = await Promise.all([import('../../reports/studioDocs'), import('../../reports/pdf')]);
      const doc = await buildTemplateContractPdf(contract, tpl, {
        business: snapshot.business,
        packages: snapshot.packages,
        payMethods: snapshot.payMethods,
        payments: snapshot.payments as Payment[],
        audience: snapshot.audience,
        jobNumber: snapshot.jobNumber,
      });
      await deliverPdf(doc, `${safeFileName(`${c.number} ${c.fields['client.name'] || ''} ${tpl.name}`)}.pdf`);
    } finally {
      setBusy('');
    }
  };

  const submit = async () => {
    setError('');
    if (signing) {
      if (!agreed) return setError('Please tick that you have read and agree to the terms.');
      if (name.trim().length < 2) return setError('Please type your full name.');
      if (!signature) return setError('Please sign in the box.');
    }
    const r: LinkResponse = { answers, device: navigator.userAgent.slice(0, 200), ...(signing ? { agreed: true, name: name.trim(), signature } : {}) };
    setBusy('send');
    try {
      await onSubmit(r);
      setSent(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t go through. Check your connection and try again.');
    } finally {
      setBusy('');
    }
  };

  if (sent)
    return (
      <div className="client-link">
        <img src={lockup} alt="JoshWorks" style={{ height: 44, width: 'auto' }} />
        <section className="card pad-lg stack">
          <h1 className="row" style={{ gap: 10 }}>
            <CheckCircle2 size={28} className="teal" /> {signing ? 'Signed. Thank you!' : 'Thank you!'}
          </h1>
          <p>{signing ? `We’ve received your signed ${title}. We’ll be in touch about the down payment and the start of your project.` : 'We’ve received your answers. They go straight into your project brief.'}</p>
          {signing ? (
            <div>
              <Button variant="primary" disabled={!!busy} onClick={() => pdf(applyLinkResponse(c, kind, sent, Date.now()))}>
                <FileDown size={16} /> {busy === 'pdf' ? 'Making…' : 'Download your signed copy'}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    );

  return (
    <div className="client-link">
      {preview ? <Callout tone="info">Preview: this is what your client sees. Nothing is sent from here.</Callout> : null}
      <div className="brand">
        <img src={lockup} alt="JoshWorks" />
      </div>
      <section className="card pad-lg stack">
        <span className="eyebrow">{signing ? `Contract ${c.number}` : tpl.briefTitle || 'Questionnaire'}</span>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Prepared for <b>{c.fields['client.name'] || 'you'}</b>
          {c.fields.scope ? ` · ${c.fields.scope}` : ''}
        </p>
        {signing ? (
          <>
            <div className="sum">
              <div>
                <span className="tiny muted">Total project cost</span>
                <b>{peso(totals.net)}</b>
              </div>
              <div>
                <span className="tiny muted">Due on signing</span>
                <b>{peso(down)}</b>
              </div>
              <div>
                <span className="tiny muted">Schedule</span>
                <b>{c.fields.startDate ? `${fmtIsoDate(c.fields.startDate)} – ${fmtIsoDate(c.fields.endDate ?? '')}` : 'To be set'}</b>
              </div>
            </div>
            <div>
              <Button disabled={!!busy} onClick={() => pdf(c)}>
                <FileDown size={16} /> {busy === 'pdf' ? 'Making…' : 'Download the full contract (PDF)'}
              </Button>
            </div>
          </>
        ) : (
          <p className="small">Please answer what you can. Most questions are tick boxes; it takes about 10 minutes.</p>
        )}
      </section>

      <section className="card pad-lg stack">
        <h2>{tpl.briefTitle || 'Questionnaire'}</h2>
        <QuestionnaireForm lines={tpl.brief} answers={answers} onChange={setAnswers} idPrefix="cl-q" showEarlier={false} />
      </section>

      {signing ? (
        <>
          <section className="card pad-lg stack">
            <h2>Terms and conditions</h2>
            {c.sections
              .filter((s) => s.on)
              .map((s, i) => (
                <details key={s.id} className="disclosure" open={i === 0}>
                  <summary>
                    <b>
                      {i + 1}. {s.title}
                    </b>
                  </summary>
                  <ul className="small terms">
                    {fillTemplate(s.body, c.fields)
                      .split('\n')
                      .filter(Boolean)
                      .map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                  </ul>
                </details>
              ))}
          </section>
          <section className="card pad-lg stack">
            <h2>Client agreement</h2>
            <ul className="small terms">
              {tpl.agreement.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <Check id="cl-agree" checked={agreed} onChange={setAgreed} label="I have read, understood, and agree to all of the above." sub={AUTHORITY_STATEMENT} />
            <Field label="Your full name" htmlFor="cl-name">
              <TextInput id="cl-name" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </Field>
            <SignaturePad onChange={setSignature} label="Sign here with your finger or mouse" />
            <p className="tiny muted">Electronic signatures are as binding as handwritten ones (RA 8792). Your name, signature, and the date and time are recorded with the contract.</p>
          </section>
        </>
      ) : null}

      {error ? <Callout tone="warn">{error}</Callout> : null}
      <div className="row wrap between">
        <span className="small muted">
          {count.done} of {count.total} questions answered
        </span>
        <Button variant="primary" size="lg" disabled={!!busy} onClick={submit}>
          {signing ? <PenLine size={18} /> : <Send size={18} />} {busy === 'send' ? 'Sending…' : signing ? 'Sign the contract' : 'Send my answers'}
        </Button>
      </div>
    </div>
  );
}
