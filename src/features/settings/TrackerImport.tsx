import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout } from '../../components/ui';
import { Check } from '../../components/form';
import { readXlsx } from '../../domain/xlsx';
import { parseTracker, type TrackerImport as Parsed } from '../../domain/tracker';
import { JOB_STATUS_LABEL } from '../../domain/jobs';
import { applyTracker, DEFAULT_TRACKER_OPTIONS, previewTracker, type TrackerOptions, type TrackerPreview } from '../../services/importTracker';
import { peso } from '../../lib/money';

/**
 * Bring the commission tracker (.xlsx) in: jobs, team splits, client payments,
 * targets and BIR settings. Read on this device; nothing is uploaded. Importing
 * the same workbook again updates the jobs instead of adding copies.
 */
export function TrackerImport() {
  const app = useApp();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [opts, setOpts] = useState<TrackerOptions>(DEFAULT_TRACKER_OPTIONS);
  const [preview, setPreview] = useState<TrackerPreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const load = async (f: File) => {
    setError('');
    setPreview(null);
    try {
      const t = parseTracker(readXlsx(new Uint8Array(await f.arrayBuffer())));
      if (!t.jobs.length) throw new Error('No jobs were found in the Main Commission Tracker sheet.');
      setFile(f.name);
      setParsed(t);
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
  };
  const set = (patch: Partial<TrackerOptions>) => {
    setOpts({ ...opts, ...patch });
    setPreview(null);
  };

  return (
    <div className="stack">
      <p className="sub">JOSHWORK_COMMISSION_TRACKER (.xlsx): jobs, payments, the Payment Designation splits, monthly targets and BIR settings. It’s read on this device; nothing is uploaded. Importing again updates instead of duplicating.</p>
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Choose the commission tracker"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') input.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void load(f);
        }}
      >
        <FileSpreadsheet size={28} />
        <div className="strong">{file || 'Choose or drop the commission tracker (.xlsx)'}</div>
      </div>
      {error ? <Callout tone="bad">{error}</Callout> : null}

      {parsed ? (
        <div className="stack">
          <div className="row wrap">
            <Badge tone="teal">{parsed.jobs.length} jobs</Badge>
            <Badge>{parsed.splits.size} team splits</Badge>
            <Badge>{parsed.people.length} people</Badge>
            <Badge>{parsed.targets.length} monthly targets</Badge>
            {Object.keys(parsed.bir).length ? <Badge>BIR settings</Badge> : null}
          </div>
          <div className="grid-2">
            <Check
              id="tr-owner"
              checked={opts.ownerTakesUnsplit}
              onChange={(v) => set({ ownerTakesUnsplit: v })}
              label="Jobs with no Payment Designation row go 100% to the owner"
              sub="Otherwise their shares stay unassigned until you set a split."
            />
            <Check
              id="tr-settle"
              checked={opts.settlePast}
              onChange={(v) => set({ settlePast: v })}
              label="Everyone has been paid for the tracker’s payments"
              sub="Records one “settled before the app” payout each, so past work doesn’t show as owed. Payments you record here later stay owed until you pay them out."
            />
            <Check id="tr-targets" checked={opts.importTargets} onChange={(v) => set({ importTargets: v })} label="Monthly targets and the big-project line" />
            <Check id="tr-bir" checked={opts.importBir} onChange={(v) => set({ importBir: v })} label="BIR settings (start date, 8%, ₱250k, ₱3M)" />
          </div>
          {!preview ? (
            <div>
              <Button variant="primary" onClick={async () => setPreview(await previewTracker(parsed, opts))}>
                <Upload size={16} /> Preview
              </Button>
            </div>
          ) : (
            <div className="stack">
              <Callout tone="good" title={`${preview.newJobs} new job${preview.newJobs === 1 ? '' : 's'}${preview.updatedJobs ? `, ${preview.updatedJobs} updated` : ''}`}>
                {preview.payments} client payments ({peso(preview.paid)}){preview.guessedDates ? `; ${preview.guessedDates} have no paid-on date, so they use the job’s start or end date` : ''}. New jobs made here continue from {preview.nextJobNumber}.
              </Callout>
              {preview.people.length ? (
                <p className="small">
                  <b>Team:</b>{' '}
                  {preview.people.map((p) => (p.isNew ? `${p.name} (new designer)` : `${p.name} → ${p.memberName}`)).join(' · ')}
                </p>
              ) : null}
              {preview.newClients.length ? (
                <p className="small">
                  <b>{preview.newClients.length} new client{preview.newClients.length === 1 ? '' : 's'}</b> (the rest match by email or name).
                </p>
              ) : null}
              {opts.settlePast && preview.settle.length ? (
                <p className="small">
                  <b>Marked as already paid out:</b> {preview.settle.map((s) => `${s.name} ${peso(s.amount)}`).join(' · ')}
                </p>
              ) : null}
              {preview.keepAppPayments.length ? (
                <Callout tone="info">
                  {preview.keepAppPayments.join(', ')} already {preview.keepAppPayments.length === 1 ? 'has' : 'have'} payments recorded in the app, so the tracker’s payments for {preview.keepAppPayments.length === 1 ? 'it' : 'them'} are skipped.
                </Callout>
              ) : null}
              {preview.warnings.length ? (
                <Callout tone="warn" title="Check these in the tracker">
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {preview.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
              <div className="table-wrap" style={{ maxHeight: 360 }}>
                <table className="table cards-on-phone">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Status</th>
                      <th className="r">Total</th>
                      <th className="r">Paid</th>
                      <th>Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.jobs.map((j) => (
                      <tr key={j.number}>
                        <td data-label="Job">
                          <span className="mono tiny muted">{j.number}</span> {j.title}
                          {j.update ? <Badge tone="teal">Update</Badge> : null}
                        </td>
                        <td data-label="Status">{JOB_STATUS_LABEL[j.status]}</td>
                        <td data-label="Total" className="r num">{j.total ? peso(j.total) : '—'}</td>
                        <td data-label="Paid" className="r num">{j.paid ? peso(j.paid) : '—'}</td>
                        <td data-label="Split" className="small">{j.split}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions">
                <Button onClick={() => setPreview(null)}>Change options</Button>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const s = await applyTracker(parsed, opts);
                      app.toast(
                        `Imported ${s.jobs} jobs and ${s.payments} payments${s.members ? `, added ${s.members} designer${s.members === 1 ? '' : 's'}` : ''}${s.clients ? `, ${s.clients} client${s.clients === 1 ? '' : 's'}` : ''}`,
                        { tone: 'good', ms: 9000 },
                      );
                      setParsed(null);
                      setPreview(null);
                      setFile('');
                      navigate('/jobs/list');
                    } catch (e) {
                      app.toast(e instanceof Error ? e.message : 'The import failed', { tone: 'bad' });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Importing…' : 'Import'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
