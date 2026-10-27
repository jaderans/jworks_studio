import { alive, db } from '../db/db';
import { audit, create, patch, remove, save } from '../db/write';
import { getSetting, setSetting } from '../db/settings';
import { hashPin, newSalt } from '../lib/hash';
import type { AppRole, Member, ServiceKey } from '../db/types';

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  designer: 'Designer',
};

export const ROLE_HINT: Record<AppRole, string> = {
  owner: 'Everything: jobs, clients, money, documents, marketing, team and settings.',
  manager: 'Sees and runs everything happening at the studio: jobs, clients, documents, money and marketing, plus their own pay. Only the owner changes the team and settings.',
  designer: 'Their jobs and deadlines, the content calendar and board, and their own pay. No prices, invoices or contracts.',
};

/** Guess what someone leads from how their role is written ("Brand, Logo & Shirt Design"). */
export function skillsFromRole(role: string): ServiceKey[] {
  const r = role.toLowerCase();
  const out: ServiceKey[] = [];
  if (/brand|logo|identity/.test(r)) out.push('branding');
  if (/shirt|merch|apparel/.test(r)) out.push('merch');
  if (/illustrat|character|mascot|drawing/.test(r)) out.push('illustration');
  if (/motion|animat|video|3d/.test(r)) out.push('motion');
  if (/web|ui|ux|layout/.test(r)) out.push('web');
  if (/packag|label/.test(r)) out.push('packaging');
  if (/sticker/.test(r)) out.push('stickers');
  if (/social|smm|content/.test(r)) out.push('smm');
  return out;
}

/** The next colour slot nobody uses yet (colours follow the person, never their rank). */
export async function nextColor(): Promise<number> {
  const used = new Set(alive(await db.members.toArray()).map((m) => m.color));
  for (let i = 0; i < 8; i++) if (!used.has(i)) return i;
  return (await db.members.count()) % 8;
}

const LAST_OWNER = 'The team needs at least one active owner. Make someone else an owner first.';

const isActiveOwner = (m: Member) => m.deleted !== 1 && m.active === 1 && m.appRole === 'owner';

async function wouldRemoveLastOwner(id: string, after: Member | null): Promise<boolean> {
  const before = await db.members.get(id);
  if (!before || !isActiveOwner(before) || (after && isActiveOwner(after))) return false;
  return (await db.members.toArray()).filter(isActiveOwner).every((o) => o.id === id);
}

export async function saveMember(m: Partial<Member> & { name: string }): Promise<Member> {
  if (m.id) {
    const existing = await db.members.get(m.id);
    if (existing) {
      const next = { ...existing, ...m, email: (m.email ?? existing.email).trim().toLowerCase() } as Member;
      if (await wouldRemoveLastOwner(existing.id, next)) throw new Error(LAST_OWNER);
      await save(db.members, next);
      if (existing.appRole !== next.appRole) await audit('role', 'member', next.id, `${next.name} is now ${ROLE_LABEL[next.appRole]}`);
      return next;
    }
  }
  const created = await create<Member>(db.members, {
    name: m.name.trim(),
    email: (m.email ?? '').trim().toLowerCase(),
    appRole: m.appRole ?? 'designer',
    roleLabel: m.roleLabel ?? '',
    skills: m.skills ?? skillsFromRole(m.roleLabel ?? ''),
    color: m.color ?? (await nextColor()),
    active: 1,
    notes: m.notes ?? '',
  });
  await audit('create', 'member', created.id, `Added ${created.name} as ${ROLE_LABEL[created.appRole]}`);
  return created;
}

export async function setMemberActive(id: string, active: boolean): Promise<void> {
  const m = await db.members.get(id);
  if (m && !active && (await wouldRemoveLastOwner(id, { ...m, active: 0 }))) throw new Error(LAST_OWNER);
  await patch(db.members, id, { active: active ? 1 : 0 });
}

export async function deleteMember(id: string): Promise<void> {
  if (await wouldRemoveLastOwner(id, null)) throw new Error(LAST_OWNER);
  const assigned = alive(await db.posts.toArray()).some((p) => p.assignees.includes(id));
  if (assigned) throw new Error('This person has posts assigned. Mark them inactive instead, or reassign the posts first.');
  await remove(db.members, id);
}

export async function restoreOwner(name: string): Promise<Member> {
  const created = await saveMember({ name: name.trim() || 'Owner', appRole: 'owner', roleLabel: 'Creative Director' });
  await audit('security', 'member', created.id, `Restored the owner: ${created.name}`);
  return created;
}

export async function makeOwner(id: string): Promise<void> {
  const m = await db.members.get(id);
  if (!m) return;
  await patch(db.members, id, { appRole: 'owner', active: 1 });
  await audit('role', 'member', id, `${m.name} is now Owner`);
}

// ----- owner PIN (for a shared studio computer) -----

export async function hasOwnerPin(): Promise<boolean> {
  return !!(await getSetting('security')).pinHash;
}

export async function verifyOwnerPin(pin: string): Promise<boolean> {
  const s = await getSetting('security');
  if (!s.pinHash || !s.pinSalt) return true;
  return hashPin(pin, s.pinSalt) === s.pinHash;
}

export async function setOwnerPin(pin: string | null): Promise<void> {
  if (!pin) {
    await setSetting('security', { pinHash: null, pinSalt: null });
    await audit('security', 'settings', null, 'Removed the owner PIN');
    return;
  }
  const salt = newSalt();
  await setSetting('security', { pinHash: hashPin(pin, salt), pinSalt: salt });
  await audit('security', 'settings', null, 'Changed the owner PIN');
}
