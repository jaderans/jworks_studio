import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AppProvider, useApp, type Permission } from './AppContext';
import { Shell } from './Shell';
import { SetupWizard } from '../features/setup/SetupWizard';
import { isSetupDone } from '../services/setup';
import { EmptyState, Loading } from '../components/ui';
import { usePwaUpdates } from './usePwa';
import { clearLanding, peekLanding } from './landing';
import { startSync } from '../sync/engine';
import { expireTrends, fetchFeed } from '../services/growth';
import { readAuthAction } from '../features/join/authAction';

const JoinPage = lazy(() => import('../features/join/JoinPage').then((m) => ({ default: m.JoinPage })));
const AuthActionPage = lazy(() => import('../features/join/AuthActionPage').then((m) => ({ default: m.AuthActionPage })));
const ClientLinkPage = lazy(() => import('../features/clientlink/ClientLinkPage').then((m) => ({ default: m.ClientLinkPage })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const CalendarPage = lazy(() => import('../features/calendar/CalendarPage'));
const BoardPage = lazy(() => import('../features/board/BoardPage'));
const IdeasPage = lazy(() => import('../features/ideas/IdeasPage'));
const CampaignsPage = lazy(() => import('../features/campaigns/CampaignsPage'));
const TrendsPage = lazy(() => import('../features/trends/TrendsPage'));
const ResultsPage = lazy(() => import('../features/results/ResultsPage'));
const AssistantPage = lazy(() => import('../features/assistant/AssistantPage'));
const ClientsPage = lazy(() => import('../features/clients/ClientsPage'));
const JobsPage = lazy(() => import('../features/jobs/JobsPage'));
const MoneyPage = lazy(() => import('../features/money/MoneyPage'));
const DocsPage = lazy(() => import('../features/docs/DocsPage'));
const MyPayPage = lazy(() => import('../features/mypay/MyPayPage'));
const TeamPage = lazy(() => import('../features/team/TeamPage'));
const MyTasksPage = lazy(() => import('../features/me/MyTasksPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const ActivityPage = lazy(() => import('../features/activity/ActivityPage'));

export function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Gate />
      </AppProvider>
    </HashRouter>
  );
}

function Gate() {
  // A link from a Firebase email (confirm the email, reset the password) opens its own page, set up or not.
  const [authAction] = useState(readAuthAction);
  const [done, setDone] = useState<boolean | null>(null);
  const location = useLocation();
  const app = useApp();
  const navigate = useNavigate();
  usePwaUpdates();
  // A client answered or signed through their link (merged by sync/clientLinks.ts).
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ contractId: string; summary: string }>).detail;
      app.toast(d.summary, { tone: 'good', ms: 15_000, action: { label: 'Open', onClick: () => navigate(`/docs/contracts?open=${d.contractId}`) } });
    };
    window.addEventListener('jw-client-response', on);
    return () => window.removeEventListener('jw-client-response', on);
  }, [app, navigate]);
  useEffect(() => {
    isSetupDone().then(setDone);
  }, []);
  useEffect(() => {
    if (!done) return;
    void startSync();
    // The weekly trend report ships with the app; pick up a new one and retire stale trends.
    void fetchFeed();
    void expireTrends();
  }, [done]);
  if (authAction)
    return (
      <Lazy>
        <AuthActionPage action={authAction} />
      </Lazy>
    );
  // A client link (questionnaire or contract to sign): no account and no setup needed.
  if (location.pathname === '/c')
    return (
      <Lazy>
        <ClientLinkPage />
      </Lazy>
    );
  if (done === null) return <Loading />;
  if (location.pathname === '/join')
    return (
      <Lazy>
        <JoinPage
          onJoined={() => {
            setDone(true);
            window.location.hash = '#/';
          }}
        />
      </Lazy>
    );
  if (!done) return <SetupWizard onDone={() => setDone(true)} />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="calendar" element={<Guard perm="content"><Lazy><CalendarPage /></Lazy></Guard>} />
        <Route path="board" element={<Guard perm="content"><Lazy><BoardPage /></Lazy></Guard>} />
        <Route path="ideas/*" element={<Guard perm="content"><Lazy><IdeasPage /></Lazy></Guard>} />
        <Route path="campaigns/*" element={<Guard perm="content"><Lazy><CampaignsPage /></Lazy></Guard>} />
        <Route path="trends/*" element={<Guard perm="content"><Lazy><TrendsPage /></Lazy></Guard>} />
        <Route path="results" element={<Guard perm="content"><Lazy><ResultsPage /></Lazy></Guard>} />
        <Route path="assistant" element={<Guard perm="assistant"><Lazy><AssistantPage /></Lazy></Guard>} />
        <Route path="clients/*" element={<Guard perm="clients"><Lazy><ClientsPage /></Lazy></Guard>} />
        <Route path="jobs/*" element={<Guard perm="jobs"><Lazy><JobsPage /></Lazy></Guard>} />
        <Route path="money/*" element={<Guard perm="money"><Lazy><MoneyPage /></Lazy></Guard>} />
        <Route path="docs/*" element={<Guard perm="money"><Lazy><DocsPage /></Lazy></Guard>} />
        <Route path="mypay" element={<Guard perm="mypay"><Lazy><MyPayPage /></Lazy></Guard>} />
        {/* Old links (bookmarks, older builds) land on the new pages. */}
        <Route path="packages" element={<Moved to="/docs/prices" />} />
        <Route path="packages/proposals" element={<Moved to="/docs/quotes" />} />
        <Route path="packages/rates" element={<Moved to="/docs/rates" />} />
        <Route path="packages/*" element={<Moved to="/docs/prices" />} />
        <Route path="contracts/*" element={<Moved to="/docs/contracts" />} />
        <Route path="team" element={<Guard perm="team"><Lazy><TeamPage /></Lazy></Guard>} />
        <Route path="me" element={<Lazy><MyTasksPage /></Lazy>} />
        <Route path="activity" element={<Guard perm="activity"><Lazy><ActivityPage /></Lazy></Guard>} />
        <Route path="settings" element={<Lazy><SettingsPage /></Lazy>} />
        <Route path="*" element={<div className="page"><EmptyState title="Page not found">That link doesn&rsquo;t go anywhere in the app.</EmptyState></div>} />
      </Route>
    </Routes>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function Home() {
  const app = useApp();
  // Decide once: later re-renders (sync status, live queries) must not change where we go.
  const [landing] = useState(() => peekLanding());
  useEffect(() => clearLanding(), []);
  if (landing && landing !== '/') return <Navigate to={landing} replace />;
  if (app.can('dashboard'))
    return (
      <Lazy>
        <DashboardPage />
      </Lazy>
    );
  return <Navigate to="/me" replace />;
}

/** Redirect an old path, keeping its ?query (client=, proposal=). */
function Moved({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const app = useApp();
  if (!app.can(perm)) {
    return (
      <div className="page narrow">
        <EmptyState title="Not available for your role">Ask the owner if you need this. Switch who&rsquo;s using this device from the top right.</EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}
