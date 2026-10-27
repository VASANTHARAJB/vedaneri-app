'use client';

import { useEffect, useRef, useState } from 'react';
import { PASSWORD_RULES, deleteAccount, endSession, hashPassword, newSalt, updateAccount, type Account, type RuleKey } from '@/lib/authDemo';
import { eraseAccountData, type CampReg } from '@/lib/accountData';
import type { Order } from '@/components/cart/CartProvider';
import { PasswordInput } from '@/components/auth/shared';
import { card, danger, ghost, Heading, primary, type A, type T } from './ui';

const RULE_LABEL: Record<RuleKey, keyof A> = { len: 'ruleLen', upper: 'ruleUpper', lower: 'ruleLower', digit: 'ruleDigit', special: 'ruleSpecial' };

export default function Security({ t, a, acc, orders, camps, onDeleted, onChanged }: { t: T; a: A; acc: Account; orders: Order[]; camps: CampReg[]; onDeleted: () => void; onChanged: () => void }) {
  // change password
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState(''); const [pwOk, setPwOk] = useState(false); const [busy, setBusy] = useState(false);
  // delete account
  const dlg = useRef<HTMLDialogElement>(null);
  const [word, setWord] = useState(''); const [delPw, setDelPw] = useState(''); const [agree, setAgree] = useState(false);
  const [delErr, setDelErr] = useState('');
  useEffect(() => { if (pwOk) { const x = setTimeout(() => setPwOk(false), 4000); return () => clearTimeout(x); } }, [pwOk]);

  const rulesOk = (Object.keys(PASSWORD_RULES) as RuleKey[]).every((k) => PASSWORD_RULES[k](pw));

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(''); setPwOk(false);
    if ((await hashPassword(cur, acc.salt)) !== acc.hash) { setPwErr(t.errCurrent); return; }
    if (!rulesOk) { setPwErr(a.errPwd); return; }
    if (pw !== pw2) { setPwErr(a.errConfirm); return; }
    setBusy(true);
    const salt = newSalt();
    updateAccount({ ...acc, salt, hash: await hashPassword(pw, salt) });
    onChanged(); setBusy(false); setCur(''); setPw(''); setPw2(''); setPwOk(true);
  }

  function download() {
    const { salt: _s, hash: _h, ...safe } = acc;   // never export the password hash
    void _s; void _h;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), account: safe, orders, campRegistrations: camps }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url; el.download = 'vedaneri-my-data.json'; el.click();
    URL.revokeObjectURL(url);
  }

  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault();
    if (word.trim() !== 'DELETE') { setDelErr(t.errWord); return; }
    if ((await hashPassword(delPw, acc.salt)) !== acc.hash) { setDelErr(t.errCurrent); return; }
    if (!agree) { setDelErr(t.errAgree); return; }
    eraseAccountData(acc);
    deleteAccount(acc.id);
    endSession();
    dlg.current?.close();
    onDeleted();
  }

  const lab = 'mb-1 block text-sm font-bold text-charcoal';
  return (
    <div className="space-y-6">
      <Heading id="sec-title" title={t.securityTitle} text={t.securityText} />

      <form noValidate onSubmit={changePw} className={card} aria-labelledby="pw-h">
        <h3 id="pw-h" className="font-display text-2xl font-semibold text-maroon">{t.changePassword}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="cp-cur" className={lab}>{t.currentPassword}</label><PasswordInput id="cp-cur" value={cur} onChange={setCur} t={a} autoComplete="current-password" /></div>
          <div><label htmlFor="cp-new" className={lab}>{t.newPassword}</label><PasswordInput id="cp-new" value={pw} onChange={setPw} t={a} autoComplete="new-password" /></div>
          <div><label htmlFor="cp-new2" className={lab}>{a.confirm}</label><PasswordInput id="cp-new2" value={pw2} onChange={setPw2} t={a} autoComplete="new-password" /></div>
        </div>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {(Object.keys(PASSWORD_RULES) as RuleKey[]).map((k) => { const ok = PASSWORD_RULES[k](pw); return <li key={k} className={ok ? 'font-semibold text-green-800' : 'text-charcoal/75'}><span aria-hidden="true">{ok ? '✓' : '○'}</span> {a[RULE_LABEL[k]] as string}</li>; })}
        </ul>
        {pwErr && <p role="alert" className="mt-3 text-sm font-semibold text-maroon">{pwErr}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className={primary}>{t.updatePassword}</button>
          {pwOk && <p role="status" className="font-semibold text-green-800">✓ {t.passwordChanged}</p>}
        </div>
      </form>

      <section className={card} aria-labelledby="dl-h">
        <h3 id="dl-h" className="font-display text-2xl font-semibold text-maroon">{t.downloadTitle}</h3>
        <p className="mt-1 text-charcoal/80">{t.downloadText}</p>
        <button type="button" onClick={download} className={`${ghost} mt-4`}>{t.downloadBtn}</button>
      </section>

      <section className="rounded-2xl border-2 border-red-700/60 bg-red-50 p-5 sm:p-6" aria-labelledby="del-h">
        <h3 id="del-h" className="font-display text-2xl font-semibold text-red-800">{t.deleteTitle}</h3>
        <p className="mt-1 text-charcoal/85">{t.deleteText}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-charcoal/85">
          <li>{t.deleteLine1}</li><li>{t.deleteLine2}</li><li>{t.deleteLine3}</li>
        </ul>
        <button type="button" onClick={() => { setWord(''); setDelPw(''); setAgree(false); setDelErr(''); dlg.current?.showModal(); }} className={`${danger} mt-4`}>{t.deleteBtn}</button>
      </section>

      <dialog ref={dlg} aria-labelledby="dd-title" className="w-[min(92vw,30rem)] rounded-2xl p-0 backdrop:bg-charcoal/60">
        <form noValidate onSubmit={confirmDelete} className="bg-white p-6">
          <h3 id="dd-title" className="font-display text-2xl font-semibold text-red-800">{t.deleteConfirmTitle}</h3>
          <p className="mt-2 text-sm text-charcoal/85">{t.deleteConfirmText}</p>
          <div className="mt-4"><label htmlFor="dd-word" className={lab}>{t.typeDelete}</label><input id="dd-word" value={word} onChange={(e) => { setWord(e.target.value); setDelErr(''); }} autoComplete="off" className="w-full rounded-md border-2 border-rose px-3 py-2.5 focus:border-red-700 focus:outline-none" /></div>
          <div className="mt-4"><label htmlFor="dd-pw" className={lab}>{t.currentPassword}</label><PasswordInput id="dd-pw" value={delPw} onChange={(v) => { setDelPw(v); setDelErr(''); }} t={a} autoComplete="current-password" /></div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-charcoal"><input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setDelErr(''); }} className="mt-0.5 h-5 w-5 shrink-0 accent-red-700" />{t.deleteAgree}</label>
          {delErr && <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{delErr}</p>}
          <div className="mt-5 flex gap-3"><button type="submit" className={danger}>{t.deleteForever}</button><button type="button" onClick={() => dlg.current?.close()} className={ghost}>{t.cancel}</button></div>
        </form>
      </dialog>
    </div>
  );
}
