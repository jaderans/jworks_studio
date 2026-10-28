/** The team's Firebase project details. None of this is secret: security comes from the rules and sign-in. */
export interface FirebaseSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  /** Local testing against the Firebase emulators. */
  emulator?: { host: string; authPort: number; firestorePort: number };
}

export interface CloudConfig {
  firebase: FirebaseSettings;
  /** Workspace id: the team's folder in the database. */
  ws: string;
}

/**
 * Accepts the snippet copied from the Firebase console
 * (`const firebaseConfig = { apiKey: "…", … };`) or plain JSON.
 */
export function parseFirebaseConfig(text: string): FirebaseSettings {
  const t = text.trim();
  if (!t) throw new Error('Paste the firebaseConfig from your Firebase project settings.');
  let obj: Record<string, unknown> | null = null;
  try {
    const json = JSON.parse(t);
    if (json && typeof json === 'object') obj = json as Record<string, unknown>;
  } catch {
    obj = null;
  }
  if (!obj) {
    obj = {};
    const re = /(\w+)\s*:\s*["'`]([^"'`]+)["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) obj[m[1]] = m[2];
  }
  const cfg = obj as Partial<FirebaseSettings>;
  const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter((k) => !cfg[k] || typeof cfg[k] !== 'string');
  if (missing.length) throw new Error(`The config is missing ${missing.join(', ')}. Copy the whole firebaseConfig block.`);
  return {
    apiKey: cfg.apiKey!,
    authDomain: cfg.authDomain!,
    projectId: cfg.projectId!,
    appId: cfg.appId!,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    emulator: cfg.emulator,
  };
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'team';

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export interface InvitePayload {
  c: CloudConfig;
  e?: string;
  n?: string;
}

/**
 * The studio's own cloud, built into the published app (the repository
 * variable STUDIO_CLOUD, copied from Settings → Cloud sync). With it, anyone
 * opening the app just signs in: no invite link needed. Not secret: the
 * security rules decide who sees what.
 */
export function builtInCloud(): CloudConfig | null {
  const raw = (import.meta.env.VITE_STUDIO_CLOUD as string | undefined)?.trim();
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as CloudConfig;
    return c?.firebase?.apiKey && c.firebase.projectId && c.ws ? c : null;
  } catch {
    return null;
  }
}

const sameCloud = (a: CloudConfig, b: CloudConfig) => a.firebase.projectId === b.firebase.projectId && a.ws === b.ws;

/** What to save as STUDIO_CLOUD: the cloud this device uses (without emulator settings). */
export function studioCloudValue(cfg: CloudConfig): string {
  const { emulator, ...firebase } = cfg.firebase;
  void emulator;
  return JSON.stringify({ firebase, ws: cfg.ws });
}

/**
 * The team's sign-in link: the same for everyone, to pin in the group chat.
 * It opens the app's Sign in screen (email + password) and connects that
 * device to the studio. With the cloud built into the app it's just #/login.
 * With an email (a new person's login message), the email is filled in.
 */
export function teamSignInLink(cfg: CloudConfig, email?: string): string {
  const base = `${location.origin}${location.pathname}`;
  const e = email ? `e=${encodeURIComponent(email)}` : '';
  const built = builtInCloud();
  if (built && sameCloud(built, cfg)) return `${base}#/login${e ? `?${e}` : ''}`;
  return `${base}#/login?i=${b64urlEncode(JSON.stringify({ c: cfg } satisfies InvitePayload))}${e ? `&${e}` : ''}`;
}

/** A pasted sign-in or invite link → the part after "#", to open it in this app. */
export function linkRoute(pasted: string): string | null {
  const m = /#(\/(?:login|join)\?i=[A-Za-z0-9_-]+(?:&[^#\s]*)?)/.exec(pasted.trim());
  return m && readInvite(new URLSearchParams(m[1].split('?')[1]).get('i')) ? m[1] : null;
}

/** A client link: the team's Firebase project, the workspace and the link's token. */
export interface LinkData {
  f: FirebaseSettings;
  w: string;
  t: string;
}

export const encodeLinkData = (d: LinkData) => b64urlEncode(JSON.stringify(d));

export function readLinkData(param: string | null): LinkData | null {
  if (!param) return null;
  try {
    const d = JSON.parse(b64urlDecode(param)) as LinkData;
    return d?.f?.apiKey && d.f.projectId && d.w && d.t ? d : null;
  } catch {
    return null;
  }
}

export function readInvite(param: string | null): InvitePayload | null {
  if (!param) return null;
  try {
    const p = JSON.parse(b64urlDecode(param)) as InvitePayload;
    if (!p?.c?.firebase?.apiKey || !p.c.ws) return null;
    return p;
  } catch {
    return null;
  }
}
