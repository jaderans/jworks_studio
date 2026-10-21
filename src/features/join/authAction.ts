/** A Firebase email link's parameters (see AuthActionPage). */
export interface AuthAction {
  mode: string;
  oobCode: string;
  apiKey: string;
}

/** The link's ?mode=…&oobCode=…&apiKey=… (before the #/ route). */
export function readAuthAction(): AuthAction | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const mode = q.get('mode') ?? '';
  const oobCode = q.get('oobCode') ?? '';
  const apiKey = q.get('apiKey') ?? '';
  return mode && oobCode && apiKey ? { mode, oobCode, apiKey } : null;
}
