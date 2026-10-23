import { useState } from 'react';
import { Badge, EmptyState, Loading, PageHeader } from '../../components/ui';
import { Select } from '../../components/form';
import { FilterBar, PeriodSelect } from '../../components/FilterBar';
import { useAudit, useMembers } from '../../hooks/data';
import { fmtDateTime, inPeriod, isoDate, type Period } from '../../lib/time';
import { ACTIVITY_LABELS, activityTone } from './labels';

export default function ActivityPage() {
  const audit = useAudit(1000);
  const members = useMembers();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [who, setWho] = useState('');
  const [period, setPeriod] = useState<Period>('');
  if (!audit) return <Loading />;
  const names = new Map((members ?? []).map((m) => [m.id, m.name]));
  const actions = [...new Set(audit.map((a) => a.action))].sort((a, b) => (ACTIVITY_LABELS[a] ?? a).localeCompare(ACTIVITY_LABELS[b] ?? b));
  const people = (members ?? []).filter((m) => audit.some((a) => a.actorId === m.id));
  const shown = audit.filter(
    (a) =>
      (!action || a.action === action) &&
      (!who || a.actorId === who) &&
      inPeriod(isoDate(a.at), period) &&
      (!q.trim() || `${a.summary} ${names.get(a.actorId ?? '') ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  return (
    <div className="page narrow">
      <PageHeader title="Activity" subtitle="Who added, moved, approved or changed what, and when." />
      <FilterBar
        id="activity"
        search={{ value: q, onChange: setQ, placeholder: 'Search activity' }}
        active={(action ? 1 : 0) + (who ? 1 : 0) + (period ? 1 : 0)}
        onClear={() => {
          setQ('');
          setAction('');
          setWho('');
          setPeriod('');
        }}
      >
        <Select aria-label="What happened" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Everything</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_LABELS[a] ?? a}
            </option>
          ))}
        </Select>
        <Select aria-label="Who" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <PeriodSelect value={period} onChange={setPeriod} />
      </FilterBar>
      {shown.length === 0 ? (
        <EmptyState title="Nothing yet" />
      ) : (
        <div className="card flush">
          <div className="list">
            {shown.map((a) => (
              <div key={a.id} className="list-item">
                <Badge tone={activityTone(a.action)}>{ACTIVITY_LABELS[a.action] ?? a.action}</Badge>
                <span className="main-text">
                  <b style={{ whiteSpace: 'normal' }}>{a.summary}</b>
                  <span>
                    {fmtDateTime(a.at)}
                    {a.actorId ? ` · ${names.get(a.actorId) ?? 'someone'}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
