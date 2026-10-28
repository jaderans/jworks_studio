import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { KeyRound, Link2, Pencil, Plus, Send, Trash2, UserPlus } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, IconButton, Loading, PageHeader, Segmented, Toggle } from '../../components/ui';
import { Field, Select, TextArea, TextInput } from '../../components/form';
import { FilterBar } from '../../components/FilterBar';
import { Dialog } from '../../components/Dialog';
import { MemberDot } from '../../components/people';
import { useJobs, useMembers } from '../../hooks/data';
import { useSyncStatus } from '../../sync/useSync';
import { ROLE_HINT, ROLE_LABEL, deleteMember, saveMember, setMemberActive, skillsFromRole } from '../../services/team';
import { SERVICE_LABEL } from '../../domain/campaignTemplates';
import { getLocal, setLocal } from '../../db/local';
import { isOpen } from '../../domain/jobs';
import { LoginDialog, type LoginToSend } from './LoginDialog';
import { copyText } from '../../lib/text';
import type { AccessRow } from '../../sync/cloud';
import type { AppRole, Member, ServiceKey } from '../../db/types';

export default function TeamPage() {
  const app = useApp();
  const members = useMembers();
  const jobs = useJobs() ?? [];
  const sync = useSyncStatus();
  const cloudOwner = sync.access?.role === 'owner';
  const [editing, setEditing] = useState<Partial<Member> | null>(null);
  const [access, setAccess] = useState<AccessRow[] | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | AppRole>('');
  const [inactive, setInactive] = useState(false);

  const loadAccess = useCallback(async () => {
    if (!cloudOwner) return;
    try {
      const { listAccess } = await import('../../sync/cloud');
      setAccess(await listAccess());
    } catch {
      setAccess(null);
    }
  }, [cloudOwner]);
  useEffect(() => {
    void loadAccess();
  }, [loadAccess, members]);

  const [login, setLogin] = useState<LoginToSend[] | null>(null);
  const [renewing, setRenewing] = useState(false);

  /** The one link for the whole team: pin it in the group chat; everyone signs in there. */
  const copySignInLink = async () => {
    const [{ getCloudConfig }, { teamSignInLink }] = await Promise.all([import('../../sync/cloud'), import('../../sync/config')]);
    const cfg = await getCloudConfig();
    if (!cfg) return;
    const ok = await copyText(teamSignInLink(cfg));
    app.toast(ok ? 'Sign-in link copied. Pin it in your team chat: everyone signs in there with their email and password.' : 'Couldn’t copy the link.', { tone: ok ? 'good' : 'bad', ms: 9000 });
  };

  /** A new temporary password (their first login, or a fresh one): the old one stops working. */
  const newLogin = async (m: Member): Promise<LoginToSend> => {
    const { createTeamLogin } = await import('../../sync/cloud');
    const r = await createTeamLogin(m);
    await setLocal(`login:${r.email}`, { password: r.password, at: Date.now() });
    return { member: m, email: r.email, password: r.password };
  };
  const loginError = async (e: unknown) => {
    const { friendlyError } = await import('../../sync/cloud');
    app.toast(friendlyError(e), { tone: 'bad' });
  };

  /** Make their login (email + temporary password) and show it to send. */
  const makeLogin = async (m: Member) => {
    try {
      const made = await newLogin(m);
      await loadAccess();
      setLogin([made]);
    } catch (e) {
      await loginError(e);
    }
  };

  /** A fresh temporary password for someone who lost theirs or forgot their own. */
  const renewLogin = async (m: Member) => {
    const ok = await app.confirm({
      title: `New password for ${m.name}?`,
      message: `${m.name}’s current password stops working. They sign in with the new temporary one, then choose their own.`,
      confirmLabel: 'Make a new password',
    });
    if (ok) await makeLogin(m);
  };

  /** Everyone but the owner gets a new temporary password, shown in one list. */
  const renewAll = async (people: Member[]) => {
    const ok = await app.confirm({
      title: 'New passwords for everyone?',
      message: `${people.map((m) => m.name).join(', ')} each get a new temporary password and their current one stops working. Anyone signed in signs in again with the new one, then chooses their own password.`,
      confirmLabel: 'Make new passwords',
    });
    if (!ok) return;
    setRenewing(true);
    const made: LoginToSend[] = [];
    try {
      for (const m of people) made.push(await newLogin(m));
    } catch (e) {
      await loginError(e);
    } finally {
      setRenewing(false);
      await loadAccess();
      if (made.length) setLogin(made);
    }
  };

  /** Show a login made on this device again (until they choose their own password). */
  const sendLogin = async (m: Member) => {
    const email = m.email.trim().toLowerCase();
    const saved = await getLocal<{ password: string } | null>(`login:${email}`, null);
    if (saved) setLogin([{ member: m, email, password: saved.password }]);
    else if (await app.confirm({ title: `Make ${m.name} a new password?`, message: `${m.name}’s temporary password was made on another device, so it can’t be shown here. A new one replaces it.`, confirmLabel: 'Make a new password' }))
      await makeLogin(m);
  };

  const stillDesigners = (members ?? []).filter((m) => m.active === 1 && m.appRole === 'designer');
  const makeManagers = async () => {
    for (const m of stillDesigners) {
      const saved = await saveMember({ ...m, appRole: 'manager' });
      if (cloudOwner && saved.email) {
        const { grantAccess } = await import('../../sync/cloud');
        await grantAccess(saved).catch(() => undefined);
      }
    }
    await loadAccess();
    app.toast(`${stillDesigners.length} ${stillDesigners.length === 1 ? 'person is' : 'people are'} now Managers`, { tone: 'good' });
  };

  if (!members) return <Loading />;
  const accessByEmail = new Map((access ?? []).map((a) => [a.email, a]));
  const accessOf = (m: Member) => (m.email ? accessByEmail.get(m.email.trim().toLowerCase()) : undefined);
  const withLogins = members.filter((m) => m.active === 1 && m.appRole !== 'owner' && m.email.trim());
  const needle = q.trim().toLowerCase();
  const shown = members.filter(
    (m) => (inactive || m.active === 1) && (!role || m.appRole === role) && (!needle || `${m.name} ${m.roleLabel} ${m.email ?? ''}`.toLowerCase().includes(needle)),
  );
  return (
    <div className="page">
      <PageHeader
        title="Team"
        subtitle="Everyone at the studio. Their colour follows them on jobs, the calendar and payouts."
        actions={
          <>
            {sync.enabled ? (
              <Button onClick={copySignInLink}>
                <Link2 size={18} /> Copy sign-in link
              </Button>
            ) : null}
            {cloudOwner && withLogins.length ? (
              <Button onClick={() => renewAll(withLogins)} disabled={renewing}>
                <KeyRound size={18} /> {renewing ? 'Making passwords…' : 'New passwords for everyone'}
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setEditing({ appRole: 'manager', skills: [] })}>
              <UserPlus size={18} /> Add person
            </Button>
          </>
        }
      />
      {!sync.enabled ? (
        <Callout tone="info" title="Connect the team’s phones">
          Turn on cloud sync in <Link to="/settings#s-sync">Settings → Cloud sync</Link>. Then add each person here with their name and email: the app makes their login with a temporary password for you to send. No email confirmation or Google account needed.
        </Callout>
      ) : !cloudOwner ? (
        <Callout tone="warn">Sign in as the owner (Settings → Cloud sync) to make logins.</Callout>
      ) : (
        <p className="small muted">Add a person with their name and email, and the app makes their login with a temporary password to send them. They sign in, choose their own password, and get a short guide to the app.</p>
      )}
      {stillDesigners.length && app.role === 'owner' ? (
        <Callout tone="info" title={`${stillDesigners.length} ${stillDesigners.length === 1 ? 'person is' : 'people are'} still Designer`}>
          <div className="row wrap between">
            <span>Designers don’t see money, quotes or contracts. Make them Managers so they see everything happening at the studio (only you change the team and settings).</span>
            <Button variant="teal" size="sm" onClick={makeManagers}>
              Make them Managers
            </Button>
          </div>
        </Callout>
      ) : null}
      <FilterBar
        id="team"
        search={{ value: q, onChange: setQ, placeholder: 'Find a person' }}
        active={(role ? 1 : 0) + (inactive ? 1 : 0)}
        onClear={() => {
          setQ('');
          setRole('');
          setInactive(false);
        }}
      >
        <Select aria-label="Access" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="">Every role</option>
          {(['owner', 'manager', 'designer'] as AppRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <Toggle id="team-inactive" checked={inactive} onChange={setInactive} label="Show inactive" />
      </FilterBar>
      <div className="card flush">
        <div className="list">
          {shown.map((m) => {
            const open = jobs.filter((j) => isOpen(j) && (j.designers.includes(m.id) || j.lead === m.id)).length;
            const acc = accessOf(m);
            return (
              <div key={m.id} className="list-item" style={m.active ? undefined : { opacity: 0.55 }}>
                <MemberDot member={m} size="lg" />
                <span className="main-text">
                  <b>
                    {m.name} {m.active ? null : <Badge>Inactive</Badge>}
                  </b>
                  <span>
                    {m.roleLabel || ROLE_LABEL[m.appRole]}
                    {m.skills.length ? ` · ${m.skills.map((s) => SERVICE_LABEL[s]).join(', ')}` : ''}
                  </span>
                </span>
                <span className="small muted hide-phone">{open} open job{open === 1 ? '' : 's'}</span>
                <Badge tone={m.appRole === 'owner' ? 'yellow' : m.appRole === 'manager' ? 'teal' : undefined}>{ROLE_LABEL[m.appRole]}</Badge>
                {cloudOwner ? (
                  !m.email ? (
                    <span className="muted small hide-phone">No email</span>
                  ) : !acc ? (
                    <Badge tone="warn">No login yet</Badge>
                  ) : !acc.active ? (
                    <Badge>Paused</Badge>
                  ) : acc.mustChangePassword ? (
                    <Badge tone="yellow">Temporary password</Badge>
                  ) : acc.hasLogin || m.appRole === 'owner' ? (
                    <Badge tone="good">Signed in</Badge>
                  ) : (
                    // From the old invite links: needs a login made here.
                    <Badge tone="warn">Old invite</Badge>
                  )
                ) : null}
                {cloudOwner && m.email && m.appRole !== 'owner' ? (
                  !acc || !acc.hasLogin ? (
                    <Button size="sm" onClick={() => makeLogin(m)} aria-label={`Make ${m.name}’s login`}>
                      <KeyRound size={15} /> <span className="hide-phone">Make login</span>
                    </Button>
                  ) : acc.mustChangePassword ? (
                    <>
                      <Button size="sm" onClick={() => sendLogin(m)} aria-label={`Send ${m.name}’s login`}>
                        <Send size={15} /> <span className="hide-phone">Send login</span>
                      </Button>
                      <IconButton label={`New password for ${m.name}`} size="sm" plain onClick={() => renewLogin(m)}>
                        <KeyRound size={16} />
                      </IconButton>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => renewLogin(m)} aria-label={`New password for ${m.name}`}>
                      <KeyRound size={15} /> <span className="hide-phone">New password</span>
                    </Button>
                  )
                ) : null}
                <IconButton label={`Edit ${m.name}`} size="sm" plain onClick={() => setEditing(m)}>
                  <Pencil size={16} />
                </IconButton>
              </div>
            );
          })}
        </div>
      </div>
      <MemberDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={async (saved, oldEmail) => {
          const moved = !!oldEmail && oldEmail.trim().toLowerCase() !== saved.email.trim().toLowerCase();
          if (!cloudOwner) {
            if (sync.enabled && (moved || saved.email)) app.toast('Saved on this device. Sign in as the owner (Settings → Cloud sync) to update their sign-in access.', { tone: 'info' });
            return;
          }
          try {
            const { grantAccess, revokeAccess } = await import('../../sync/cloud');
            // Access follows the email: the old address stops working, the new one can sign in.
            if (moved) await revokeAccess(oldEmail).catch(() => undefined);
            if (saved.email && !(saved.appRole !== 'owner' && (moved || !oldEmail))) await grantAccess(saved);
            await loadAccess();
            // A new email gets its login (with a temporary password) right away.
            if (saved.email && saved.appRole !== 'owner' && (moved || !oldEmail)) await makeLogin(saved);
          } catch (e) {
            app.toast(e instanceof Error ? e.message : 'Could not update their access', { tone: 'bad' });
          }
        }}
      />
      <LoginDialog value={login} onClose={() => setLogin(null)} />
    </div>
  );
}

function MemberDialog({ value, onClose, onSaved }: { value: Partial<Member> | null; onClose: () => void; onSaved: (m: Member, oldEmail: string) => Promise<void> }) {
  const app = useApp();
  const [m, setM] = useState<Partial<Member>>({});
  const [key, setKey] = useState<string | null>(null);
  if (value && key !== (value.id ?? 'new')) {
    setM({ skills: [], ...value });
    setKey(value.id ?? 'new');
  }
  if (!value && key !== null) setKey(null);
  const skills = m.skills ?? [];
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={value?.id ? `Edit ${value.name}` : 'Add person'}
      footer={
        <>
          {value?.id ? (
            <>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!(await app.confirm({ title: `Remove ${value.name}?`, message: 'If they have posts, mark them inactive instead.', confirmLabel: 'Remove', tone: 'danger' }))) return;
                  try {
                    await deleteMember(value.id as string);
                    if (value.email) {
                      const { revokeAccess } = await import('../../sync/cloud');
                      await revokeAccess(value.email).catch(() => undefined);
                    }
                    onClose();
                  } catch (e) {
                    app.toast(e instanceof Error ? e.message : 'Could not remove', { tone: 'bad' });
                  }
                }}
              >
                <Trash2 size={16} /> Remove
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await setMemberActive(value.id as string, value.active !== 1);
                    onClose();
                  } catch (e) {
                    app.toast(e instanceof Error ? e.message : 'Could not change', { tone: 'bad' });
                  }
                }}
              >
                {value.active === 1 ? 'Mark inactive' : 'Make active'}
              </Button>
            </>
          ) : null}
          <span className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!m.name?.trim()}
            onClick={async () => {
              try {
                const oldEmail = value?.email ?? '';
                const saved = await saveMember({ ...(m as Member), name: m.name!.trim() });
                await onSaved(saved, oldEmail);
                app.toast('Saved', { tone: 'good' });
                onClose();
              } catch (e) {
                app.toast(e instanceof Error ? e.message : 'Could not save', { tone: 'bad' });
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" htmlFor="tm-name">
          <TextInput id="tm-name" value={m.name ?? ''} onChange={(e) => setM({ ...m, name: e.target.value })} />
        </Field>
        <Field label="What they do" htmlFor="tm-role" hint="e.g. Illustrator & Character Design">
          <TextInput
            id="tm-role"
            value={m.roleLabel ?? ''}
            onChange={(e) => setM({ ...m, roleLabel: e.target.value, skills: (m.skills ?? []).length ? m.skills : skillsFromRole(e.target.value) })}
          />
        </Field>
        <Field label="Sign-in email" htmlFor="tm-email" className="span-2" hint="Any working email. Saving makes their login with a temporary password for you to send. If you change it, their access moves to the new address.">
          <TextInput id="tm-email" type="email" autoComplete="off" placeholder="name@gmail.com" value={m.email ?? ''} onChange={(e) => setM({ ...m, email: e.target.value.trim() })} />
        </Field>
      </div>
      <Field label="Access">
        <Segmented<AppRole>
          label="Access"
          value={m.appRole ?? 'manager'}
          onChange={(v) => setM({ ...m, appRole: v })}
          options={(['manager', 'designer', 'owner'] as AppRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        />
        <span className="hint">{ROLE_HINT[m.appRole ?? 'manager']}</span>
      </Field>
      <Field label="Leads on">
        <div className="chip-row">
          {(Object.keys(SERVICE_LABEL) as ServiceKey[]).map((s) => {
            const on = skills.includes(s);
            return (
              <button key={s} type="button" className="chip" aria-pressed={on} onClick={() => setM({ ...m, skills: on ? skills.filter((x) => x !== s) : [...skills, s] })}>
                {SERVICE_LABEL[s]}
              </button>
            );
          })}
        </div>
      </Field>
      {value?.id ? (
        <Field label="Colour">
          <div className="chip-row">
            {Array.from({ length: 8 }, (_, i) => (
              <button key={i} type="button" className="chip" aria-pressed={m.color === i} onClick={() => setM({ ...m, color: i })} aria-label={`Colour ${i + 1}`}>
                <MemberDot member={{ name: m.name ?? '?', color: i }} />
              </button>
            ))}
          </div>
        </Field>
      ) : null}
      <Field label="Notes" htmlFor="tm-notes">
        <TextArea id="tm-notes" rows={2} value={m.notes ?? ''} onChange={(e) => setM({ ...m, notes: e.target.value })} />
      </Field>
      <p className="tiny muted">
        <Plus size={12} /> Designers see their jobs, the content calendar and board, and their own pay. Only owners and managers see prices, invoices and contracts.
      </p>
    </Dialog>
  );
}
