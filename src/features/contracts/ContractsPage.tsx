import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FileDown, FileSignature, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, EmptyState, PageHeader, Toggle } from '../../components/ui';
import { Field, Select, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { useClients, useContracts, usePackages, useSettingRows } from '../../hooks/data';
import { setSetting, settingValue } from '../../db/settings';
import { CONTRACT_FIELDS, DEFAULT_CONTRACT_SECTIONS, fillTemplate, missingFields } from '../../domain/contract';
import { deleteContract, newContract, saveContract } from '../../services/clients';
import { buildContractPdf } from '../../reports/docs';
import { deliverPdf } from '../../reports/pdf';
import { safeFileName } from '../../lib/files';
import type { Contract } from '../../db/types';

export default function ContractsPage() {
  const [params, setParams] = useSearchParams();
  const contracts = useContracts();
  const clients = useClients() ?? [];
  const packages = (usePackages() ?? []).filter((p) => p.kind === 'smm');
  const [open, setOpen] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [clientId, setClientId] = useState('');
  const [packageId, setPackageId] = useState('');

  // Opened from a client or a won proposal: make the contract straight away.
  useEffect(() => {
    const cid = params.get('client');
    if (!cid) return;
    const client = clients.find((c) => c.id === cid);
    if (!client) return;
    setParams({}, { replace: true });
    newContract({ clientId: cid, packageId: client.packageId, proposalId: params.get('proposal') }).then((c) => setOpen(c.id));
  }, [params, clients, setParams]);

  if (!contracts) return null;
  return (
    <div className="page">
      <PageHeader
        title="Contracts"
        subtitle="Never start without one. Scope, client duties, payment and late fees, revisions, confidentiality, IP, a results disclaimer and how to end it."
        actions={
          <Button variant="primary" onClick={() => setMaking(true)}>
            <Plus size={18} /> New contract
          </Button>
        }
      />
      <Callout tone="warn">This template is a solid starting point, not legal advice. Have a lawyer look it over once, especially before signing bigger clients.</Callout>
      {contracts.length === 0 ? (
        <EmptyState icon={<FileSignature size={40} />} title="No contracts yet">
          Make one from a client’s won proposal, or here. It fills in the client, the package, the fee and your payment details.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Client</th>
                <th>Starts</th>
                <th>Fee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="click" onClick={() => setOpen(c.id)}>
                  <td className="mono">{c.number}</td>
                  <td>{c.fields['client.name'] || '—'}</td>
                  <td className="nowrap">{c.fields.effectiveDate || '—'}</td>
                  <td>{c.fields.fee || '—'}</td>
                  <td>
                    <Badge tone={c.status === 'signed' ? 'good' : c.status === 'sent' ? 'yellow' : undefined}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={making}
        onClose={() => setMaking(false)}
        title="New contract"
        footer={
          <Button
            variant="primary"
            onClick={async () => {
              const c = await newContract({ clientId: clientId || null, packageId: packageId || null });
              setMaking(false);
              setOpen(c.id);
            }}
          >
            Make it
          </Button>
        }
      >
        <Field label="Client" htmlFor="nc-client">
          <Select
            id="nc-client"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              const c = clients.find((x) => x.id === e.target.value);
              if (c?.packageId) setPackageId(c.packageId);
            }}
          >
            <option value="">Fill it in by hand</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Package" htmlFor="nc-pkg">
          <Select id="nc-pkg" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
            <option value="">None</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </Dialog>
      <ContractEditor id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Preview({ text, fields }: { text: string; fields: Record<string, string> }) {
  // Show blanks (unfilled fields) highlighted, without injecting HTML.
  const parts = text.split(/(\{\{\s*[\w.]+\s*\}\})/g);
  return (
    <p>
      {parts.map((part, i) => {
        const m = /^\{\{\s*([\w.]+)\s*\}\}$/.exec(part);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const v = fields[m[1]]?.trim();
        return v ? (
          <Fragment key={i}>{v}</Fragment>
        ) : (
          <span key={i} className="blank" title={CONTRACT_FIELDS.find((f) => f.key === m[1])?.label ?? m[1]}>
            ________
          </span>
        );
      })}
    </p>
  );
}

export function ContractEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp();
  const contracts = useContracts() ?? [];
  const rows = useSettingRows();
  const business = settingValue(rows, 'business');
  const stored = contracts.find((c) => c.id === id) ?? null;
  const [c, setC] = useState<Contract | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  if (stored && (!c || c.id !== stored.id)) setC({ ...stored, fields: { ...stored.fields }, sections: stored.sections.map((s) => ({ ...s })) });
  if (!id && c) setC(null);
  if (!c) return null;
  const missing = missingFields(c.sections, c.fields);
  const setField = (k: string, v: string) => setC({ ...c, fields: { ...c.fields, [k]: v } });
  const used = new Set<string>();
  for (const s of c.sections.filter((x) => x.on)) for (const m of s.body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) used.add(m[1]);
  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      size="xwide"
      fullPhone
      title={
        <span className="row" style={{ gap: 10 }}>
          Contract {c.number} <Badge tone={c.status === 'signed' ? 'good' : c.status === 'sent' ? 'yellow' : undefined}>{c.status}</Badge>
        </span>
      }
      footer={
        <>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!(await app.confirm({ title: 'Delete this contract?', confirmLabel: 'Delete', tone: 'danger' }))) return;
              await deleteContract(c.id);
              onClose();
            }}
          >
            <Trash2 size={16} /> Delete
          </Button>
          {app.role === 'owner' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await setSetting('contract', c.sections);
                app.toast('These sections are now the default for new contracts', { tone: 'good' });
              }}
            >
              <Save size={16} /> Make these sections the default
            </Button>
          ) : null}
          <span className="grow" />
          <Select aria-label="Status" style={{ width: 'auto' }} value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as Contract['status'] })}>
            <option value="draft">Draft</option>
            <option value="sent">Sent for signing</option>
            <option value="signed">Signed</option>
            <option value="ended">Ended</option>
          </Select>
          <Button
            onClick={async () => {
              await saveContract(c);
              await deliverPdf(await buildContractPdf(c, business), `${safeFileName(`${c.number} ${c.fields['client.name'] ?? ''}`)}.pdf`, true);
            }}
          >
            <FileDown size={16} /> PDF
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await saveContract(c);
              app.toast('Saved', { tone: 'good' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      {missing.length ? <Callout tone="warn">Still blank: {missing.map((k) => CONTRACT_FIELDS.find((f) => f.key === k)?.label ?? k).join(', ')}. Blanks print as lines to fill in by hand.</Callout> : null}
      <div className="editor-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)' }}>
        <div className="stack">
          <h3>Details</h3>
          {CONTRACT_FIELDS.filter((f) => used.has(f.key) || f.key.startsWith('studio.') || f.key.startsWith('client.')).map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`cf-${f.key}`} hint={f.hint}>
              {f.long ? (
                <TextArea id={`cf-${f.key}`} rows={5} value={c.fields[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />
              ) : (
                <TextInput id={`cf-${f.key}`} value={c.fields[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />
              )}
            </Field>
          ))}
          <h3>Sections</h3>
          {c.sections.map((s, i) => (
            <div key={s.id} className="card" style={{ padding: '10px 12px' }}>
              <div className="row between">
                <Toggle id={`cs-${s.id}`} checked={s.on} onChange={(v) => setC({ ...c, sections: c.sections.map((x, j) => (j === i ? { ...x, on: v } : x)) })} label={s.title} />
                <Button size="sm" variant="ghost" onClick={() => setEditing(editing === i ? null : i)}>
                  {editing === i ? 'Done' : 'Edit text'}
                </Button>
              </div>
              {editing === i ? (
                <div className="stack tight">
                  <TextInput aria-label="Section title" value={s.title} onChange={(e) => setC({ ...c, sections: c.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  <TextArea aria-label="Section text" rows={7} value={s.body} onChange={(e) => setC({ ...c, sections: c.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
                  <div className="row between">
                    <span className="tiny muted">Use {'{{fee}}'}, {'{{client.name}}'}… to insert details.</span>
                    {DEFAULT_CONTRACT_SECTIONS.find((d) => d.id === s.id) ? (
                      <Button size="sm" variant="ghost" onClick={() => setC({ ...c, sections: c.sections.map((x, j) => (j === i ? { ...(DEFAULT_CONTRACT_SECTIONS.find((d) => d.id === s.id) as typeof s), on: x.on } : x)) })}>
                        <RotateCcw size={14} /> Original text
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          <Button size="sm" onClick={() => setC({ ...c, sections: [...c.sections, { id: `custom-${Date.now()}`, title: 'New section', body: '', on: true }] })}>
            <Plus size={16} /> Add a section
          </Button>
        </div>
        <div className="contract-preview" aria-label="Preview">
          <h2>Social Media Management Agreement</h2>
          <span className="muted small">{c.number}</span>
          {c.sections
            .filter((s) => s.on)
            .map((s, i) => (
              <div key={s.id} className="stack tight">
                <h3>
                  {i + 1}. {s.title}
                </h3>
                <Preview text={s.body} fields={c.fields} />
              </div>
            ))}
          <p className="tiny muted">{fillTemplate('Signed for {{studio.name}} and for {{client.name}}.', c.fields)}</p>
        </div>
      </div>
    </Dialog>
  );
}
