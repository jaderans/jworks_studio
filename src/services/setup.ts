import { db } from '../db/db';
import { audit, build, setActor } from '../db/write';
import { getLocal, setLocal, updateDevice } from '../db/local';
import { DEFAULT_BUSINESS, DEFAULT_VOICE, setSetting } from '../db/settings';
import { hashPin, newSalt } from '../lib/hash';
import { mergeBackup, type BackupFile } from './backup';
import { skillsFromRole } from './team';
import { loadCatalog } from './catalog';
import type { Member, Snippet } from '../db/types';

export const isSetupDone = () => getLocal<boolean>('setupDone', false);

/** Starter caption blocks, in the JoshWorks voice; the planner import adds the team's own. */
export const SEED_SNIPPETS: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { kind: 'hashtags', label: 'Every post (base set)', text: '#JoshWorks #GraphicDesign #DesignStudio #Branding', useFor: 'Every post', notes: 'Instagram takes 5 at most: base set + 1 niche tag.', sort: 0 },
  { kind: 'cta', label: 'CTA – leads', text: 'Need this for your brand? DM us “START” and we’ll send the rate sheet.', useFor: 'Portfolio and rebrand posts', notes: '', sort: 1 },
  { kind: 'cta', label: 'CTA – saves', text: 'Save this for your next project. You’ll thank yourself later.', useFor: 'Educational carousels', notes: '', sort: 2 },
  { kind: 'cta', label: 'CTA – shares', text: 'Send this to a friend who’s building a brand.', useFor: 'Educational and fun posts (sends grow reach)', notes: '', sort: 3 },
  { kind: 'disclaimer', label: 'WHAT IF disclaimer', text: 'Unofficial concept only: a fan redesign by our team. Not affiliated with or commissioned by [name].', useFor: 'Every WHAT IF post', notes: 'Required.', sort: 4 },
];

export interface SetupInput {
  businessName: string;
  ownerName: string;
  ownerRole: string;
  pin: string;
  deviceName: string;
  seedPackages: boolean;
}

/** First launch on the owner's device. */
export async function runSetup(input: SetupInput): Promise<string> {
  const salt = newSalt();
  const owner = build<Member>({
    name: input.ownerName.trim() || 'Owner',
    email: '',
    appRole: 'owner',
    roleLabel: input.ownerRole.trim() || 'Creative Director',
    skills: skillsFromRole(input.ownerRole),
    color: 0,
    active: 1,
    notes: '',
  });
  await db.transaction('rw', [db.settings, db.members, db.packages, db.contractTemplates, db.snippets, db.audit, db.local], async () => {
    await setSetting('business', { ...DEFAULT_BUSINESS, name: input.businessName.trim() || 'JoshWorks' });
    await setSetting('voice', DEFAULT_VOICE);
    await setSetting('security', input.pin ? { pinHash: hashPin(input.pin, salt), pinSalt: salt } : { pinHash: null, pinSalt: null });
    await db.members.put(owner);
    if (input.seedPackages) await loadCatalog({ archiveOld: false });
    if ((await db.snippets.count()) === 0) await db.snippets.bulkPut(SEED_SNIPPETS.map((s, i) => build<Snippet>({ ...s, id: `seed-snip-${i + 1}` })));
    await updateDevice({ name: input.deviceName || 'Main device' });
    await setLocal('currentMemberId', owner.id);
    await setLocal('setupDone', true);
    setActor(owner.id);
    await audit('setup', 'app', null, `Set up JoshWorks Studio for ${input.businessName || 'JoshWorks'}`);
  });
  return owner.id;
}

/** A device joining by invite: everything arrives through cloud sync. */
export async function runJoinSetup(deviceName: string): Promise<void> {
  await updateDevice({ name: deviceName || 'Team device' });
  await setLocal('setupDone', true);
}

/** Start this device from a backup file (new phone or browser). */
export async function runRestoreSetup(file: BackupFile, deviceName: string): Promise<Member | null> {
  await mergeBackup(file, { markForUpload: true });
  await updateDevice({ name: deviceName || 'This device' });
  const members = (file.tables.members ?? []) as Member[];
  const owner = members.find((m) => m.deleted !== 1 && m.active === 1 && m.appRole === 'owner') ?? null;
  if (owner) {
    await setLocal('currentMemberId', owner.id);
    setActor(owner.id);
  }
  await setLocal('setupDone', true);
  await audit('setup', 'app', null, `Restored from a backup of ${file.device?.name ?? 'another device'}`);
  return owner;
}
