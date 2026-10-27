import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { db } from '../db/db';
import { ensureDevice, setLocal, type DeviceInfo } from '../db/local';
import { setActor, setWriterDevice } from '../db/write';
import { useClients, useLocal, useMembers, useOnline } from '../hooks/data';
import { hasOwnerPin, verifyOwnerPin } from '../services/team';
import { useSyncStatus } from '../sync/useSync';
import { Dialog } from '../components/Dialog';
import { Button } from '../components/ui';
import type { AppRole, Client, Member } from '../db/types';

export type Permission =
  | 'dashboard'
  | 'content'
  | 'editCampaigns'
  | 'clients'
  | 'money'
  | 'team'
  | 'settings'
  | 'activity'
  | 'import'
  | 'assistant'
  /** See jobs and update their progress. */
  | 'jobs'
  /** Plan jobs: create, assign, set dates (owner and managers). */
  | 'editJobs'
  /** A designer's own pay and payout details. */
  | 'mypay';

const STUDIO: Permission[] = ['dashboard', 'content', 'editCampaigns', 'clients', 'money', 'activity', 'assistant', 'jobs', 'editJobs'];

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  owner: [...STUDIO, 'team', 'settings', 'import'],
  // Managers are the studio's designers too: everything happening at the studio, plus their own pay.
  manager: [...STUDIO, 'mypay'],
  designer: ['dashboard', 'content', 'assistant', 'jobs', 'mypay'],
};

/** Whose content the calendar, board and results show: everyone's, JoshWorks' own pages, or one client. */
export type Scope = 'all' | 'own' | string;

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}

interface ToastOptions {
  tone?: 'good' | 'bad' | 'info';
  action?: { label: string; onClick: () => void };
  ms?: number;
}

interface AppState {
  device: DeviceInfo;
  refreshDevice: () => Promise<void>;
  member: Member | null;
  role: AppRole;
  switchMember: (memberId: string) => Promise<boolean>;
  can: (p: Permission) => boolean;
  locked: boolean;
  askOwner: (reason: string) => Promise<boolean>;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, o?: ToastOptions) => void;
  online: boolean;
  scope: Scope;
  setScope: (s: Scope) => void;
  scopeClient: Client | null;
  /** Does a record's clientId belong to the current scope? */
  inScope: (clientId: string | null) => boolean;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [deviceReady, setDeviceReady] = useState(false);
  const online = useOnline();
  const members = useMembers();
  const clients = useClients();
  const device = useLocal<DeviceInfo | null>('device', null);
  const memberIdLive = useLocal<string | null>('currentMemberId', null);
  const scope = useLocal<Scope>('scope', 'all') ?? 'all';
  const sync = useSyncStatus();
  // Signed in to the team as a non-owner: the account decides who this is and what they can do.
  const cloudLock = sync.access && sync.access.role !== 'owner' ? sync.access : null;
  const memberId = cloudLock ? cloudLock.memberId : (memberIdLive ?? null);
  const ready = deviceReady && !!device && memberIdLive !== undefined;

  useEffect(() => {
    ensureDevice().then(() => setDeviceReady(true));
  }, []);
  useEffect(() => {
    if (device) setWriterDevice(device.deviceId);
  }, [device]);

  const member = useMemo(() => members?.find((m) => m.id === memberId && m.active === 1) ?? null, [members, memberId]);
  // With no member chosen yet (fresh device), the device behaves as the owner's.
  const role: AppRole = cloudLock ? cloudLock.role : (member?.appRole ?? 'owner');

  useEffect(() => setActor(member?.id ?? null), [member]);

  const scopeClient = useMemo(() => (scope !== 'all' && scope !== 'own' ? (clients?.find((c) => c.id === scope) ?? null) : null), [scope, clients]);
  // A client deleted elsewhere stops being the scope.
  useEffect(() => {
    if (scope !== 'all' && scope !== 'own' && clients && !clients.some((c) => c.id === scope)) void setLocal('scope', 'all');
  }, [scope, clients]);

  // ----- toasts -----
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const toast = useCallback((message: string, o: ToastOptions = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, ...o }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), o.ms ?? (o.tone === 'bad' ? 6000 : o.action ? 7000 : 3200));
  }, []);

  // ----- confirm -----
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), []);
  const closeConfirm = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  // ----- owner PIN (a shared studio computer) -----
  const unlockedUntil = useRef(0);
  const [pinState, setPinState] = useState<{ reason: string; resolve: (v: boolean) => void } | null>(null);
  const askOwner = useCallback(
    async (reason: string) => {
      if (role === 'owner') return true;
      if (Date.now() < unlockedUntil.current) return true;
      if (!(await hasOwnerPin())) return true;
      return new Promise<boolean>((resolve) => setPinState({ reason, resolve }));
    },
    [role],
  );
  const finishPin = (ok: boolean) => {
    if (ok) unlockedUntil.current = Date.now() + 2 * 60 * 1000;
    pinState?.resolve(ok);
    setPinState(null);
  };

  const switchMember = useCallback(
    async (id: string) => {
      const target = await db.members.get(id);
      if (!target || cloudLock) return false;
      if (target.appRole === 'owner' && role !== 'owner' && (await hasOwnerPin())) {
        const ok = await new Promise<boolean>((resolve) => setPinState({ reason: `Switch to ${target.name} (owner)`, resolve }));
        if (!ok) return false;
      }
      await setLocal('currentMemberId', id);
      return true;
    },
    [role, cloudLock],
  );

  const refreshDevice = useCallback(async () => {
    const d = await ensureDevice();
    setWriterDevice(d.deviceId);
  }, []);

  const can = useCallback((p: Permission) => ROLE_PERMISSIONS[role].includes(p), [role]);
  const setScope = useCallback((s: Scope) => void setLocal('scope', s), []);
  const inScope = useCallback((clientId: string | null) => (scope === 'all' ? true : scope === 'own' ? clientId === null : clientId === scope), [scope]);

  if (!ready || !device) return <div className="loading">Opening JoshWorks Studio…</div>;

  const value: AppState = { device, refreshDevice, member, role, switchMember, can, locked: !!cloudLock, askOwner, confirm, toast, online, scope, setScope, scopeClient, inScope };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone ?? ''}`} role={t.tone === 'bad' ? 'alert' : 'status'}>
            {t.tone === 'good' ? <CheckCircle2 size={18} className="ic" /> : t.tone === 'bad' ? <XCircle size={18} /> : <Info size={18} />}
            <span>{t.message}</span>
            {t.action ? (
              <button type="button" onClick={t.action.onClick}>
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <Dialog
        open={!!confirmState}
        onClose={() => closeConfirm(false)}
        title={confirmState?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => closeConfirm(false)}>Cancel</Button>
            <Button variant={confirmState?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => closeConfirm(true)}>
              {confirmState?.confirmLabel ?? 'Continue'}
            </Button>
          </>
        }
      >
        {typeof confirmState?.message === 'string' ? <p>{confirmState.message}</p> : confirmState?.message}
      </Dialog>
      <PinDialog state={pinState} onDone={finishPin} />
    </Ctx.Provider>
  );
}

function PinDialog({ state, onDone }: { state: { reason: string } | null; onDone: (ok: boolean) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPin('');
    setError('');
  }, [state]);

  const submit = async (value = pin) => {
    if (!value) return;
    setBusy(true);
    const ok = await verifyOwnerPin(value);
    setBusy(false);
    if (ok) onDone(true);
    else {
      setError('That PIN is not right. Try again.');
      setPin('');
    }
  };

  return (
    <Dialog
      open={!!state}
      onClose={() => onDone(false)}
      title="Owner PIN"
      size="sm"
      footer={
        <>
          <Button onClick={() => onDone(false)}>Cancel</Button>
          <Button variant="primary" disabled={!pin || busy} onClick={() => submit()}>
            Confirm
          </Button>
        </>
      }
    >
      <p className="muted">{state?.reason}. Ask the owner to enter their PIN.</p>
      <input
        className="input center"
        style={{ fontSize: '1.6rem', letterSpacing: '0.5em', fontWeight: 800 }}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        aria-label="Owner PIN"
        value={pin}
        autoFocus
        onChange={(e) => {
          setError('');
          setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
      />
      {error ? <p className="bad strong small" role="alert">{error}</p> : null}
    </Dialog>
  );
}
