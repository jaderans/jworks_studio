import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Briefcase, Contact, FileSignature, LayoutGrid, Megaphone, Wallet, Coins, type LucideIcon } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { Button, Callout } from '../../components/ui';
import { Dialog } from '../../components/Dialog';
import { getLocal, setLocal } from '../../db/local';
import { useSyncStatus } from '../../sync/useSync';
import { ChoosePassword } from '../../sync/ChoosePassword';
import type { AppRole } from '../../db/types';

/**
 * A new person's first minutes in the app: choose their own password (when
 * they signed in with the owner's temporary one), then a short guide to what
 * JoshWorks Studio is for and what each part does. The guide shows once per
 * person on each device, and anytime from the account menu.
 */

interface Part {
  icon: LucideIcon;
  name: string;
  text: string;
  roles: AppRole[];
}

const PARTS: Part[] = [
  { icon: LayoutGrid, name: 'Dashboard', text: 'Today at a glance: deadlines, what needs attention, and how the month is going.', roles: ['owner', 'manager', 'designer'] },
  { icon: Briefcase, name: 'Jobs', text: 'Every commission from inquiry to paid. Drag a card to change its status; open a job for its brief, dates, revisions, files and team split.', roles: ['owner', 'manager', 'designer'] },
  { icon: Contact, name: 'Clients', text: 'Everyone we work with, with each client’s jobs, quotes, contracts, invoices and payments in one place.', roles: ['owner', 'manager'] },
  { icon: FileSignature, name: 'Documents', text: 'Quotes from the price list, contracts with the client’s questionnaire, and client links to answer and sign online.', roles: ['owner', 'manager'] },
  { icon: Coins, name: 'Money', text: 'Invoices, payments and receipts, designer payouts (each share after the 5% deduction), expenses, reports and BIR.', roles: ['owner', 'manager'] },
  { icon: Megaphone, name: 'Marketing', text: 'The content calendar, board, ideas, campaigns, trends and results for JoshWorks and the clients whose pages we run.', roles: ['owner', 'manager', 'designer'] },
  { icon: Wallet, name: 'My pay', text: 'What you’ve earned from each job and what’s been paid out. Add where you want to be paid (GCash or bank).', roles: ['manager', 'designer'] },
];

const ROLE_LINE: Record<AppRole, string> = {
  owner: 'As the owner you run everything, including the team and settings.',
  manager: 'As a Manager you see and run everything happening at the studio. Only the owner changes the team and settings.',
  designer: 'As a Designer you see your jobs, the content calendar and your own pay.',
};

const welcomedKey = (memberId: string) => `welcomed:${memberId}`;

export function WelcomeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const role = app.role;
  const first = app.member?.name?.split(' ')[0];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      fullPhone
      title={`Welcome to JoshWorks Studio${first ? `, ${first}` : ''}!`}
      footer={
        <>
          {app.can('mypay') ? (
            <Button
              onClick={() => {
                onClose();
                navigate('/mypay');
              }}
            >
              <Wallet size={16} /> Set where I get paid
            </Button>
          ) : null}
          <span className="grow" />
          <Button variant="primary" onClick={onClose}>
            Let’s go
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>
          This is the studio’s shared workspace. Every commission, from the first message to the final payment, lives here, together with our clients, documents, money and marketing. It works on your phone and laptop, even offline, and syncs with the team.
        </p>
        <p className="small strong teal">{ROLE_LINE[role]}</p>
        <div className="welcome-grid">
          {PARTS.filter((p) => p.roles.includes(role)).map((p) => (
            <div key={p.name} className="welcome-part">
              <p.icon size={20} className="teal" aria-hidden="true" />
              <div>
                <b>{p.name}</b>
                <span className="small muted">{p.text}</span>
              </div>
            </div>
          ))}
        </div>
        <Callout tone="info" title="House rules">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Keep client details, prices and contracts inside the team.</li>
            <li>Update a job’s status as you work, so everyone sees where things stand.</li>
            <li>Changes save on your device first and sync when you’re online. The Activity log shows who changed what.</li>
          </ul>
        </Callout>
        <p className="tiny muted">Install it like an app: on iPhone, Share → Add to Home Screen; on Android, menu ⋮ → Install app. You can open this guide again from your name at the top right.</p>
      </div>
    </Dialog>
  );
}

/** Shown in the app shell: the password step first, then the guide once. */
export function FirstRun({ guideOpen, setGuideOpen }: { guideOpen: boolean; setGuideOpen: (v: boolean) => void }) {
  const app = useApp();
  const sync = useSyncStatus();
  const mustChange = !!sync.access?.mustChangePassword;
  const memberId = app.member?.id;
  const [checked, setChecked] = useState<string | null>(null);

  useEffect(() => {
    if (mustChange || !memberId || app.role === 'owner' || checked === memberId) return;
    setChecked(memberId);
    void getLocal<number | null>(welcomedKey(memberId), null).then((seen) => {
      if (!seen) setGuideOpen(true);
    });
  }, [mustChange, memberId, app.role, checked, setGuideOpen]);

  if (mustChange)
    return (
      <Dialog open locked onClose={() => undefined} title="Choose your own password">
        <ChoosePassword onDone={() => app.toast('Password saved. Welcome!', { tone: 'good' })} />
      </Dialog>
    );
  return (
    <WelcomeGuide
      open={guideOpen}
      onClose={() => {
        setGuideOpen(false);
        if (memberId) void setLocal(welcomedKey(memberId), Date.now());
      }}
    />
  );
}
