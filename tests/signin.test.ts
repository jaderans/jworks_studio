import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInCloud, linkRoute, readInvite, studioCloudValue, teamSignInLink, type CloudConfig } from '../src/sync/config';

const cfg: CloudConfig = {
  firebase: { apiKey: 'AIza-test', authDomain: 'jw-test.firebaseapp.com', projectId: 'jw-test', appId: '1:2:web:3', emulator: { host: '127.0.0.1', authPort: 9099, firestorePort: 8080 } },
  ws: 'joshworks',
};

beforeEach(() => vi.stubGlobal('location', { origin: 'https://jaderans.github.io', pathname: '/jworks_studio/' }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('the team sign-in link', () => {
  it('is one link for everyone that opens Sign in and carries the studio cloud', () => {
    const link = teamSignInLink(cfg);
    expect(link.startsWith('https://jaderans.github.io/jworks_studio/#/login?i=')).toBe(true);
    const invite = readInvite(new URLSearchParams(link.split('?')[1]).get('i'));
    expect(invite?.c.ws).toBe('joshworks');
    expect(invite?.c.firebase.projectId).toBe('jw-test');
    // No name or email: the page reads "Sign in", not a personal invite.
    expect(invite?.e).toBeUndefined();
    expect(invite?.n).toBeUndefined();
  });

  it('opens from a pasted link, with chat text around it', () => {
    const link = teamSignInLink(cfg);
    const route = linkRoute(`Team sign-in: ${link} (pinned)`);
    expect(route?.startsWith('/login?i=')).toBe(true);
    expect(linkRoute('https://jaderans.github.io/jworks_studio/')).toBeNull();
    expect(linkRoute('https://jaderans.github.io/jworks_studio/#/login?i=garbage')).toBeNull();
  });

  it('fills in a new person’s email, and still opens when pasted', () => {
    const link = teamSignInLink(cfg, 'kaye+jw@example.com');
    const query = new URLSearchParams(link.split('?')[1]);
    expect(query.get('e')).toBe('kaye+jw@example.com');
    expect(readInvite(query.get('i'))?.c.ws).toBe('joshworks');
    expect(linkRoute(link)).toContain('&e=kaye%2Bjw%40example.com');
  });

  it('is just #/login when the studio cloud is built into the app', () => {
    vi.stubEnv('VITE_STUDIO_CLOUD', studioCloudValue(cfg));
    expect(builtInCloud()?.ws).toBe('joshworks');
    expect(teamSignInLink(cfg)).toBe('https://jaderans.github.io/jworks_studio/#/login');
    expect(teamSignInLink(cfg, 'kaye@example.com')).toBe('https://jaderans.github.io/jworks_studio/#/login?e=kaye%40example.com');
    // A different studio still gets the long link.
    expect(teamSignInLink({ ...cfg, ws: 'other' })).toContain('#/login?i=');
  });

  it('leaves emulator settings out of the GitHub value and ignores a broken one', () => {
    expect(JSON.parse(studioCloudValue(cfg)).firebase.emulator).toBeUndefined();
    vi.stubEnv('VITE_STUDIO_CLOUD', '{not json');
    expect(builtInCloud()).toBeNull();
    vi.stubEnv('VITE_STUDIO_CLOUD', '');
    expect(builtInCloud()).toBeNull();
  });
});
