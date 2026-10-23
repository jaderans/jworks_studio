import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Link2Off } from 'lucide-react';
import lockup from '../../assets/brand/lockup-on-light.png';
import { Loading } from '../../components/ui';
import { readLinkData, type LinkData } from '../../sync/config';
import { ClientLinkView } from './ClientLinkView';
import type { LinkKind, LinkResponse, LinkSnapshot } from '../../domain/clientLink';

/**
 * Where a client link lands (#/c?d=…): no account, no app setup. It reads the
 * one shared document the link points to and sends back the client's answers
 * (and signature). The cloud rules allow nothing else.
 */

type Shared = { kind: LinkKind; status: 'open' | 'responded' | 'applied' | 'off'; expiresAt?: { toMillis(): number }; snapshot: LinkSnapshot };

async function linkDoc(d: LinkData) {
  const [{ getApps, initializeApp }, fsMod] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
  const { emulator, ...options } = d.f;
  const name = `jw-client-${d.f.projectId}`;
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? initializeApp(options, name);
  const fs = existing ? fsMod.getFirestore(app) : fsMod.initializeFirestore(app, { localCache: fsMod.memoryLocalCache(), ignoreUndefinedProperties: true });
  if (!existing && emulator) fsMod.connectFirestoreEmulator(fs, emulator.host, emulator.firestorePort);
  const ref = fsMod.doc(fs, 'camp', d.w, 'share', d.t);
  return {
    read: async () => {
      const snap = await fsMod.getDoc(ref);
      return snap.exists() ? (snap.data() as Shared) : null;
    },
    send: (response: LinkResponse) => fsMod.updateDoc(ref, { status: 'responded', respondedAt: fsMod.serverTimestamp(), response }),
  };
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="client-link">
      <img src={lockup} alt="JoshWorks" style={{ height: 44, width: 'auto' }} />
      <section className="card pad-lg stack">
        <h1 className="row" style={{ gap: 10 }}>
          {icon} {title}
        </h1>
        <p>{children}</p>
      </section>
    </div>
  );
}

export function ClientLinkPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<{ phase: 'loading' } | { phase: 'bad' } | { phase: 'ready'; shared: Shared; send: (r: LinkResponse) => Promise<void> }>({ phase: 'loading' });

  useEffect(() => {
    const d = readLinkData(params.get('d'));
    if (!d) {
      setState({ phase: 'bad' });
      return;
    }
    let live = true;
    linkDoc(d)
      .then(async (l) => {
        const shared = await l.read();
        if (!live) return;
        setState(shared ? { phase: 'ready', shared, send: async (r) => void (await l.send(r)) } : { phase: 'bad' });
      })
      .catch(() => live && setState({ phase: 'bad' }));
    return () => {
      live = false;
    };
  }, [params]);

  if (state.phase === 'loading') return <Loading />;
  const contact = 'Please message JoshWorks for a new link.';
  if (state.phase === 'bad')
    return (
      <Message icon={<Link2Off size={26} />} title="This link doesn’t work">
        It may be incomplete or no longer exist. {contact}
      </Message>
    );
  const { shared, send } = state;
  if (shared.status === 'responded' || shared.status === 'applied')
    return (
      <Message icon={<CheckCircle2 size={26} className="teal" />} title="Already received">
        Thank you! JoshWorks already has your {shared.kind === 'sign' ? 'signed contract' : 'answers'}.
      </Message>
    );
  if (shared.status === 'off')
    return (
      <Message icon={<Link2Off size={26} />} title="This link was turned off">
        JoshWorks may have sent you a newer one. {contact}
      </Message>
    );
  if (shared.expiresAt && shared.expiresAt.toMillis() < Date.now())
    return (
      <Message icon={<Link2Off size={26} />} title="This link has expired">
        The prices in it are no longer held. {contact}
      </Message>
    );
  return <ClientLinkView snapshot={shared.snapshot} kind={shared.kind} onSubmit={send} />;
}
