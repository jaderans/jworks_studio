// Checks firebase/firestore.rules against the Firestore emulator for the studio tables.
// Run from the project folder: npm run test:rules (starts the Firestore emulator; needs Java).
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-jwcamp',
  firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();

const W = 'camp/w1';
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, W), { ownerUid: 'u-owner' });
  const access = { 'owner@x.com': ['owner', 'm-owner'], 'mgr@x.com': ['manager', 'm-mgr'], 'des@x.com': ['designer', 'm-des'], 'other@x.com': ['designer', 'm-other'], 'off@x.com': ['designer', 'm-off'] };
  for (const [email, [role, memberId]] of Object.entries(access)) await setDoc(doc(db, `${W}/access/${email}`), { role, memberId, active: email !== 'off@x.com', email });
  // A login the owner made in the app: tied to its uid, no email verification.
  await setDoc(doc(db, `${W}/access/new@x.com`), { role: 'manager', memberId: 'm-new', active: true, email: 'new@x.com', uid: 'u-new', mustChangePassword: true });
  const rec = (extra = {}) => ({ updatedAt: 10, deleted: 0, ...extra });
  await setDoc(doc(db, `${W}/t_earnings/e-des`), rec({ memberId: 'm-des', amount: 100 }));
  await setDoc(doc(db, `${W}/t_earnings/e-other`), rec({ memberId: 'm-other', amount: 100 }));
  await setDoc(doc(db, `${W}/t_payouts/p-des`), rec({ memberId: 'm-des', amount: 100 }));
  await setDoc(doc(db, `${W}/t_payouts/p-other`), rec({ memberId: 'm-other', amount: 100 }));
  await setDoc(doc(db, `${W}/t_payoutAccounts/m-des`), rec({ method: 'GCash' }));
  await setDoc(doc(db, `${W}/t_payoutAccounts/m-other`), rec({ method: 'GCash' }));
  for (const t of ['payments', 'invoices', 'jobMoney', 'expenses', 'contractTemplates', 'jobs', 'jobProgress', 'members']) await setDoc(doc(db, `${W}/t_${t}/x1`), rec());
  for (const k of ['money', 'business', 'security', 'payMethods', 'email']) await setDoc(doc(db, `${W}/t_settings/${k}`), rec());
});

const as = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const owner = as('u-owner', 'owner@x.com');
const mgr = as('u-mgr', 'mgr@x.com');
const des = as('u-des', 'des@x.com');
const off = as('u-off', 'off@x.com');
const unverified = as('u-des2', 'des@x.com', false);
const madeLogin = as('u-new', 'new@x.com', false);
const impostor = as('u-fake', 'new@x.com', false);
const verifiedImpostor = as('u-fake2', 'new@x.com', true);
const newer = { updatedAt: 20, deleted: 0 };

let passed = 0;
const failures = [];
async function check(label, p) {
  try {
    await p;
    passed++;
  } catch (e) {
    failures.push(`${label}: ${e.message.split('\n')[0]}`);
  }
}

// Designers: their own pay only.
await check('designer lists own earnings', assertSucceeds(getDocs(query(collection(des, `${W}/t_earnings`), where('memberId', '==', 'm-des')))));
await check('designer cannot list all earnings', assertFails(getDocs(collection(des, `${W}/t_earnings`))));
await check('designer cannot query someone else’s earnings', assertFails(getDocs(query(collection(des, `${W}/t_earnings`), where('memberId', '==', 'm-other')))));
await check('designer cannot read another earning', assertFails(getDoc(doc(des, `${W}/t_earnings/e-other`))));
await check('designer cannot write earnings', assertFails(setDoc(doc(des, `${W}/t_earnings/e-des`), { memberId: 'm-des', amount: 999, ...newer })));
await check('designer lists own payouts', assertSucceeds(getDocs(query(collection(des, `${W}/t_payouts`), where('memberId', '==', 'm-des')))));
await check('designer cannot list all payouts', assertFails(getDocs(collection(des, `${W}/t_payouts`))));
await check('designer reads own payout account', assertSucceeds(getDoc(doc(des, `${W}/t_payoutAccounts/m-des`))));
await check('designer edits own payout account', assertSucceeds(setDoc(doc(des, `${W}/t_payoutAccounts/m-des`), { method: 'Maya', ...newer })));
await check('designer cannot read another payout account', assertFails(getDoc(doc(des, `${W}/t_payoutAccounts/m-other`))));
await check('designer cannot edit another payout account', assertFails(setDoc(doc(des, `${W}/t_payoutAccounts/m-other`), { method: 'Maya', ...newer })));
await check('designer cannot create one for someone else', assertFails(setDoc(doc(des, `${W}/t_payoutAccounts/m-new`), { method: 'Maya', ...newer })));
for (const t of ['payments', 'invoices', 'jobMoney', 'expenses', 'contractTemplates']) await check(`designer cannot read ${t}`, assertFails(getDoc(doc(des, `${W}/t_${t}/x1`))));
await check('designer reads jobs', assertSucceeds(getDoc(doc(des, `${W}/t_jobs/x1`))));
await check('designer cannot change the job plan', assertFails(setDoc(doc(des, `${W}/t_jobs/x1`), newer)));
await check('designer updates job progress', assertSucceeds(setDoc(doc(des, `${W}/t_jobProgress/x1`), { ...newer, status: 'review' })));
await check('designer cannot write older progress', assertFails(setDoc(doc(des, `${W}/t_jobProgress/x1`), { updatedAt: 5, deleted: 0 })));
await check('designer cannot read money settings', assertFails(getDoc(doc(des, `${W}/t_settings/money`))));
await check('designer cannot read payment methods', assertFails(getDoc(doc(des, `${W}/t_settings/payMethods`))));
await check('designer cannot read email keys', assertFails(getDoc(doc(des, `${W}/t_settings/email`))));
await check('designer reads the business profile', assertSucceeds(getDoc(doc(des, `${W}/t_settings/business`))));

// Managers: all money, no team or settings changes.
for (const t of ['payments', 'invoices', 'jobMoney', 'expenses', 'contractTemplates']) {
  await check(`manager reads ${t}`, assertSucceeds(getDoc(doc(mgr, `${W}/t_${t}/x1`))));
  await check(`manager writes ${t}`, assertSucceeds(setDoc(doc(mgr, `${W}/t_${t}/x1`), newer)));
}
await check('manager lists every earning', assertSucceeds(getDocs(collection(mgr, `${W}/t_earnings`))));
await check('manager records payouts', assertSucceeds(setDoc(doc(mgr, `${W}/t_payouts/p-new`), { memberId: 'm-des', amount: 1, ...newer })));
await check('manager reads all payout accounts', assertSucceeds(getDoc(doc(mgr, `${W}/t_payoutAccounts/m-other`))));
await check('manager writes jobs', assertSucceeds(setDoc(doc(mgr, `${W}/t_jobs/x1`), { ...newer, updatedAt: 30 })));
await check('manager reads money settings', assertSucceeds(getDoc(doc(mgr, `${W}/t_settings/money`))));
await check('manager cannot read the PIN', assertFails(getDoc(doc(mgr, `${W}/t_settings/security`))));
await check('manager cannot change settings', assertFails(setDoc(doc(mgr, `${W}/t_settings/money`), { updatedAt: 99, deleted: 0 })));
await check('manager cannot change the team', assertFails(setDoc(doc(mgr, `${W}/t_members/x1`), { updatedAt: 99, deleted: 0 })));

// Owner: everything. Paused and unverified accounts: nothing.
await check('owner changes settings', assertSucceeds(setDoc(doc(owner, `${W}/t_settings/money`), { updatedAt: 99, deleted: 0 })));
await check('owner reads every payout account', assertSucceeds(getDoc(doc(owner, `${W}/t_payoutAccounts/m-des`))));
await check('paused designer reads nothing', assertFails(getDoc(doc(off, `${W}/t_jobs/x1`))));
await check('paused designer cannot read own pay', assertFails(getDocs(query(collection(off, `${W}/t_earnings`), where('memberId', '==', 'm-off')))));
await check('unverified email reads nothing', assertFails(getDoc(doc(unverified, `${W}/t_jobs/x1`))));

// Logins made by the owner in the app: they work without email verification, and only for that login.
await check('owner-made login reads without verification', assertSucceeds(getDoc(doc(madeLogin, `${W}/t_jobs/x1`))));
await check('owner-made manager login reads money', assertSucceeds(getDoc(doc(madeLogin, `${W}/t_payments/x1`))));
await check('same email, other login, reads nothing', assertFails(getDoc(doc(impostor, `${W}/t_jobs/x1`))));
await check('same email verified elsewhere reads nothing', assertFails(getDoc(doc(verifiedImpostor, `${W}/t_jobs/x1`))));
await check('they cannot change their own role', assertFails(updateDoc(doc(madeLogin, `${W}/access/new@x.com`), { role: 'owner' })));
await check('an impostor cannot clear the temporary password flag', assertFails(updateDoc(doc(impostor, `${W}/access/new@x.com`), { mustChangePassword: false, passwordSetAt: 1 })));
await check('they clear their temporary password flag', assertSucceeds(updateDoc(doc(madeLogin, `${W}/access/new@x.com`), { mustChangePassword: false, passwordSetAt: 1 })));
await check('a manager cannot create logins', assertFails(setDoc(doc(mgr, `${W}/access/x@x.com`), { role: 'owner', active: true })));
await check('the owner creates logins', assertSucceeds(setDoc(doc(owner, `${W}/access/x@x.com`), { role: 'manager', active: true, uid: 'u-x' })));

// Renewed logins: a fresh account on a tagged email, found through camp/{ws}/signin/{email} before signing in.
const signedOut = env.unauthenticatedContext().firestore();
const renewed = as('u-renewed', 'new+jwab2cd@x.com', false);
await check('the owner points an email at its renewed login', assertSucceeds(setDoc(doc(owner, `${W}/signin/new@x.com`), { login: 'new+jwab2cd@x.com', updatedAt: 1 })));
await check('the owner keys the renewed access by that login', assertSucceeds(setDoc(doc(owner, `${W}/access/new+jwab2cd@x.com`), { role: 'manager', memberId: 'm-new', active: true, email: 'new@x.com', uid: 'u-renewed', mustChangePassword: true })));
await check('the owner lists the team’s access by person', assertSucceeds(getDocs(query(collection(owner, `${W}/access`), where('memberId', '==', 'm-new')))));
await check('the owner retires the old login', assertSucceeds((await import('firebase/firestore')).deleteDoc(doc(owner, `${W}/access/new@x.com`))));
await check('anyone reads where one email signs in', assertSucceeds(getDoc(doc(signedOut, `${W}/signin/new@x.com`))));
await check('nobody lists the sign-in pointers', assertFails(getDocs(collection(signedOut, `${W}/signin`))));
await check('a manager cannot list the sign-in pointers', assertFails(getDocs(collection(mgr, `${W}/signin`))));
await check('a manager cannot point an email elsewhere', assertFails(setDoc(doc(mgr, `${W}/signin/new@x.com`), { login: 'evil@x.com', updatedAt: 2 })));
await check('a stranger cannot point an email elsewhere', assertFails(setDoc(doc(signedOut, `${W}/signin/des@x.com`), { login: 'evil@x.com', updatedAt: 2 })));
await check('the old login reads nothing after renewal', assertFails(getDoc(doc(madeLogin, `${W}/t_jobs/x1`))));
await check('the renewed login reads without verification', assertSucceeds(getDoc(doc(renewed, `${W}/t_payments/x1`))));
await check('the renewed login clears its temporary password flag', assertSucceeds(updateDoc(doc(renewed, `${W}/access/new+jwab2cd@x.com`), { mustChangePassword: false, passwordSetAt: 2 })));
await check('nothing is hard-deleted', assertFails((await import('firebase/firestore')).deleteDoc(doc(owner, `${W}/t_jobs/x1`))));

// Client links: anyone with the link reads it; an anonymous client sends their answers or signature once.
const anon = env.unauthenticatedContext().firestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const base = { contractId: 'c1', snapshot: { title: 'Branding' }, createdAt: 1 };
  const soon = Timestamp.fromMillis(Date.now() + 86_400_000);
  await setDoc(doc(db, `${W}/share/tok-q`), { ...base, kind: 'questionnaire', status: 'open', expiresAt: soon });
  await setDoc(doc(db, `${W}/share/tok-s`), { ...base, kind: 'sign', status: 'open', expiresAt: soon });
  await setDoc(doc(db, `${W}/share/tok-old`), { ...base, kind: 'questionnaire', status: 'open', expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  await setDoc(doc(db, `${W}/share/tok-done`), { ...base, kind: 'questionnaire', status: 'responded', expiresAt: soon });
});
const answers = { status: 'responded', respondedAt: serverTimestamp(), response: { answers: [{ q: 'What industry/field are you in?', a: 'Coffee' }], device: 'test' } };
const signed = { ...answers, response: { ...answers.response, agreed: true, name: 'Kape Ilonggo', signature: `data:image/png;base64,${'A'.repeat(200)}` } };
await check('anyone with the link reads it', assertSucceeds(getDoc(doc(anon, `${W}/share/tok-q`))));
await check('nobody without an account lists links', assertFails(getDocs(collection(anon, `${W}/share`))));
await check('designer cannot list links', assertFails(getDocs(collection(des, `${W}/share`))));
await check('manager lists links', assertSucceeds(getDocs(collection(mgr, `${W}/share`))));
await check('client cannot create a link', assertFails(setDoc(doc(anon, `${W}/share/tok-new`), { kind: 'sign', status: 'open' })));
await check('client cannot change the contract', assertFails(updateDoc(doc(anon, `${W}/share/tok-q`), { ...answers, snapshot: { title: 'Changed' } })));
await check('client cannot close a link', assertFails(updateDoc(doc(anon, `${W}/share/tok-q`), { status: 'applied' })));
await check('signing needs the agreement, a name and a signature', assertFails(updateDoc(doc(anon, `${W}/share/tok-s`), answers)));
await check('client cannot answer an expired link', assertFails(updateDoc(doc(anon, `${W}/share/tok-old`), answers)));
await check('client cannot answer twice', assertFails(updateDoc(doc(anon, `${W}/share/tok-done`), answers)));
await check('client sends questionnaire answers', assertSucceeds(updateDoc(doc(anon, `${W}/share/tok-q`), answers)));
await check('client signs the contract', assertSucceeds(updateDoc(doc(anon, `${W}/share/tok-s`), signed)));
await check('manager marks a response applied', assertSucceeds(updateDoc(doc(mgr, `${W}/share/tok-q`), { status: 'applied' })));

await env.cleanup();
console.log(`RULES: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log('  FAIL', f);
process.exit(failures.length ? 1 : 0);
