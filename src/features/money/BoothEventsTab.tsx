import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileUp, RefreshCw, Store } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, PageHeader, Stat } from '../../components/ui';
import { Field, Select } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { useJobs, useMembers } from '../../hooks/data';
import { peso, sum } from '../../lib/money';
import { fmtDateRange } from '../../lib/time';
import {
  defaultChoices, parsePosFile, payMethodFor, personKey, planEventImport, planOrderImport, posImportState, posJobId, posKey,
  type PeopleChoices, type PosEventFeed, type PosFeed, type PosImportState, type PosOrderFeed,
} from '../../domain/posFeed';
import { applyEventImport, applyOrderImport, expenseChoices, orderDesigner, readDevicePosFeeds, rememberedPeople } from '../../services/importPos';

const STATE_BADGE: Record<PosImportState, { tone: 'outline' | 'good' | 'warn'; label: string }> = {
  new: { tone: 'outline', label: 'Not in Studio' },
  current: { tone: 'good', label: 'In Studio' },
  changed: { tone: 'warn', label: 'Changed in the POS' },
};

const ORDER_LABEL: Record<PosOrderFeed['status'], string> = { new: 'New', 'in-progress': 'Being made', ready: 'Ready', 'picked-up': 'Picked up', cancelled: 'Cancelled' };

/** Money → Booth events: sales from JoshWorks POS, added as jobs. */
export function BoothEventsTab() {
  const app = useApp();
  const navigate = useNavigate();
  const jobs = useJobs();
  const [device, setDevice] = useState<{ found: boolean; feeds: PosFeed[] } | null>(null);
  const [fromFile, setFromFile] = useState<PosFeed[]>([]);
  const [importing, setImporting] = useState<PosFeed | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => setDevice(await readDevicePosFeeds()), []);
  useEffect(() => {
    void load();
    // Coming back from the POS tab picks up what was just sent.
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const feeds = useMemo(() => {
    const m = new Map<string, PosFeed>();
    for (const f of device?.feeds ?? []) m.set(posKey(f), f);
    for (const f of fromFile) m.set(posKey(f), f);
    return [...m.values()];
  }, [device, fromFile]);
  if (!jobs || !device) return null;
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const stateOf = (f: PosFeed) => posImportState(f, jobById.get(posJobId(f)));
  const events = feeds.filter((f): f is PosEventFeed => f.type === 'event').sort((a, b) => b.startDate.localeCompare(a.startDate));
  const orders = feeds.filter((f): f is PosOrderFeed => f.type === 'order').sort((a, b) => b.createdAt - a.createdAt);

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const got = parsePosFile(await file.text());
      setFromFile((cur) => [...cur.filter((f) => !got.some((g) => posKey(g) === posKey(f))), ...got]);
      app.toast(got.length ? `Opened ${got.length} from the POS file` : 'Nothing to add in that file', { tone: got.length ? 'good' : 'info' });
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Couldn’t open that file', { tone: 'bad' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const action = (f: PosFeed) => {
    const s = stateOf(f);
    return s === 'current' ? (
      <Button size="sm" onClick={() => navigate(`/jobs?job=${posJobId(f)}`)}>
        Open the job
      </Button>
    ) : (
      <Button size="sm" variant={s === 'new' ? 'primary' : undefined} onClick={() => setImporting(f)}>
        {s === 'new' ? 'Add to Studio' : 'Update'}
      </Button>
    );
  };

  return (
    <div className="stack loose">
      <PageHeader
        title="Booth events"
        subtitle="Sales from JoshWorks POS. Each event becomes a Pop-up / Stickers job with its payments, the team’s earnings, payouts already made and the booth costs."
        actions={
          <>
            <Button onClick={() => void load()}>
              <RefreshCw size={18} /> Check again
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <FileUp size={18} /> Open a POS file
            </Button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="POS file" onChange={(e) => void openFile(e.target.files?.[0])} />
          </>
        }
      />
      {!feeds.length ? (
        <EmptyState icon={<Store size={44} />} title="Nothing from the POS yet">
          In JoshWorks POS on this device, open the event, then Report → <b>Send to Studio</b>; it shows up here. From another phone or laptop, use <b>Download Studio file</b> there and{' '}
          <b>Open a POS file</b> here.
        </EmptyState>
      ) : null}

      {events.length ? (
        <section className="stack">
          <h2>Events</h2>
          <div className="table-wrap">
            <table className="table cards-on-phone">
              <thead>
                <tr>
                  <th>Event</th>
                  <th className="r">Sales</th>
                  <th className="r">Team</th>
                  <th>In Studio</th>
                  <th className="r">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((f) => {
                  const s = STATE_BADGE[stateOf(f)];
                  return (
                    <tr key={posKey(f)}>
                      <td data-label="Event">
                        <b>{f.name}</b>
                        <div className="muted small">
                          {fmtDateRange(f.startDate, f.endDate)}
                          {f.venue ? ` · ${f.venue}` : ''}
                        </div>
                      </td>
                      <td className="r" data-label="Sales">
                        {peso(f.gross)}
                      </td>
                      <td className="r" data-label="Team">
                        {peso(sum(f.people.filter((p) => p.kind !== 'partner').map((p) => p.amount)))}
                      </td>
                      <td data-label="In Studio">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="r">{action(f)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {orders.length ? (
        <section className="stack">
          <h2>Commission orders</h2>
          <div className="table-wrap">
            <table className="table cards-on-phone">
              <thead>
                <tr>
                  <th>Order</th>
                  <th className="r">Price</th>
                  <th>Status</th>
                  <th>In Studio</th>
                  <th className="r">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((f) => {
                  const s = STATE_BADGE[stateOf(f)];
                  return (
                    <tr key={posKey(f)}>
                      <td data-label="Order">
                        <b>
                          {f.number} · {f.customer.name || 'No name'}
                        </b>
                        <div className="muted small">{f.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</div>
                      </td>
                      <td className="r" data-label="Price">
                        {peso(f.total)}
                      </td>
                      <td data-label="Status">{ORDER_LABEL[f.status] ?? f.status}</td>
                      <td data-label="In Studio">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="r">{action(f)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {importing?.type === 'event' ? <EventDialog feed={importing} update={stateOf(importing) !== 'new'} onClose={() => setImporting(null)} /> : null}
      {importing?.type === 'order' ? <OrderDialog feed={importing} update={stateOf(importing) !== 'new'} onClose={() => setImporting(null)} /> : null}
    </div>
  );
}

function EventDialog({ feed, update, onClose }: { feed: PosEventFeed; update: boolean; onClose: () => void }) {
  const app = useApp();
  const members = useMembers();
  const [choices, setChoices] = useState<PeopleChoices | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!members || choices) return;
    void (async () => {
      const base = defaultChoices(feed, members, rememberedPeople());
      for (const k of await expenseChoices(feed)) base[k] = 'expense';
      setChoices(base);
    })();
  }, [members, feed, choices]);
  const plan = useMemo(() => (choices ? planEventImport(feed, choices) : null), [feed, choices]);

  const save = async () => {
    if (!choices) return;
    setBusy(true);
    try {
      const r = await applyEventImport(feed, choices);
      app.toast(r.created ? `${feed.name} added to Studio` : `${feed.name} updated`, { tone: 'good' });
      onClose();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Couldn’t add it', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const notes: string[] = [...(plan?.warnings ?? [])];
  if (feed.status === 'planning' || feed.status === 'live') notes.push('The event is still open in the POS. Send it again after it closes, then update it here.');
  if (feed.cogsMissing) notes.push(`${feed.cogsMissing} product${feed.cogsMissing === 1 ? '' : 's'} sold with no production cost in the POS, so production cost is low.`);
  if (feed.depositsHeld) notes.push(`${peso(feed.depositsHeld)} in order deposits is held for pickups. It comes over with each order.`);

  return (
    <Dialog
      open
      onClose={onClose}
      title={update ? `Update ${feed.name} in Studio` : `Add ${feed.name} to Studio`}
      size="wide"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || !plan} onClick={save}>
            {update ? 'Update the job' : 'Add to Studio'}
          </Button>
        </>
      }
    >
      {!plan || !members ? null : (
        <div className="stack">
          <div className="grid-2">
            <Stat label="Sales" value={peso(feed.gross)} hint={`${feed.transactions} sales, ${feed.itemsSold} items`} />
            <Stat label="Studio keeps" value={peso(plan.studioKeeps)} hint="Sales less the team’s shares and the costs below" />
          </div>
          {notes.length ? (
            <Callout tone="warn">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Callout>
          ) : null}

          <h3>Payments</h3>
          <ul className="pos-lines">
            {feed.methods.map((m) => (
              <li key={m.methodId} className="row between">
                <span>
                  {m.name} <span className="muted small">→ {payMethodFor(m)}</span>
                </span>
                <b>{peso(m.amount)}</b>
              </li>
            ))}
          </ul>

          <h3>Team</h3>
          <p className="muted small">Each person’s pay becomes their share of this job, so it shows in their earnings and payouts. Anyone not on the Studio team is recorded as an expense.</p>
          {feed.people.length ? (
            <div className="stack">
              {feed.people.map((p) => (
                <div key={personKey(p)} className="row between wrap" style={{ gap: 8 }}>
                  <span>
                    <b>{p.name}</b>
                    <span className="muted small">
                      {' '}
                      · {p.kind === 'royalty' ? 'Design royalty' : p.role} · {peso(p.amount)}
                      {p.paid ? `, ${peso(p.paid)} paid` : ''}
                    </span>
                  </span>
                  {p.kind === 'partner' ? (
                    <span className="muted small">Expense (partner share)</span>
                  ) : (
                    <Select aria-label={`Who is ${p.name} (${p.kind === 'royalty' ? 'royalty' : 'staff'})`} value={choices?.[personKey(p)] ?? 'expense'} onChange={(e) => setChoices({ ...(choices ?? {}), [personKey(p)]: e.target.value })}>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                        <option value="expense">Not on the team: record as an expense</option>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No one on the roster.</p>
          )}

          <h3>Expenses</h3>
          {plan.expenses.length ? (
            <ul className="pos-lines">
              {plan.expenses.map((x) => (
                <li key={x.id} className="row between">
                  <span>
                    {x.note.replace(`, ${feed.name}`, '')} <span className="muted small">· {x.category}</span>
                  </span>
                  <b>{peso(x.amount)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No costs recorded.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function OrderDialog({ feed, update, onClose }: { feed: PosOrderFeed; update: boolean; onClose: () => void }) {
  const app = useApp();
  const members = useMembers();
  const [designer, setDesigner] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void orderDesigner(feed).then((d) => setDesigner(d ?? ''));
  }, [feed]);
  const plan = planOrderImport(feed);
  const paid = sum(feed.payments.map((p) => p.amount));

  const save = async () => {
    setBusy(true);
    try {
      const r = await applyOrderImport(feed, designer || null);
      app.toast(r.created ? `${feed.number} added as a job` : `${feed.number} updated`, { tone: 'good' });
      onClose();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Couldn’t add it', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={update ? `Update order ${feed.number}` : `Add order ${feed.number} as a job`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || designer === undefined} onClick={save}>
            {update ? 'Update the job' : 'Add to Studio'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>
          <b>{plan.title}</b> for <b>{feed.customer.name || 'a customer'}</b>
          {feed.eventName ? <span className="muted"> · taken at {feed.eventName}</span> : null}
        </p>
        <div className="grid-2">
          <Stat label="Price" value={peso(feed.total)} />
          <Stat label="Paid so far" value={peso(paid)} hint={paid < feed.total ? `${peso(feed.total - paid)} due at pickup` : 'Paid in full'} />
        </div>
        <Field label="Who makes it" htmlFor="pos-designer" hint="Set the team split on the job afterwards.">
          <Select id="pos-designer" value={designer ?? ''} onChange={(e) => setDesigner(e.target.value)}>
            <option value="">No one yet</option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="muted small">The customer is added to Clients if they aren’t there yet. Deposits come in as down payments; the balance paid at pickup as the final payment.</p>
      </div>
    </Dialog>
  );
}
