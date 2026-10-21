import { useState } from 'react';
import { useApp } from '../../app/AppContext';
import { Dialog } from '../../components/Dialog';
import { Button, Segmented } from '../../components/ui';
import { Field, Select, TextArea, TextInput } from '../../components/form';
import { MemberPicker } from '../../components/people';
import { useClients, useMembers } from '../../hooks/data';
import { CLIENT_KINDS, SOURCES } from '../../domain/clients';
import { JOB_TYPES } from '../../domain/jobs';
import { newJob, takeInquiry } from '../../services/jobs';
import { saveClient } from '../../services/clients';
import { todayISO } from '../../lib/time';
import type { ClientKind, JobType } from '../../db/types';

const EMPTY = {
  clientId: '',
  name: '',
  kind: 'business' as ClientKind,
  contact: '',
  phone: '',
  email: '',
  title: '',
  type: 'General' as JobType,
  dueDate: '',
  budget: '',
  source: 'Messenger',
  brief: '',
  designers: [] as string[],
};

/** One form for a new inquiry (from Messenger, a walk-in…) or a confirmed job. */
export function InquiryDialog({ open, kind, clientId, onClose, onCreated }: { open: boolean; kind: 'inquiry' | 'job'; clientId?: string | null; onClose: () => void; onCreated: (jobId: string) => void }) {
  const app = useApp();
  const clients = useClients() ?? [];
  const members = (useMembers() ?? []).filter((m) => m.active === 1);
  const [f, setF] = useState(EMPTY);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [busy, setBusy] = useState(false);
  // Opened from a client: start with that client picked.
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) {
    setSeeded(true);
    if (clientId) {
      setMode('existing');
      setF({ ...EMPTY, clientId });
    }
  }
  if (!open && seeded) setSeeded(false);
  const set = (patch: Partial<typeof EMPTY>) => setF({ ...f, ...patch });
  const close = () => {
    setF(EMPTY);
    onClose();
  };
  const clientOk = mode === 'existing' ? !!f.clientId : !!f.name.trim();
  const create = async () => {
    if (!f.title.trim() || !clientOk) return;
    setBusy(true);
    try {
      let jobId: string;
      if (kind === 'inquiry') {
        const job = await takeInquiry({
          clientId: mode === 'existing' ? f.clientId : null,
          client: mode === 'new' ? { name: f.name.trim(), kind: f.kind, contactName: f.contact, phone: f.phone, email: f.email } : undefined,
          title: f.title.trim(),
          type: f.type,
          dueDate: f.dueDate,
          budgetNote: f.budget,
          source: f.source,
          brief: f.brief,
        });
        jobId = job.id;
        app.toast(`Inquiry ${job.number} added`, { tone: 'good' });
      } else {
        let clientId = mode === 'existing' ? f.clientId : null;
        let clientName = clients.find((c) => c.id === clientId)?.name ?? '';
        if (!clientId) {
          const c = await saveClient({ name: f.name.trim(), kind: f.kind, contactName: f.contact, phone: f.phone, email: f.email, stage: 'booked', source: f.source });
          clientId = c.id;
          clientName = c.name;
        }
        const job = await newJob({ title: f.title.trim(), type: f.type, clientId, clientName, dueDate: f.dueDate, startDate: todayISO(), designers: f.designers, lead: f.designers[0] ?? null, brief: f.brief, source: f.source, budgetNote: f.budget });
        jobId = job.id;
        app.toast(`Job ${job.number} added`, { tone: 'good' });
      }
      close();
      onCreated(jobId);
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not add it', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={kind === 'inquiry' ? 'New inquiry' : 'New job'}
      size="wide"
      fullPhone
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={busy || !f.title.trim() || !clientOk} onClick={create}>
            {kind === 'inquiry' ? 'Add the inquiry' : 'Add the job'}
          </Button>
        </>
      }
    >
      <p className="muted small">
        {kind === 'inquiry'
          ? 'Someone asked about a project. Note what they need; quote them from Documents → Quotes when you’re ready.'
          : 'A confirmed commission. Add the price and the team split in the job’s Money tab.'}
      </p>
      <section className="stack tight">
        <div className="row between wrap">
          <b>Client</b>
          <Segmented<'existing' | 'new'>
            label="Client"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'new', label: 'New client' },
              { value: 'existing', label: 'From the list' },
            ]}
          />
        </div>
        {mode === 'existing' ? (
          <Field label="Client" htmlFor="iq-client">
            <Select id="iq-client" value={f.clientId} onChange={(e) => set({ clientId: e.target.value })}>
              <option value="">Pick a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="form-grid">
            <Field label="Name or organization" htmlFor="iq-name">
              <TextInput id="iq-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. CICT Student Council" />
            </Field>
            <Field label="Kind of client" htmlFor="iq-kind" hint="Student orgs get student prices.">
              <Select id="iq-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value as ClientKind })}>
                {CLIENT_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Contact person" htmlFor="iq-contact">
              <TextInput id="iq-contact" value={f.contact} onChange={(e) => set({ contact: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="iq-phone">
              <TextInput id="iq-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="iq-email" className="span-2">
              <TextInput id="iq-email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
          </div>
        )}
      </section>
      <section className="stack tight">
        <b>The project</b>
        <div className="form-grid">
          <Field label="What they need" htmlFor="iq-title" className="span-2">
            <TextInput id="iq-title" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Org shirt + 3 sticker designs" />
          </Field>
          <Field label="Type" htmlFor="iq-type">
            <Select id="iq-type" value={f.type} onChange={(e) => set({ type: e.target.value as JobType })}>
              {JOB_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Needed by" htmlFor="iq-due">
            <input id="iq-due" type="date" className="input" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </Field>
          <Field label="Budget they mentioned" htmlFor="iq-budget">
            <TextInput id="iq-budget" value={f.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="e.g. around ₱5,000" />
          </Field>
          <Field label="Where they found us" htmlFor="iq-source">
            <Select id="iq-source" value={f.source} onChange={(e) => set({ source: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          {kind === 'job' ? (
            <div className="span-2">
              <MemberPicker label="Who works on it" value={f.designers} members={members} onChange={(ids) => set({ designers: ids })} />
            </div>
          ) : null}
          <Field label="Details" htmlFor="iq-brief" className="span-2">
            <TextArea id="iq-brief" rows={3} value={f.brief} onChange={(e) => set({ brief: e.target.value })} placeholder="Sizes, quantities, text, references, deadline notes…" />
          </Field>
        </div>
      </section>
    </Dialog>
  );
}
