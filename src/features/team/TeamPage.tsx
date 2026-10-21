import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Link2, Mail, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Badge, Button, Callout, IconButton, Loading, PageHeader, Segmented } from '../../components/ui';
import { Field, TextArea, TextInput } from '../../components/form';
import { Dialog } from '../../components/Dialog';
import { MemberDot } from '../../components/people';
import { useJobs, useMembers } from '../../hooks/data';
import { useSyncStatus } from '../../sync/useSync';
import { ROLE_HINT, ROLE_LABEL, deleteMember, saveMember, setMemberActive, skillsFromRole } from '../../services/team';
import { SERVICE_LABEL } from '../../domain/campaignTemplates';
import { getSetting } from '../../db/settings';
import { isOpen } from '../../domain/jobs';
import { emailReady, sendEmail } from '../../email/send';
import { inviteEmail } from '../../email/templates';
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

  /** Invite by branded email when Settings → Email is set up; otherwise (or with `share`) share or copy the link. */
  const invite = async (m: Member, share = false) => {
    const { getCloudConfig } = await import('../../sync/cloud');
    const { inviteLink } = await import('../../sync/config');
    const cfg = await getCloudConfig();
    if (!cfg) return;
    const link = inviteLink(cfg, m.email, m.name);
    const emailSettings = await getSetting('email');
    if (!share && emailReady(emailSettings)) {
      try {
        const business = await getSetting('business');
        const from = app.member?.name || business.name || 'JoshWorks';
        await sendEmail({ email: m.email, name: m.name }, inviteEmail(business, { name: m.name, email: m.email, link, role: ROLE_LABEL[m.appRole], from }), { settings: emailSettings, what: `team invite for ${m.name}` });
        app.toast(`Invite emailed to ${m.email}`, { tone: 'good' });
      } catch (e) {
        app.toast(`${e instanceof Error ? e.message : 'The email didn’t send.'} You can share the link instead.`, { tone: 'bad', action: { label: 'Share link', onClick: () => void invite(m, true) } });
      }
      return;
    }
    const text = `Hi ${m.name}! Join JoshWorks Studio: open this link on your phone and sign in with Google or ${m.email}.\n${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'JoshWorks Studio invite', text });
        return;
      }
    } catch {
      /* cancelled; fall back to copy */
    }
    app.toast((await copyText(text)) ? 'Invite copied. Paste it in Messenger or Viber.' : 'Couldn’t copy the invite.', { tone: 'good' });
  };

  if (!members) return <Loading />;
  const accessByEmail = new Map((access ?? []).map((a) => [a.email, a]));
  return (
    <div className="page">
      <PageHeader
        title="Team"
        subtitle="Everyone at the studio. Their colour follows them on jobs, the calendar and payouts."
        actions={
          <Button variant="primary" onClick={() => setEditing({ appRole: 'designer', skills: [] })}>
            <UserPlus size={18} /> Add person
          </Button>
        }
      />
      {!sync.enabled ? (
        <Callout tone="info" title="Connect the team’s phones">
          Turn on cloud sync in <Link to="/settings#s-sync">Settings → Cloud sync</Link> (your own free Firebase project). Then add each person’s sign-in email here and invite them. Their jobs, posts and pay sync live.
        </Callout>
      ) : !cloudOwner ? (
        <Callout tone="warn">Sign in as the owner (Settings → Cloud sync) to send invites.</Callout>
      ) : null}
      <div className="card flush">
        <div className="list">
          {members.map((m) => {
            const open = jobs.filter((j) => isOpen(j) && (j.designers.includes(m.id) || j.lead === m.id)).length;
            const acc = m.email ? accessByEmail.get(m.email) : undefined;
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
                  ) : acc ? (
                    <Badge tone={acc.active ? 'good' : undefined}>{acc.active ? 'Can sign in' : 'Paused'}</Badge>
                  ) : (
                    <Badge tone="warn">Not invited</Badge>
                  )
                ) : null}
                {cloudOwner && m.email && m.appRole !== 'owner' ? (
                  <>
                    <Button size="sm" onClick={() => invite(m)} aria-label={`Invite ${m.name}`}>
                      <Mail size={15} /> <span className="hide-phone">Invite</span>
                    </Button>
                    <IconButton label={`Share ${m.name}’s invite link`} size="sm" plain onClick={() => invite(m, true)}>
                      <Link2 size={16} />
                    </IconButton>
                  </>
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
            if (saved.email) await grantAccess(saved);
            await loadAccess();
            const canInvite = !!saved.email && saved.appRole !== 'owner';
            if (moved && saved.email) app.toast(`${saved.name} now signs in with ${saved.email}. ${oldEmail} no longer has access.`, { tone: 'good', action: canInvite ? { label: 'Invite', onClick: () => void invite(saved) } : undefined });
            else if (!oldEmail && canInvite) app.toast(`${saved.name} can sign in with ${saved.email}.`, { tone: 'good', action: { label: 'Send invite', onClick: () => void invite(saved) } });
          } catch (e) {
            app.toast(e instanceof Error ? e.message : 'Could not update their access', { tone: 'bad' });
          }
        }}
      />
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
        <Field label="Sign-in email" htmlFor="tm-email" className="span-2" hint="Their Google account, or any email they’ll sign in with. If you change it, their access moves to the new address.">
          <TextInput id="tm-email" type="email" autoComplete="off" placeholder="name@gmail.com" value={m.email ?? ''} onChange={(e) => setM({ ...m, email: e.target.value.trim() })} />
        </Field>
      </div>
      <Field label="Access">
        <Segmented<AppRole>
          label="Access"
          value={m.appRole ?? 'designer'}
          onChange={(v) => setM({ ...m, appRole: v })}
          options={(['designer', 'manager', 'owner'] as AppRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        />
        <span className="hint">{ROLE_HINT[m.appRole ?? 'designer']}</span>
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
