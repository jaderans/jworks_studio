declare const __APP_VERSION__: { commit: string; built: string } | undefined;

/** The build this device is running (set by vite.config.ts; "dev" in tests). */
export const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? { commit: 'dev', built: '' } : __APP_VERSION__;
