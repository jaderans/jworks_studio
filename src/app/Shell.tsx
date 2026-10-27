import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Briefcase, ChevronDown, Compass, ChevronsLeft, ChevronsRight, CloudUpload, Contact, FileSignature, History, LayoutGrid, Layers, ListChecks, Megaphone, Menu, Monitor,
  Moon, RefreshCw, Settings, Sun, Users, Wallet, WifiOff, type LucideIcon,
} from 'lucide-react';
import mark from '../assets/brand/mark.png';
import lockupLight from '../assets/brand/lockup-on-light.png';
import lockupDark from '../assets/brand/lockup-on-dark.png';
import { useApp, type Permission } from './AppContext';
import { applyUpdate, usePwaUpdateReady } from './usePwa';
import { useAudit, useClients, useMembers, usePendingCount, usePosts, useSettingRows } from '../hooks/data';
import { settingValue } from '../db/settings';
import { setLocal } from '../db/local';
import { Dialog } from '../components/Dialog';
import { Popover } from '../components/Popover';
import { Badge, Button, Callout, Initials } from '../components/ui';
import { Field, TextInput } from '../components/form';
import { ROLE_LABEL, makeOwner, restoreOwner } from '../services/team';
import { normalizeStage, stageLabel } from '../domain/clients';
import { relativeTime } from '../lib/time';
import { applyTheme, getTheme, setTheme, type ThemeMode } from '../lib/theme';
import { useSyncStatus } from '../sync/useSync';
import { ACTIVITY_LABELS, activityTone } from '../features/activity/labels';
import { ErrorBoundary } from './ErrorBoundary';
import { FirstRun } from '../features/welcome/WelcomeGuide';

interface Tab {
  to: string;
  label: string;
  perm?: Permission;
  end?: boolean;
}

/** One sidebar entry. Its pages share a tab strip, so the menu stays short. */
export interface Section {
  id: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  perm?: Permission;
  to: string;
  /** Paths that belong to this section. */
  match: string[];
  tabs?: Tab[];
}

export const SECTIONS: Section[] = [
  { id: 'home', label: 'Dashboard', short: 'Home', icon: LayoutGrid, to: '/', match: ['/', '/me', '/activity'] },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: Briefcase,
    perm: 'jobs',
    to: '/jobs',
    match: ['/jobs'],
    tabs: [
      { to: '/jobs', label: 'Job board', end: true },
      { to: '/jobs/list', label: 'All jobs' },
      { to: '/jobs/deadlines', label: 'Deadlines' },
      { to: '/jobs/workload', label: 'Workload' },
    ],
  },
  { id: 'clients', label: 'Clients', icon: Contact, perm: 'clients', to: '/clients', match: ['/clients'] },
  {
    id: 'money',
    label: 'Money',
    icon: Wallet,
    perm: 'money',
    to: '/money/invoices',
    match: ['/money'],
    tabs: [
      { to: '/money/invoices', label: 'Invoices' },
      { to: '/money/payments', label: 'Payments' },
      { to: '/money/payouts', label: 'Payouts' },
      { to: '/money/expenses', label: 'Expenses' },
      { to: '/money/reports', label: 'Reports' },
      { to: '/money/bir', label: 'BIR' },
    ],
  },
  {
    id: 'docs',
    label: 'Documents',
    short: 'Docs',
    icon: FileSignature,
    perm: 'money',
    to: '/docs/quotes',
    match: ['/docs', '/packages', '/contracts'],
    tabs: [
      { to: '/docs/quotes', label: 'Quotes' },
      { to: '/docs/contracts', label: 'Contracts' },
      { to: '/docs/prices', label: 'Price list' },
      { to: '/docs/templates', label: 'Contract templates' },
      { to: '/docs/rates', label: 'Team rates' },
    ],
  },
  { id: 'mypay', label: 'My pay', icon: Wallet, perm: 'mypay', to: '/mypay', match: ['/mypay'] },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    perm: 'content',
    to: '/calendar',
    match: ['/calendar', '/board', '/ideas', '/campaigns', '/trends', '/results', '/assistant'],
    tabs: [
      { to: '/calendar', label: 'Calendar' },
      { to: '/board', label: 'Content board' },
      { to: '/ideas', label: 'Ideas' },
      { to: '/campaigns', label: 'Campaigns' },
      { to: '/trends', label: 'Trends' },
      { to: '/results', label: 'Results' },
      { to: '/assistant', label: 'Assistant', perm: 'assistant' },
    ],
  },
  { id: 'team', label: 'Team', icon: Users, perm: 'team', to: '/team', match: ['/team'] },
];

/** The section a path belongs to. */
export function sectionOf(pathname: string): Section | undefined {
  const home = SECTIONS[0];
  if (home.match.includes(pathname)) return home;
  return SECTIONS.find((s) => s.id !== 'home' && s.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)));
}

const NAV_KEY = 'jwcamp-nav';
const SEEN_KEY = 'jwcamp-activity-seen';

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: it just won't be remembered */
  }
}

/** The JoshWorks lockup from the brand kit (dark text in light mode, white text in dark mode). */
function Brand({ compact }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <img className="brand-mark" src={mark} alt="" width={44} height={44} />
      {compact ? null : (
        <span className="brand-words">
          <img className="lockup only-light" src={lockupLight} alt="JoshWorks" />
          <img className="lockup only-dark" src={lockupDark} alt="" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

export function Shell() {
  const app = useApp();
  const [scopePicker, setScopePicker] = useState(false);
  const [userPicker, setUserPicker] = useState(false);
  const [more, setMore] = useState(false);
  const [guide, setGuide] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(getTheme());
  const [navMode, setNavMode] = useState<'full' | 'rail'>(() => (readPref(NAV_KEY) === 'rail' ? 'rail' : 'full'));
  const business = settingValue(useSettingRows(), 'business');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('auto');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);

  const sections = SECTIONS.filter((s) => !s.perm || app.can(s.perm));
  const current = sectionOf(location.pathname);
  const tabs = (current?.tabs ?? []).filter((t) => !t.perm || app.can(t.perm));
  const marketing = current?.id === 'marketing';
  // Phones: four tabs picked for the role, the rest under More.
  const phoneIds = app.can('money') ? ['home', 'jobs', 'money', 'marketing'] : ['home', 'jobs', 'marketing', 'mypay'];
  const primary = phoneIds.map((id) => sections.find((s) => s.id === id)).filter((s): s is Section => !!s);
  const moreSections = sections.filter((s) => !primary.includes(s));
  const moreItems = [
    ...moreSections.map((s) => ({ key: s.id, label: s.label, icon: s.icon, to: s.to })),
    { key: 'settings', label: 'Settings', icon: Settings, to: '/settings' },
    ...(app.can('activity') ? [{ key: 'activity', label: 'Activity', icon: History, to: '/activity' }] : []),
  ];

  const pickTheme = (m: ThemeMode) => {
    setTheme(m);
    setThemeState(m);
  };
  const toggleNav = () => {
    const next = navMode === 'full' ? 'rail' : 'full';
    setNavMode(next);
    writePref(NAV_KEY, next);
  };
  const scopeLabel = app.scope === 'all' ? 'All brands' : app.scope === 'own' ? business.name || 'JoshWorks' : (app.scopeClient?.name ?? 'Client');
  const isActive = (s: Section) => current?.id === s.id;

  return (
    <div className="shell" data-nav={navMode}>
      <aside className="sidebar">
        <Link to="/" className="side-brand" aria-label="JoshWorks Studio home">
          <Brand compact={navMode === 'rail'} />
        </Link>
        <nav className="side-nav" aria-label="Main">
          {sections.map((s) => (
            <NavLink key={s.id} to={s.to} className={() => `nav-item${isActive(s) ? ' active' : ''}`} aria-current={isActive(s) ? 'page' : undefined} title={s.label}>
              <s.icon size={20} aria-hidden="true" />
              <span className="nav-label full">{s.label}</span>
              <span className="nav-label short" aria-hidden="true">
                {s.short ?? s.label}
              </span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="nav-collapse" onClick={toggleNav} aria-label={navMode === 'full' ? 'Collapse the menu' : 'Expand the menu'} title={navMode === 'full' ? 'Collapse the menu' : 'Expand the menu'}>
          {navMode === 'full' ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
          <span className="nav-label full">Collapse</span>
        </button>
      </aside>

      <header className="topbar">
        <Link to="/" className="topbar-brand" aria-label="JoshWorks Studio home">
          <img src={mark} alt="" width={34} height={34} />
        </Link>
        {marketing ? (
          <button type="button" className="event-switch" onClick={() => setScopePicker(true)} aria-label={`Showing ${scopeLabel}. Change brand`}>
            <Layers size={18} aria-hidden="true" />
            <span className="label">{scopeLabel}</span>
            {app.scopeClient ? (
              <span className="hide-phone">
                <Badge tone="teal">{stageLabel(app.scopeClient.stage)}</Badge>
              </span>
            ) : null}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        ) : (
          <span className="topbar-title">{current?.label ?? 'JoshWorks Studio'}</span>
        )}
        <div className="spacer" />
        <UpdatePill />
        <ConnectionPill />
        {app.can('activity') ? <ActivityMenu /> : null}
        <Popover
          label="Account and settings"
          buttonClass="user-chip"
          button={
            <>
              <Initials name={app.member?.name ?? 'Owner'} />
              <span className="who hide-phone">
                <b>{app.member?.name ?? 'Owner'}</b>
                <span>{ROLE_LABEL[app.role]}</span>
              </span>
              <ChevronDown size={16} aria-hidden="true" className="hide-phone" />
            </>
          }
        >
          {(close) => (
            <div className="menu">
              <div className="menu-head">
                <Initials name={app.member?.name ?? 'Owner'} size="lg" />
                <div className="grow">
                  <b>{app.member?.name ?? 'Owner'}</b>
                  <div className="muted small">{app.member?.roleLabel || ROLE_LABEL[app.role]}</div>
                </div>
                <Badge tone={app.role === 'owner' ? 'yellow' : app.role === 'manager' ? 'teal' : undefined}>{ROLE_LABEL[app.role]}</Badge>
              </div>
              <div className="menu-section">
                <span className="menu-label" id="theme-label">
                  Appearance
                </span>
                <div className="seg full" role="group" aria-labelledby="theme-label">
                  {(['light', 'dark', 'auto'] as ThemeMode[]).map((m) => (
                    <button key={m} type="button" aria-pressed={theme === m} onClick={() => pickTheme(m)}>
                      {m === 'light' ? <Sun size={15} aria-hidden="true" /> : m === 'dark' ? <Moon size={15} aria-hidden="true" /> : <Monitor size={15} aria-hidden="true" />}
                      {m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'Auto'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu-list">
                <button type="button" className="menu-item" onClick={() => { close(); setUserPicker(true); }}>
                  <Users size={18} aria-hidden="true" /> {app.locked ? 'Who’s signed in' : 'Switch person'}
                </button>
                <button type="button" className="menu-item" onClick={() => { close(); navigate('/me'); }}>
                  <ListChecks size={18} aria-hidden="true" /> My tasks
                </button>
                <button type="button" className="menu-item" onClick={() => { close(); setGuide(true); }}>
                  <Compass size={18} aria-hidden="true" /> Welcome guide
                </button>
                <button type="button" className="menu-item" onClick={() => { close(); navigate('/settings'); }}>
                  <Settings size={18} aria-hidden="true" /> Settings
                </button>
              </div>
            </div>
          )}
        </Popover>
      </header>

      <main className="main" id="main">
        {tabs.length > 1 ? (
          <nav className="section-tabs" aria-label={`${current?.label ?? ''} pages`}>
            <div className="section-tabs-inner">
              {tabs.map((t) => (
                <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive: on }) => `section-tab${on ? ' active' : ''}`}>
                  {t.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <FirstRun guideOpen={guide} setGuideOpen={setGuide} />

      <nav className="bottomnav" aria-label="Main" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
        {primary.map((s) => (
          <NavLink key={s.id} to={s.to} className={() => (isActive(s) ? 'active' : '')}>
            <s.icon size={22} aria-hidden="true" />
            <span>{s.short ?? s.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)} className={current && !primary.includes(current) ? 'active' : ''}>
          <Menu size={22} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      <Dialog open={more} onClose={() => setMore(false)} title="More" size="sm">
        <div className="card flush">
          <div className="list">
            {moreItems.map((n) => (
              <button
                key={n.key}
                type="button"
                className="list-item click more-item"
                onClick={() => {
                  setMore(false);
                  navigate(n.to);
                }}
              >
                <n.icon size={20} aria-hidden="true" />
                <span className="main-text">
                  <b>{n.label}</b>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Dialog>

      <ScopePicker open={scopePicker} onClose={() => setScopePicker(false)} ownName={business.name || 'JoshWorks'} />
      <UserPicker open={userPicker} onClose={() => setUserPicker(false)} />
    </div>
  );
}

function ActivityMenu() {
  const app = useApp();
  const audit = useAudit(8);
  const members = useMembers();
  const [seen, setSeen] = useState(() => Number(readPref(SEEN_KEY) ?? 0));
  const names = new Map((members ?? []).map((m) => [m.id, m.name]));
  // A dot means someone else changed something since you last looked.
  const fresh = (audit ?? []).some((a) => a.at > seen && a.actorId !== (app.member?.id ?? null));
  return (
    <Popover
      label="Recent activity"
      buttonClass="icon-btn activity-btn"
      onOpenChange={(open) => {
        if (!open) return;
        const now = Date.now();
        setSeen(now);
        writePref(SEEN_KEY, String(now));
      }}
      button={
        <>
          <History size={18} aria-hidden="true" />
          {fresh ? <span className="ping" aria-hidden="true" /> : null}
        </>
      }
    >
      {(close) => (
        <div className="menu activity-menu">
          <div className="menu-head between">
            <b>Recent activity</b>
            <Link to="/activity" className="small strong" onClick={close}>
              See all
            </Link>
          </div>
          {audit && audit.length === 0 ? <p className="muted small" style={{ padding: '4px 14px 14px' }}>Nothing yet. New posts, status changes and approvals show up here.</p> : null}
          <div className="menu-list">
            {(audit ?? []).map((a) => (
              <div key={a.id} className="act-row">
                <Badge tone={activityTone(a.action)}>{ACTIVITY_LABELS[a.action] ?? a.action}</Badge>
                <div className="grow">
                  <div className="act-text">{a.summary}</div>
                  <div className="muted tiny">
                    {relativeTime(a.at)}
                    {a.actorId ? ` · ${names.get(a.actorId) ?? 'someone'}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Stays in the top bar until the new version is loaded. */
function UpdatePill() {
  const ready = usePwaUpdateReady();
  if (!ready) return null;
  return (
    <button type="button" className="status-pill update" onClick={applyUpdate} title="A new version of the app is ready. Reload to use it.">
      <RefreshCw size={14} aria-hidden="true" />
      <span>
        Update<span className="hide-phone"> ready · Reload</span>
      </span>
    </button>
  );
}

function ConnectionPill() {
  const app = useApp();
  const pending = usePendingCount() ?? 0;
  const sync = useSyncStatus();
  if (!app.online) {
    return (
      <span className="status-pill offline" title="Everything still works. Changes are saved on this device.">
        <span className="dot" />
        <WifiOff size={14} aria-hidden="true" />
        <span className="hide-phone">Offline{sync.enabled && pending ? ` · ${pending} waiting` : ''}</span>
      </span>
    );
  }
  if (sync.enabled) {
    const busy = sync.state === 'syncing';
    return (
      <span
        className={`status-pill ${sync.state === 'error' || sync.refused ? 'error' : busy ? 'busy' : 'online'}`}
        title={sync.refused ? `${sync.refused} change${sync.refused === 1 ? '' : 's'} the cloud refused. They are kept on this device; the owner may need to publish the latest security rules (Settings → Cloud sync).` : sync.message}
      >
        <span className="dot" />
        <CloudUpload size={14} aria-hidden="true" />
        <span className="hide-phone">{sync.state === 'error' ? 'Sync problem' : sync.refused ? `${sync.refused} not synced` : pending ? `${pending} to sync` : 'Synced'}</span>
      </span>
    );
  }
  return (
    <span className="status-pill online hide-tablet" title="Online. Cloud sync is not set up, so data stays on this device.">
      <span className="dot" />
      On this device
    </span>
  );
}

function ScopePicker({ open, onClose, ownName }: { open: boolean; onClose: () => void; ownName: string }) {
  const app = useApp();
  const clients = useClients();
  const navigate = useNavigate();
  const posts = usePosts();
  // Brands with content on the calendar: the clients whose social media we run.
  const withPosts = new Set((posts ?? []).map((p) => p.clientId).filter(Boolean));
  const visible = (clients ?? []).filter((c) => withPosts.has(c.id) || (normalizeStage(c.stage) === 'active' && !!c.packageId));
  const row = (key: string, label: string, sub: string, badge?: React.ReactNode) => (
    <button
      key={key}
      type="button"
      className="list-item click"
      style={{ border: 0, borderBottom: '1px solid var(--line)', background: app.scope === key ? 'var(--teal-soft)' : 'none', textAlign: 'left', width: '100%' }}
      onClick={() => {
        app.setScope(key);
        onClose();
      }}
    >
      <Layers size={20} aria-hidden="true" />
      <span className="main-text">
        <b>{label}</b>
        <span>{sub}</span>
      </span>
      {badge}
    </button>
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Whose content?"
      footer={
        app.can('clients') ? (
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              navigate('/clients?new=1');
            }}
          >
            Add a client
          </Button>
        ) : undefined
      }
    >
      <p className="muted small">The calendar, board, campaigns and results show what you pick here.</p>
      <div className="card flush">
        <div className="list">
          {row('all', 'All brands', 'JoshWorks and every client')}
          {row('own', ownName, 'Our own pages')}
          {visible.map((c) => row(c.id, c.name, c.industry || 'Client', <Badge tone={normalizeStage(c.stage) === 'active' ? 'good' : 'teal'}>{stageLabel(c.stage)}</Badge>))}
        </div>
      </div>
    </Dialog>
  );
}

function UserPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const members = useMembers();
  const hasPin = !!settingValue(useSettingRows(), 'security').pinHash;
  const active = (members ?? []).filter((m) => m.active === 1 && (!app.locked || m.id === app.member?.id));
  const noOwner = !app.locked && !!members && !members.some((m) => m.active === 1 && m.appRole === 'owner');
  return (
    <Dialog open={open} onClose={onClose} title="Who's using this device?">
      {app.locked ? (
        <p className="muted small">This device is signed in to the team as {app.member?.name ?? 'you'}. To use another account, sign out in Settings → Cloud sync.</p>
      ) : noOwner ? (
        <RestoreOwner onDone={onClose} />
      ) : (
        <p className="muted small">
          Switching to a designer hides prices, contracts and settings on this device.{' '}
          {hasPin ? 'Switching back to the owner needs the owner PIN.' : 'You haven’t set an owner PIN, so anyone can switch back to the owner. Set one in Settings.'}
        </p>
      )}
      <div className="card flush">
        <div className="list">
          {active.map((m) => (
            <button
              key={m.id}
              type="button"
              className="list-item click"
              style={{ border: 0, borderBottom: '1px solid var(--line)', background: m.id === app.member?.id ? 'var(--teal-soft)' : 'none', textAlign: 'left', width: '100%' }}
              onClick={async () => {
                const ok = await app.switchMember(m.id);
                if (ok) {
                  app.toast(`${m.name} is using this device`, { tone: 'good' });
                  onClose();
                }
              }}
            >
              <Initials name={m.name} />
              <span className="main-text">
                <b>{m.name}</b>
                <span>{m.roleLabel || ROLE_LABEL[m.appRole]}</span>
              </span>
              <Badge tone={m.appRole === 'owner' ? 'yellow' : m.appRole === 'manager' ? 'teal' : undefined}>{ROLE_LABEL[m.appRole]}</Badge>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/** Shown when no one on the device is the owner, so the owner screens can always be reached again. */
function RestoreOwner({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (getOwnerId: () => Promise<string>) => {
    if (!(await app.askOwner('Restore the owner'))) return;
    setBusy(true);
    try {
      await setLocal('currentMemberId', await getOwnerId());
      app.toast('You’re the owner again. Check Team to tidy up names and roles.', { tone: 'good' });
      onDone();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'Could not restore the owner', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };
  const current = app.member;
  return (
    <div className="stack">
      <Callout tone="warn" title="No one on this device is the owner">
        That hides prices, contracts, the team and settings. Add yourself back as the owner; everyone else stays as they are.
      </Callout>
      <Field label="Your name" htmlFor="restore-owner">
        <TextInput id="restore-owner" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Joshua" />
      </Field>
      <div className="actions">
        <Button variant="primary" disabled={busy || !name.trim()} onClick={() => run(async () => (await restoreOwner(name)).id)}>
          Add me as the owner
        </Button>
        {current ? (
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await makeOwner(current.id);
                return current.id;
              })
            }
          >
            Make {current.name} the owner
          </Button>
        ) : null}
      </div>
    </div>
  );
}
