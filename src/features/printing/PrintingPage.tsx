import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Ban, Briefcase, FileDown, Pencil, Plus, Printer, RotateCcw, Settings2, Trash2, UserRound, X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { settingValue } from '../../db/settings';
import { useClients, useJobMoney, useJobs, useMembers, usePayments, useSettingRows } from '../../hooks/data';
import { Dialog } from '../../components/Dialog';
import { Badge, Button, Callout, EmptyState, IconButton, Loading, PageHeader, Segmented } from '../../components/ui';
import { Field, MoneyInput, NumberInput, SearchInput, Select, TextArea, TextInput } from '../../components/form';
import { PaymentDialog, type PaymentPreset } from '../money/PaymentDialog';
import {
  DEFAULT_PRINT_RATES, PACK_SIZE_LABEL, PRINT_STAGE_LABEL, blankDelivery, customLine, illustrationLine, illustrationPrice, lineTotal, packLine, peelLine, perSheet, printStage, printTotals,
  printWarnings, sheetsLine, sizeName, type PrintStage,
} from '../../domain/print';
import { approvePrint, markProofSent, readDevicePosRates, savePrintOrder, savePrintRates, setPrintStage } from '../../services/print';
import { checkCouponForJob } from '../../services/posCoupons';
import { StickerSizeFields, blankSizePick, pickedSize, type SizePick } from './StickerSize';
import { peso, sum, type Cents } from '../../lib/money';
import { fmtDateTime, fmtIsoDate, todayISO } from '../../lib/time';
import { safeFileName } from '../../lib/files';
import type { CutArea, IllustrationTier, JobMoney, JobView, PackSize, Payment, PrintDelivery, PrintJob, PrintLine, PrintRates } from '../../db/types';
import './printing.css';

/** One print order on the page: its job, the order, where it is and what's paid. */
interface Order {
  job: JobView;
  money: JobMoney;
  print: PrintJob;
  stage: PrintStage;
  total: Cents;
  paid: Cents;
  balance: Cents;
  down: Cents;
  payments: Payment[];
}

const COLUMNS: { stage: Exclude<PrintStage, 'done' | 'cancelled'>; hint: string }[] = [
  { stage: 'quote', hint: 'Files, proof, and the down payment' },
  { stage: 'making', hint: 'Approved and paid down' },
  { stage: 'ready', hint: 'Waiting for pickup or the courier' },
];

const digits = (s: string) => s.replace(/\D+/g, '');

/** Money → Sticker printing: orders that don't come from a booth event, from quote to pickup or courier. */
export default function PrintingPage() {
  const app = useApp();
  const jobs = useJobs();
  const moneyById = useJobMoney();
  const allPayments = usePayments();
  const members = useMembers();
  const rows = useSettingRows();
  const rates = settingValue(rows, 'printRates');
  const business = settingValue(rows, 'business');
  const payMethods = settingValue(rows, 'payMethods');
  const [editing, setEditing] = useState<Order | 'new' | null>(null);
  const [paying, setPaying] = useState<PaymentPreset | null>(null);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  // Deep links: /printing?new=1, /printing?order=<job id> (from the job's Money tab).
  const wanted = params.get('order');
  useEffect(() => {
    if (params.get('new')) {
      setEditing('new');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const memberName = useMemo(() => new Map((members ?? []).map((m) => [m.id, m.name])), [members]);
  const orders = useMemo<Order[]>(() => {
    if (!jobs || !moneyById || !allPayments) return [];
    const byJob = new Map<string, Payment[]>();
    for (const p of allPayments) if (p.jobId) byJob.set(p.jobId, [...(byJob.get(p.jobId) ?? []), p]);
    return jobs.flatMap((job) => {
      const money = moneyById.get(job.id);
      if (!money?.print) return [];
      const payments = byJob.get(job.id) ?? [];
      const paid = sum(payments.map((p) => p.amount));
      const t = printTotals(money.print, money.discountAmount);
      return [{ job, money, print: money.print, stage: printStage(job.status, money.print), total: money.total, paid, balance: Math.max(0, money.total - paid), down: t.down, payments }];
    });
  }, [jobs, moneyById, allPayments]);

  useEffect(() => {
    if (!wanted || !orders.length) return;
    const o = orders.find((x) => x.job.id === wanted);
    if (o) setEditing(o);
    setParams({}, { replace: true });
  }, [wanted, orders, setParams]);

  if (!jobs || !moneyById || !allPayments || !members) return <Loading />;
  const q = query.trim().toLowerCase();
  const matches = (o: Order) =>
    !q ||
    o.job.number.toLowerCase().includes(q) ||
    o.job.clientName.toLowerCase().includes(q) ||
    o.print.designNo.toLowerCase().includes(q) ||
    o.print.lines.some((l) => l.label.toLowerCase().includes(q)) ||
    (digits(q).length >= 3 && digits(o.print.contact).includes(digits(q)));
  const shown = orders.filter(matches);
  const open = shown.filter((o) => o.stage !== 'done' && o.stage !== 'cancelled');
  const closed = shown.filter((o) => o.stage === 'done' || o.stage === 'cancelled').slice(0, 60);

  const act = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
      app.toast(label, { tone: 'good' });
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Couldn’t do that', { tone: 'bad' });
    }
  };
  const pay = (o: Order) =>
    setPaying({
      jobId: o.job.id,
      clientId: o.job.clientId,
      amount: o.paid < o.down ? o.down - o.paid : o.balance,
      kind: o.paid === 0 ? (o.down >= o.total ? 'full' : 'down') : 'final',
    });
  const startMaking = async (o: Order) => {
    if (o.paid < o.down && !(await app.confirm({ title: `Make ${o.job.number} without the down payment?`, message: `The rate sheet says we print once the ${o.print.downPct}% down payment (${peso(o.down)}) is in.`, confirmLabel: 'Make it anyway' }))) return;
    await act(`${o.job.number} is being made`, () => setPrintStage(o.job.id, 'making'));
  };
  const handOver = async (o: Order) => {
    if (o.balance > 0) {
      app.toast(`Record the balance first: ${peso(o.balance)}.`);
      pay(o);
      return;
    }
    await act(`${o.job.number} ${o.print.delivery.method === 'courier' ? 'shipped' : 'picked up'}`, () => setPrintStage(o.job.id, 'done'));
  };
  const cancel = async (o: Order) => {
    const ok = await app.confirm({
      title: `Cancel ${o.job.number}?`,
      message: o.paid ? `${peso(o.paid)} has been paid on it. The payments stay on the job; refund the customer yourself if you need to.` : 'It moves to Done and cancelled, and its job is marked Cancelled.',
      confirmLabel: 'Cancel the order',
      tone: 'danger',
    });
    if (ok) await act(`${o.job.number} cancelled`, () => setPrintStage(o.job.id, 'cancelled'));
  };
  const pdf = async (o: Order) => {
    const { buildPrintQuotePdf } = await import('../../reports/studioDocs');
    const { deliverPdf } = await import('../../reports/pdf');
    await deliverPdf(
      await buildPrintQuotePdf(o.print, o.money.discountAmount, { business, payMethods, rates, number: o.job.number, clientName: o.job.clientName, date: o.job.startDate || todayISO(), dueDate: o.job.dueDate, paid: o.paid }),
      `${o.job.number} - ${safeFileName(o.job.clientName || 'customer')} - sticker printing.pdf`,
    );
  };

  return (
    <div className="page wide">
      <PageHeader
        title="Sticker printing"
        subtitle={`For customers who order outside a booth event: quote and proof, ${rates.downPct}% down, make it, then pickup or courier. Each order is a Sticker Printing job, so payments, the printer's and illustrator's shares, and payouts are all here in Studio.`}
        actions={
          <>
            <Button onClick={() => setRatesOpen(true)}>
              <Settings2 size={18} /> Rate card
            </Button>
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus size={18} /> New service order
            </Button>
          </>
        }
      />
      <div className="row wrap print-tools">
        <div className="grow print-find">
          <SearchInput value={query} onChange={setQuery} placeholder="Find an order: number, name, design no. or phone" ariaLabel="Find an order" />
        </div>
        <span className="muted small">Orders taken at events stay in JoshWorks POS → Services and come in through Money → Booth events.</span>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={<Printer size={44} />} title="No sticker printing orders yet">
          When someone messages for stickers, labels or peel-off packs, price it here from the rate card and send them the quote.
        </EmptyState>
      ) : (
        <div className="print-board">
          {COLUMNS.map((col) => {
            const list = open.filter((o) => o.stage === col.stage);
            return (
              <section key={col.stage} className="print-col" aria-label={PRINT_STAGE_LABEL[col.stage]}>
                <div className="print-col-head">
                  <b>{PRINT_STAGE_LABEL[col.stage]}</b>
                  <Badge>{list.length}</Badge>
                </div>
                <p className="muted tiny">{col.hint}</p>
                {list.map((o) => (
                  <PrintCard
                    key={o.job.id}
                    order={o}
                    printer={o.print.printerId ? memberName.get(o.print.printerId) : undefined}
                    onEdit={() => setEditing(o)}
                    onPdf={() => void pdf(o)}
                    onCancel={() => void cancel(o)}
                    onPay={() => pay(o)}
                    onProof={() => void act('Proof marked as sent', () => markProofSent(o.job.id))}
                    onApprove={() => void act('Approved', async () => app.toast(`Ready by ${fmtIsoDate(await approvePrint(o.job.id))}`))}
                    onMake={() => void startMaking(o)}
                    onReady={() => void act(`${o.job.number} is ready`, () => setPrintStage(o.job.id, 'ready'))}
                    onHandOver={() => void handOver(o)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {closed.length ? (
        <details className="card">
          <summary className="strong">Done and cancelled ({closed.length})</summary>
          <div className="list" style={{ marginTop: 8 }}>
            {closed.map((o) => (
              <div key={o.job.id} className="list-item print-closed">
                <b className="mono">{o.job.number}</b>
                <span className="main-text grow">
                  <b>{o.job.clientName}</b>
                  <span className="muted small"> · {o.print.lines.map((l) => l.label).join(', ')}</span>
                </span>
                <Badge tone={o.stage === 'done' ? 'good' : undefined}>{o.stage === 'done' ? (o.print.delivery.method === 'courier' ? 'Shipped' : 'Picked up') : 'Cancelled'}</Badge>
                {o.print.doneAt ? <span className="muted tiny nowrap">{fmtDateTime(o.print.doneAt)}</span> : null}
                <span className="row print-closed-actions">
                  <IconButton label={`Quote slip for ${o.job.number}`} size="sm" plain onClick={() => void pdf(o)}>
                    <FileDown size={15} />
                  </IconButton>
                  <IconButton label={`Edit ${o.job.number}`} size="sm" plain onClick={() => setEditing(o)}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton label={`Reopen ${o.job.number}`} size="sm" plain onClick={() => void act(`${o.job.number} reopened`, () => setPrintStage(o.job.id, o.stage === 'done' ? 'ready' : 'quote'))}>
                    <RotateCcw size={15} />
                  </IconButton>
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {editing ? <PrintOrderDialog order={editing} rates={rates} onClose={() => setEditing(null)} /> : null}
      <PaymentDialog open={!!paying} preset={paying ?? undefined} onClose={() => setPaying(null)} />
      {ratesOpen ? <RateCardDialog rates={rates} canSave={app.role === 'owner'} onClose={() => setRatesOpen(false)} /> : null}
    </div>
  );
}

function PrintCard(p: {
  order: Order;
  printer?: string;
  onEdit: () => void;
  onPdf: () => void;
  onCancel: () => void;
  onPay: () => void;
  onProof: () => void;
  onApprove: () => void;
  onMake: () => void;
  onReady: () => void;
  onHandOver: () => void;
}) {
  const { job, print, stage } = p.order;
  const late = !!job.dueDate && stage !== 'ready' && job.dueDate < todayISO();
  return (
    <article className="print-card" aria-label={`Sticker printing ${job.number}`}>
      <div className="row between top">
        <div>
          <div className="print-no">{job.number}</div>
          <div className="strong">{job.clientName}</div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <IconButton label={`Quote slip for ${job.number}`} size="sm" plain onClick={p.onPdf}>
            <FileDown size={15} />
          </IconButton>
          <IconButton label={`Edit ${job.number}`} size="sm" plain onClick={p.onEdit}>
            <Pencil size={15} />
          </IconButton>
          <Link className="icon-btn sm plain" to={`/jobs?job=${job.id}`} aria-label={`Open job ${job.number}`} title="Open the job">
            <Briefcase size={15} />
          </Link>
          <IconButton label={`Cancel ${job.number}`} size="sm" plain onClick={p.onCancel}>
            <Ban size={15} />
          </IconButton>
        </div>
      </div>
      <ul className="print-lines">
        {print.lines.map((l, i) => (
          <li key={i}>
            {l.qty} × {l.label}
          </li>
        ))}
      </ul>
      <div className="row wrap" style={{ gap: 6 }}>
        {stage === 'quote' ? <Badge tone={print.approvedAt ? 'good' : print.proofAt ? 'teal' : undefined}>{print.approvedAt ? 'Approved' : print.proofAt ? 'Proof sent' : 'Quote'}</Badge> : null}
        {job.dueDate ? <Badge tone={late ? 'warn' : undefined}>Ready by {fmtIsoDate(job.dueDate)}</Badge> : null}
        {print.delivery.method === 'courier' ? <Badge>Courier{print.delivery.courier ? `: ${print.delivery.courier}` : ''}</Badge> : null}
        {p.printer ? <Badge tone="teal">{p.printer}</Badge> : null}
        {print.designNo ? <Badge>{print.designNo}</Badge> : null}
        {p.order.money.couponCode ? <Badge tone="yellow">Coupon {p.order.money.couponCode}</Badge> : null}
      </div>
      <div className="row between small">
        <span className="muted">
          {peso(p.order.total)}
          {p.order.paid ? ` · ${peso(p.order.paid)} paid` : ' · no payment yet'}
        </span>
        <b className={p.order.balance ? '' : 'good'}>{p.order.balance ? `${peso(p.order.balance)} due` : 'Paid'}</b>
      </div>
      {stage === 'quote' && p.order.paid < p.order.down ? <p className="muted tiny">Down payment to start: {peso(p.order.down)}</p> : null}
      <div className="print-actions">
        {stage === 'quote' ? (
          <>
            {!print.proofAt ? (
              <Button size="sm" onClick={p.onProof}>
                Proof sent
              </Button>
            ) : null}
            {!print.approvedAt ? (
              <Button size="sm" onClick={p.onApprove}>
                Approved
              </Button>
            ) : null}
            {p.order.balance ? (
              <Button size="sm" onClick={p.onPay}>
                Payment
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={p.onMake}>
              Start making
            </Button>
          </>
        ) : stage === 'making' ? (
          <>
            {p.order.balance ? (
              <Button size="sm" onClick={p.onPay}>
                Payment
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={p.onReady}>
              Ready
            </Button>
          </>
        ) : (
          <>
            {p.order.balance ? (
              <Button size="sm" onClick={p.onPay}>
                Payment
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={p.onHandOver}>
              {print.delivery.method === 'courier' ? 'Shipped' : 'Picked up'}
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

type LineKind = PrintLine['kind'];

function PrintOrderDialog({ order, rates, onClose }: { order: Order | 'new'; rates: PrintRates; onClose: () => void }) {
  const app = useApp();
  const members = useMembers();
  const clients = useClients();
  const isNew = order === 'new';
  const o = isNew ? null : order;
  const [clientId, setClientId] = useState<string | null>(o?.job.clientId ?? null);
  const [clientName, setClientName] = useState(o?.job.clientName ?? '');
  const [contact, setContact] = useState(o?.print.contact ?? '');
  const [lines, setLines] = useState<PrintLine[]>(o?.print.lines ?? []);
  const [delivery, setDelivery] = useState<PrintDelivery>(o?.print.delivery ?? blankDelivery());
  const [printerId, setPrinterId] = useState(o?.print.printerId ?? '');
  const [printerPct, setPrinterPct] = useState<number | null>(o?.print.printerPct ?? rates.printerPct);
  const [illustratorId, setIllustratorId] = useState(o?.print.illustratorId ?? '');
  const [illustratorPct, setIllustratorPct] = useState<number | null>(o?.print.illustratorPct ?? rates.illustration.artistPct);
  const [designNo, setDesignNo] = useState(o?.print.designNo ?? '');
  const [files, setFiles] = useState(o?.print.files ?? '');
  const [notes, setNotes] = useState(o?.print.notes ?? '');
  const [coupon, setCoupon] = useState<{ code: string; couponId: string; discount: Cents } | null>(
    o?.money.couponCode && o.money.couponId ? { code: o.money.couponCode, couponId: o.money.couponId, discount: o.money.discountAmount } : null,
  );
  const [couponTyped, setCouponTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // The line being built
  const [kind, setKind] = useState<LineKind>('sheets');
  const [material, setMaterial] = useState(rates.materials[1]?.key ?? rates.materials[0]?.key ?? '');
  const [cut, setCut] = useState('kiss');
  const [sizePick, setSizePick] = useState<SizePick>(blankSizePick());
  const [sheets, setSheets] = useState<number | null>(rates.minSheets);
  const [peelSize, setPeelSize] = useState(rates.peelSizes[0]?.key ?? '');
  const [peelCount, setPeelCount] = useState<number | null>(20);
  const [pack, setPack] = useState(rates.packs[0]?.key ?? '');
  const [packSize, setPackSize] = useState<PackSize>('small');
  const [packs, setPacks] = useState<number | null>(rates.minPacks);
  const [customLabel, setCustomLabel] = useState('');
  const [customQty, setCustomQty] = useState<number | null>(1);
  const [customPrice, setCustomPrice] = useState<Cents | null>(null);
  const [tier, setTier] = useState(rates.illustration.tiers[0]?.key ?? '');
  const [designs, setDesigns] = useState<number | null>(1);
  const [artPrice, setArtPrice] = useState<Cents | null>(null);

  const closed = !!o && (o.stage === 'done' || o.stage === 'cancelled');
  const draft = { lines, delivery, printerPct: printerPct ?? 0, illustratorPct: illustratorPct ?? 0, downPct: o?.print.downPct ?? rates.downPct };
  const subtotal = sum(lines.map(lineTotal));
  // A coupon is worth no more than the work it comes off.
  const t = printTotals(draft, Math.min(coupon?.discount ?? 0, subtotal));
  const warnings = printWarnings({ lines }, rates);
  const size = pickedSize(rates, sizePick);
  const preview: PrintLine | null =
    kind === 'sheets' && (sizePick.by === 'stickers' && size ? (sizePick.stickers ?? 0) > 0 : !!sheets)
      ? sheetsLine(rates, material, cut, sheets ?? 0, size ?? undefined, sizePick.by === 'stickers' ? (sizePick.stickers ?? 0) : undefined)
      : kind === 'peel' && peelCount
        ? peelLine(rates, material, peelSize, peelCount)
        : kind === 'pack' && packs
          ? packLine(rates, pack, packSize, packs)
          : kind === 'custom' && customLabel.trim() && customQty && customPrice !== null
            ? customLine(customLabel.trim(), customQty, customPrice)
            : kind === 'illustration' && designs
              ? illustrationLine(rates, tier, designs, artPrice ?? undefined)
              : null;
  const artTier = rates.illustration.tiers.find((x) => x.key === tier);
  const artRate = artTier && designs ? illustrationPrice(artTier, designs) : null;
  const hasArt = lines.some((l) => l.kind === 'illustration') || !!illustratorId;
  const client = clientId ? (clients ?? []).find((c) => c.id === clientId) : null;
  const active = (members ?? []).filter((m) => m.active === 1);

  const applyCoupon = async () => {
    const r = await checkCouponForJob(couponTyped, subtotal, o?.job.id ?? 'new');
    if (!r.ok) return app.toast(r.reason, { tone: 'bad' });
    setCoupon({ code: r.code, couponId: r.couponId, discount: r.discount });
    setCouponTyped('');
    app.toast(`${r.code}: ${peso(r.discount)} off`, { tone: 'good' });
  };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      // The price may have changed since the coupon went on: check it again (when the POS is on this device).
      let c = coupon;
      if (c) {
        const r = await checkCouponForJob(c.code, subtotal, o?.job.id ?? 'new');
        if (r.ok) c = { ...c, discount: r.discount };
        else if (!r.offline) throw new Error(`Coupon ${c.code}: ${r.reason}`);
      }
      const res = await savePrintOrder(o?.job.id ?? null, {
        clientId,
        clientName: client?.name ?? clientName,
        contact: contact || client?.phone || client?.email || '',
        lines,
        delivery,
        printerId: printerId || null,
        printerPct: printerPct ?? rates.printerPct,
        illustratorId: illustratorId || null,
        illustratorPct: illustratorPct ?? rates.illustration.artistPct,
        designNo,
        files,
        notes,
        coupon: c ? { ...c, discount: Math.min(c.discount, subtotal) } : null,
      });
      app.toast(res.created ? `Order ${res.number} saved as a Sticker Printing job` : 'Saved', { tone: 'good' });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save it');
    } finally {
      setBusy(false);
    }
  };

  const groups = ['Standard', 'Premium', 'Paper'] as const;
  const materialSelect = (
    <Select id="pr-material" value={material} onChange={(e) => setMaterial(e.target.value)}>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {rates.materials
            .filter((m) => m.group === g)
            .map((m) => (
              <option key={m.key} value={m.key}>
                {m.name} · {peso(m.price)}/sheet
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? 'New service order' : `Edit ${o!.job.number}`}
      size="wide"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {isNew ? 'Save service order' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="stack tight">
        <span className="label strong small">Customer</span>
        {client ? (
          <div className="row">
            <UserRound size={18} />
            <b className="grow">{client.name}</b>
            <IconButton label="Choose a different customer" size="sm" onClick={() => setClientId(null)}>
              <X size={16} />
            </IconButton>
          </div>
        ) : (
          <div className="form-grid">
            <Field label="Name" htmlFor="pr-name">
              <TextInput id="pr-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Who it’s for" />
            </Field>
            <Field label="Saved client" htmlFor="pr-client" hint="Or a new client is added with the name.">
              <Select id="pr-client" value="" onChange={(e) => setClientId(e.target.value || null)}>
                <option value="">Pick a saved client…</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Mobile, email or @handle" htmlFor="pr-contact">
          <TextInput id="pr-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={client ? client.phone || client.email || '' : ''} />
        </Field>
      </div>

      <div className="stack tight">
        <span className="label strong small">What to make</span>
        {lines.length ? (
          <div className="list card flush">
            {lines.map((l, i) => (
              <div key={i} className="list-item">
                <span className="main-text grow">
                  <b>{l.label}</b>
                  <span className="muted small">
                    {' '}
                    · {l.qty} × {peso(l.unitPrice, { decimals: 2 })}
                    {l.a4 ? ` · ${l.a4} A4 sheet${l.a4 === 1 ? '' : 's'}` : ''}
                  </span>
                </span>
                <b>{peso(lineTotal(l))}</b>
                {!closed ? (
                  <IconButton label={`Remove ${l.label}`} size="sm" onClick={() => setLines(lines.filter((_, k) => k !== i))}>
                    <Trash2 size={15} />
                  </IconButton>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">Nothing yet. Add sticker sheets, peel-off sheets, packaging or illustration below.</p>
        )}
        {closed ? (
          <p className="muted small">A closed order keeps what was made and its price; the rest can still be fixed.</p>
        ) : (
          <>
            <div className="card soft stack tight">
              <Segmented
                label="Add"
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'sheets', label: 'Sticker sheets' },
                  { value: 'peel', label: 'Peel-off sheets' },
                  { value: 'pack', label: 'Packaging' },
                  { value: 'illustration', label: 'Illustration' },
                  { value: 'custom', label: 'Other' },
                ]}
              />
              <div className="form-grid">
                {kind === 'sheets' ? (
                  <>
                    <Field label="Material" htmlFor="pr-material">
                      {materialSelect}
                    </Field>
                    <Field label="Cut" htmlFor="pr-cut">
                      <Select id="pr-cut" value={cut} onChange={(e) => setCut(e.target.value)}>
                        {rates.cuts
                          .filter((c) => c.key !== 'peel')
                          .map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.name}
                              {c.price ? ` +${peso(c.price)}/sheet` : ' (included)'}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <StickerSizeFields rates={rates} pick={sizePick} onPick={setSizePick} sheets={sheets} onSheets={setSheets} idPrefix="pr" />
                  </>
                ) : kind === 'peel' ? (
                  <>
                    <Field label="Material" htmlFor="pr-material">
                      {materialSelect}
                    </Field>
                    <Field label="Peel-off sheet size" htmlFor="pr-peel">
                      <Select id="pr-peel" value={peelSize} onChange={(e) => setPeelSize(e.target.value)}>
                        {rates.peelSizes.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.name} · {s.perA4} per A4
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Peel-off sheets" htmlFor="pr-peel-count">
                      <NumberInput id="pr-peel-count" decimals={false} min={1} value={peelCount} onChange={setPeelCount} />
                    </Field>
                  </>
                ) : kind === 'pack' ? (
                  <>
                    <Field label="Packaging" htmlFor="pr-pack" className="span-2">
                      <Select id="pr-pack" value={pack} onChange={(e) => setPack(e.target.value)}>
                        {rates.packs.map((x) => (
                          <option key={x.key} value={x.key}>
                            {x.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Size" htmlFor="pr-pack-size">
                      <Select id="pr-pack-size" value={packSize} onChange={(e) => setPackSize(e.target.value as PackSize)}>
                        {(['small', 'medium', 'large'] as const).map((s) => (
                          <option key={s} value={s}>
                            {PACK_SIZE_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Packs" htmlFor="pr-packs" hint={`At least ${rates.minPacks} per design.`}>
                      <NumberInput id="pr-packs" decimals={false} min={1} value={packs} onChange={setPacks} />
                    </Field>
                  </>
                ) : kind === 'illustration' ? (
                  <>
                    <Field label="Tier" htmlFor="pr-tier" hint={artTier?.note} className="span-2">
                      <Select id="pr-tier" value={tier} onChange={(e) => setTier(e.target.value)}>
                        {rates.illustration.tiers.map((x) => (
                          <option key={x.key} value={x.key}>
                            {x.name} · {peso(x.price)} a design
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Designs" htmlFor="pr-designs" hint={artTier?.sets.length ? `Sets of ${artTier.sets.map((x) => x.designs).join(', ')} cost less.` : undefined}>
                      <NumberInput id="pr-designs" decimals={false} min={1} value={designs} onChange={setDesigns} />
                    </Field>
                    <Field
                      label="Price"
                      htmlFor="pr-art-price"
                      hint={artRate ? `Rate card: ${peso(artRate.total)}${artRate.saved ? `, a set saving ${peso(artRate.saved)}` : ''}. Type another price for this order.` : undefined}
                    >
                      <MoneyInput id="pr-art-price" value={artPrice ?? artRate?.total ?? null} onChange={setArtPrice} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="What it is" htmlFor="pr-custom" className="span-2">
                      <TextInput id="pr-custom" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Label layout and design, rush fee" />
                    </Field>
                    <Field label="How many" htmlFor="pr-custom-qty">
                      <NumberInput id="pr-custom-qty" decimals={false} min={1} value={customQty} onChange={setCustomQty} />
                    </Field>
                    <Field label="Price each" htmlFor="pr-custom-price">
                      <MoneyInput id="pr-custom-price" value={customPrice} onChange={setCustomPrice} />
                    </Field>
                  </>
                )}
              </div>
              <div className="row between wrap">
                <span className="muted small">{preview ? `${preview.label}: ${preview.qty} × ${peso(preview.unitPrice, { decimals: 2 })} = ${peso(lineTotal(preview))}` : 'Fill in the line to add it.'}</span>
                <Button
                  size="sm"
                  disabled={!preview}
                  onClick={() => {
                    if (!preview) return;
                    setLines([...lines, preview]);
                    if (kind === 'custom') {
                      setCustomLabel('');
                      setCustomPrice(null);
                    }
                    if (kind === 'illustration') setArtPrice(null);
                  }}
                >
                  <Plus size={15} /> Add to the order
                </Button>
              </div>
            </div>
            {warnings.length ? (
              <Callout tone="warn">
                {warnings.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </Callout>
            ) : null}
          </>
        )}
      </div>

      {!closed ? (
        <div className="stack tight">
          <span className="label strong small">Delivery</span>
          <Segmented
            label="Delivery"
            value={delivery.method}
            onChange={(method) => setDelivery({ ...delivery, method })}
            options={[
              { value: 'pickup', label: 'Pick up in Iloilo City' },
              { value: 'courier', label: 'Courier' },
            ]}
          />
          {delivery.method === 'courier' ? (
            <div className="form-grid">
              <Field label="Courier" htmlFor="pr-courier">
                <TextInput id="pr-courier" value={delivery.courier} onChange={(e) => setDelivery({ ...delivery, courier: e.target.value })} placeholder="J&T, LBC, Lalamove…" />
              </Field>
              <Field label="Delivery fee" htmlFor="pr-fee" hint="Added to the order; the studio pays the courier (an expense on the job).">
                <MoneyInput id="pr-fee" value={delivery.fee} onChange={(c) => setDelivery({ ...delivery, fee: c ?? 0 })} />
              </Field>
              <Field label="Address" htmlFor="pr-address" className="span-2">
                <TextArea id="pr-address" rows={2} value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} />
              </Field>
              <Field label="Tracking no." htmlFor="pr-tracking">
                <TextInput id="pr-tracking" value={delivery.tracking} onChange={(e) => setDelivery({ ...delivery, tracking: e.target.value })} />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="form-grid">
        <Field label="Who prints it" htmlFor="pr-printer" hint="Their share goes to their earnings, paid out from Money → Payouts as the customer pays.">
          <Select id="pr-printer" value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
            <option value="">Not set yet</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Printer’s share" htmlFor="pr-pct" hint={`Of the print work${t.discount ? ' after the coupon' : ''}, not the illustration or the delivery fee: ${peso(t.printerShare)}.`}>
          <NumberInput id="pr-pct" min={0} value={printerPct} onChange={setPrinterPct} suffix="%" />
        </Field>
        {hasArt ? (
          <>
            <Field label="Who draws it" htmlFor="pr-artist" hint="Their share of the illustration goes to their earnings.">
              <Select id="pr-artist" value={illustratorId} onChange={(e) => setIllustratorId(e.target.value)}>
                <option value="">Not set yet</option>
                {active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Illustrator’s share" htmlFor="pr-art-pct" hint={`Of the illustration${t.discount ? ' after its part of the coupon' : ''}: ${peso(t.illustratorShare)}.`}>
              <NumberInput id="pr-art-pct" min={0} value={illustratorPct} onChange={setIllustratorPct} suffix="%" />
            </Field>
          </>
        ) : null}
        <Field label="Design no." htmlFor="pr-design" hint="For custom stickers: the number on the design file in Drive, e.g. CS01.">
          <TextInput id="pr-design" value={designNo} onChange={(e) => setDesignNo(e.target.value.toUpperCase())} placeholder="CS01" maxLength={12} />
        </Field>
        <Field label="Files" htmlFor="pr-files" hint="Drive or Messenger link to the designs. It goes on the job for whoever prints it.">
          <TextInput id="pr-files" value={files} onChange={(e) => setFiles(e.target.value)} placeholder="https://drive.google.com/…" />
        </Field>
        <Field label="Notes" htmlFor="pr-notes" className="span-2">
          <TextArea id="pr-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {!closed ? (
          coupon ? (
            <div className="row wrap span-2">
              <Badge tone="yellow">Coupon {coupon.code}</Badge>
              <span className="muted small grow">{peso(Math.min(coupon.discount, subtotal))} off the work, a JoshWorks POS service coupon. Everyone&rsquo;s share is worked out on the price after it.</span>
              <Button size="sm" variant="ghost" onClick={() => setCoupon(null)}>
                Remove
              </Button>
            </div>
          ) : (
            <Field label="Service coupon" htmlFor="pr-coupon" hint="A code from a JoshWorks event, checked against JoshWorks POS on this device." className="span-2">
              <div className="row">
                <TextInput id="pr-coupon" className="grow" value={couponTyped} onChange={(e) => setCouponTyped(e.target.value)} placeholder="e.g. KI26-7F3QX" />
                <Button onClick={() => void applyCoupon()} disabled={!couponTyped.trim() || !lines.length}>
                  Apply
                </Button>
              </div>
            </Field>
          )
        ) : null}
      </div>

      <div className="waterfall card">
        <div className="wf-row">
          <span>Printing, packaging and illustration</span>
          <span className="v">{peso(t.subtotal)}</span>
        </div>
        {t.discount ? (
          <div className="wf-row">
            <span>Coupon {coupon?.code}</span>
            <span className="v">−{peso(t.discount)}</span>
          </div>
        ) : null}
        {t.delivery ? (
          <div className="wf-row">
            <span>Delivery</span>
            <span className="v">{peso(t.delivery)}</span>
          </div>
        ) : null}
        <div className="wf-row total">
          <span>Total</span>
          <span className="v">{peso(t.total)}</span>
        </div>
        {!closed ? (
          <div className="wf-row">
            <span>
              {draft.downPct}% down payment to start{t.a4 ? ` · ${t.a4} A4 sheet${t.a4 === 1 ? '' : 's'} to print` : ''}
            </span>
            <span className="v">{peso(t.down)}</span>
          </div>
        ) : null}
        <div className="wf-row sub">
          <span>Studio keeps, before materials</span>
          <span className="v">{peso(t.total - (printerId ? t.printerShare : 0) - (illustratorId ? t.illustratorShare : 0) - t.delivery)}</span>
        </div>
      </div>
      {error ? <Callout tone="bad">{error}</Callout> : null}
    </Dialog>
  );
}

/** The rate card: the same as the POS's. The owner saves it; managers can look. */
function RateCardDialog({ rates, canSave, onClose }: { rates: PrintRates; canSave: boolean; onClose: () => void }) {
  const app = useApp();
  const [r, setR] = useState<PrintRates>(rates);
  const [posRates, setPosRates] = useState<PrintRates | null>(null);
  useEffect(() => {
    void readDevicePosRates().then(setPosRates);
  }, []);
  const setMat = (i: number, ch: Partial<PrintRates['materials'][number]>) => setR({ ...r, materials: r.materials.map((m, k) => (k === i ? { ...m, ...ch } : m)) });
  const setCut = (i: number, price: Cents) => setR({ ...r, cuts: r.cuts.map((c, k) => (k === i ? { ...c, price } : c)) });
  const setPack = (i: number, s: PackSize, price: Cents) => setR({ ...r, packs: r.packs.map((p, k) => (k === i ? { ...p, [s]: price } : p)) });
  const setTier = (i: number, ch: Partial<IllustrationTier>) => setR({ ...r, illustration: { ...r.illustration, tiers: r.illustration.tiers.map((x, k) => (k === i ? { ...x, ...ch } : x)) } });
  const setTierSet = (i: number, j: number, price: Cents) => setTier(i, { sets: r.illustration.tiers[i].sets.map((x, k) => (k === j ? { ...x, price } : x)) });
  const setSizes = [...new Set(r.illustration.tiers.flatMap((x) => x.sets.map((y) => y.designs)))].sort((a, b) => a - b);
  const save = async () => {
    try {
      await savePrintRates(r);
      app.toast('Rate card saved', { tone: 'good' });
      onClose();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Couldn’t save the rate card', { tone: 'bad' });
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Sticker printing rate card"
      size="xwide"
      footer={
        <>
          {canSave ? (
            <>
              <Button variant="ghost" onClick={() => setR(DEFAULT_PRINT_RATES)}>
                Back to the 2026 rate sheet
              </Button>
              {posRates ? (
                <Button variant="ghost" onClick={() => setR(posRates)}>
                  Use the POS&rsquo;s rate card
                </Button>
              ) : null}
            </>
          ) : null}
          <span className="grow" />
          <Button onClick={onClose}>{canSave ? 'Cancel' : 'Close'}</Button>
          {canSave ? (
            <Button variant="primary" onClick={save}>
              Save rate card
            </Button>
          ) : null}
        </>
      }
    >
      {!canSave ? <Callout>Only the owner changes the rate card.</Callout> : null}
      <p className="muted small">The same rate card as JoshWorks POS → Services. Prices are per A4 sheet with kiss cut. “Cost” is what one sheet costs the studio (paper, laminate, ink); it&rsquo;s booked as the job&rsquo;s materials. Leave it blank if you don&rsquo;t know it yet.</p>
      <fieldset disabled={!canSave} className="plain-fieldset stack">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Material</th>
                <th className="r">Price / sheet</th>
                <th className="r">Cost / sheet</th>
              </tr>
            </thead>
            <tbody>
              {r.materials.map((m, i) => (
                <tr key={m.key}>
                  <td>
                    <b>{m.group}</b> {m.name}
                  </td>
                  <td className="r" style={{ width: 140 }}>
                    <MoneyInput ariaLabel={`Price of ${m.group} ${m.name}`} value={m.price} onChange={(c) => setMat(i, { price: c ?? 0 })} />
                  </td>
                  <td className="r" style={{ width: 140 }}>
                    <MoneyInput ariaLabel={`Cost of ${m.group} ${m.name}`} value={m.cost} onChange={(c) => setMat(i, { cost: c })} placeholder="—" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid-2">
          <div className="stack tight">
            <span className="label strong small">Cutting add-ons (per sheet)</span>
            {r.cuts.map((c, i) => (
              <Field key={c.key} label={c.name} htmlFor={`rc-cut-${c.key}`}>
                <MoneyInput id={`rc-cut-${c.key}`} value={c.price} onChange={(v) => setCut(i, v ?? 0)} />
              </Field>
            ))}
          </div>
          <div className="stack tight">
            <span className="label strong small">Rules</span>
            <div className="form-grid">
              <Field label="Minimum A4 sheets" htmlFor="rc-min">
                <NumberInput id="rc-min" decimals={false} min={1} value={r.minSheets} onChange={(n) => setR({ ...r, minSheets: Math.max(1, n ?? 1) })} />
              </Field>
              <Field label="Minimum packs per design" htmlFor="rc-packs">
                <NumberInput id="rc-packs" decimals={false} min={1} value={r.minPacks} onChange={(n) => setR({ ...r, minPacks: Math.max(1, n ?? 1) })} />
              </Field>
              <Field label="Lead time from" htmlFor="rc-lead-min">
                <NumberInput id="rc-lead-min" decimals={false} min={0} value={r.leadDays.min} onChange={(n) => setR({ ...r, leadDays: { ...r.leadDays, min: n ?? 0 } })} suffix="days" />
              </Field>
              <Field label="to" htmlFor="rc-lead-max">
                <NumberInput id="rc-lead-max" decimals={false} min={0} value={r.leadDays.max} onChange={(n) => setR({ ...r, leadDays: { ...r.leadDays, max: n ?? 0 } })} suffix="days" />
              </Field>
              <Field label="Down payment" htmlFor="rc-down">
                <NumberInput id="rc-down" min={0} value={r.downPct} onChange={(n) => setR({ ...r, downPct: Math.min(100, Math.max(0, n ?? 0)) })} suffix="%" />
              </Field>
              <Field label="Printer’s share" htmlFor="rc-printer" hint="The default for new orders.">
                <NumberInput id="rc-printer" min={0} value={r.printerPct} onChange={(n) => setR({ ...r, printerPct: Math.min(100, Math.max(0, n ?? 0)) })} suffix="%" />
              </Field>
              <Field label="Illustrator’s share" htmlFor="rc-artist" hint="Of the illustration; the default for new orders.">
                <NumberInput id="rc-artist" min={0} value={r.illustration.artistPct} onChange={(n) => setR({ ...r, illustration: { ...r.illustration, artistPct: Math.min(100, Math.max(0, n ?? 0)) } })} suffix="%" />
              </Field>
            </div>
          </div>
        </div>
        <CutAreaFields rates={r} onChange={setR} />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Packaging (per pack)</th>
                <th className="r">Small</th>
                <th className="r">Medium</th>
                <th className="r">Large</th>
              </tr>
            </thead>
            <tbody>
              {r.packs.map((p, i) => (
                <tr key={p.key}>
                  <td>{p.name}</td>
                  {(['small', 'medium', 'large'] as const).map((s) => (
                    <td key={s} className="r" style={{ width: 120 }}>
                      <MoneyInput ariaLabel={`${p.name}, ${s}`} value={p[s]} onChange={(c) => setPack(i, s, c ?? 0)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sticker illustration</th>
                <th className="r">1 design</th>
                {setSizes.map((n) => (
                  <th key={n} className="r">
                    Set of {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.illustration.tiers.map((x, i) => (
                <tr key={x.key}>
                  <td>
                    <b>{x.name}</b>
                    <div className="muted tiny">{x.note}</div>
                  </td>
                  <td className="r" style={{ width: 120 }}>
                    <MoneyInput ariaLabel={`${x.name}, one design`} value={x.price} onChange={(c) => setTier(i, { price: c ?? 0 })} />
                  </td>
                  {setSizes.map((n) => {
                    const j = x.sets.findIndex((y) => y.designs === n);
                    return (
                      <td key={n} className="r" style={{ width: 120 }}>
                        {j >= 0 ? (
                          <>
                            <MoneyInput ariaLabel={`${x.name}, set of ${n}`} value={x.sets[j].price} onChange={(c) => setTierSet(i, j, c ?? 0)} />
                            <div className={`tiny ${x.sets[j].price < n * x.price ? 'muted' : 'bad'}`}>{x.sets[j].price < n * x.price ? `save ${peso(n * x.price - x.sets[j].price)}` : 'no saving'}</div>
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </Dialog>
  );
}

/** The cut area and the size guide; counts are worked out, never typed. */
function CutAreaFields({ rates: r, onChange }: { rates: PrintRates; onChange: (r: PrintRates) => void }) {
  const area = r.cutArea ?? DEFAULT_PRINT_RATES.cutArea;
  const setArea = (ch: Partial<CutArea>) => onChange({ ...r, cutArea: { ...area, ...ch } });
  const setSize = (i: number, ch: { w?: number; h?: number }) =>
    onChange({
      ...r,
      stickerSizes: r.stickerSizes.map((s, k) => {
        if (k !== i) return s;
        const next = { ...s, ...ch };
        return { ...next, name: sizeName(next.w, next.h) };
      }),
    });
  return (
    <div className="grid-2">
      <div className="stack tight">
        <span className="label strong small">Where the cutter cuts</span>
        <p className="muted small">Cricut Print Then Cut prints registration marks around the design, so stickers only fit inside this area of the A4. Cricut&rsquo;s A4 limit is 7.2 × 10.62 in.</p>
        <div className="form-grid">
          <Field label="Cut area width" htmlFor="rc-area-w">
            <NumberInput id="rc-area-w" min={0} value={area.w} onChange={(n) => setArea({ w: Math.max(0, n ?? 0) })} suffix="in" />
          </Field>
          <Field label="Cut area height" htmlFor="rc-area-h">
            <NumberInput id="rc-area-h" min={0} value={area.h} onChange={(n) => setArea({ h: Math.max(0, n ?? 0) })} suffix="in" />
          </Field>
          <Field label="Space between stickers" htmlFor="rc-gap" hint="3 mm for die cut, 5 mm when trimming by hand.">
            <NumberInput id="rc-gap" min={0} value={area.gapMm} onChange={(n) => setArea({ gapMm: Math.max(0, n ?? 0) })} suffix="mm" />
          </Field>
        </div>
      </div>
      <div className="stack tight">
        <span className="label strong small">Size guide</span>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Width</th>
                <th>Height</th>
                <th className="r">Per A4</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {r.stickerSizes.map((s, i) => (
                <tr key={i}>
                  <td style={{ width: 110 }}>
                    <NumberInput ariaLabel={`Width of ${s.name}`} min={0} value={s.w} onChange={(n) => setSize(i, { w: n ?? 0 })} suffix="in" />
                  </td>
                  <td style={{ width: 110 }}>
                    <NumberInput ariaLabel={`Height of ${s.name}`} min={0} value={s.h} onChange={(n) => setSize(i, { h: n ?? 0 })} suffix="in" />
                  </td>
                  <td className="r">{perSheet({ cutArea: area }, s.w, s.h)}</td>
                  <td className="r">
                    <IconButton label={`Remove ${s.name}`} size="sm" plain onClick={() => onChange({ ...r, stickerSizes: r.stickerSizes.filter((_, k) => k !== i) })}>
                      <Trash2 size={15} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button size="sm" onClick={() => onChange({ ...r, stickerSizes: [...r.stickerSizes, { name: sizeName(2, 2), w: 2, h: 2 }] })}>
            <Plus size={15} /> Add a size
          </Button>
        </div>
      </div>
    </div>
  );
}
